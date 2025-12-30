import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { removeTripMember, updateRsvpStatus } from "@/server/services/invitations";
import { TripMemberRole, RsvpStatus, RsvpWindowStatus } from "@/lib/generated/prisma";
import { UpdateRsvpSchema } from "@/types/schemas";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/trips/:id/members/:userId
 * Updates a user's RSVP status for a trip invitation.
 * User can only update their own RSVP status.
 * Checks if RSVP deadline has passed (unless organizer has reopened RSVP).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    const { id: tripId, userId } = await params;

    // 2. Verify the user is updating their own RSVP
    if (auth.uid !== userId) {
      return NextResponse.json(
        { error: "You can only update your own RSVP status" },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = UpdateRsvpSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { rsvpStatus } = validation.data;

    // 4. Convert string to RsvpStatus enum
    const status = RsvpStatus[rsvpStatus as keyof typeof RsvpStatus];

    // 5. Check if RSVP window is open on the trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        rsvpStatus: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    // Check if RSVP is closed at the trip level
    if (trip.rsvpStatus === "CLOSED") {
      // Check if user is an organizer who can bypass the closed RSVP
      const membership = await prisma.tripMember.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId,
          },
        },
        select: {
          role: true,
        },
      });

      const canBypassClosed = membership && (
        membership.role === TripMemberRole.OWNER ||
        membership.role === TripMemberRole.ADMIN
      );

      if (!canBypassClosed) {
        return NextResponse.json(
          { error: "RSVP is closed. Please contact the trip organizer to reopen responses." },
          { status: 403 }
        );
      }
    }

    // 6. Check RSVP deadline
    const rsvpDeadline = await prisma.timelineItem.findFirst({
      where: {
        tripId,
        title: "RSVP Deadline",
        deletedAt: null,
      },
      select: {
        date: true,
        isCompleted: true,
      },
    });

    // Check if RSVP is locked:
    // - RSVP deadline must exist and have a date
    // - The deadline must have passed
    // - The milestone must be marked as completed (meaning it's locked)
    if (rsvpDeadline?.date && rsvpDeadline.isCompleted) {
      const deadlineDate = new Date(rsvpDeadline.date);
      const now = new Date();

      if (deadlineDate < now) {
        // RSVP is locked - check if user is an organizer who can reopen it
        const membership = await prisma.tripMember.findUnique({
          where: {
            tripId_userId: {
              tripId,
              userId,
            },
          },
          select: {
            role: true,
          },
        });

        // Only OWNER or ADMIN can update RSVP after deadline
        const canBypassDeadline = membership && (
          membership.role === TripMemberRole.OWNER ||
          membership.role === TripMemberRole.ADMIN
        );

        if (!canBypassDeadline) {
          return NextResponse.json(
            { error: "RSVP deadline has passed. Please contact the trip organizer to reopen responses." },
            { status: 403 }
          );
        }
      }
    }

    // 7. Update RSVP status
    const updatedMember = await updateRsvpStatus(tripId, userId, status);

    return NextResponse.json(
      {
        success: true,
        message: "RSVP status updated successfully",
        rsvpStatus: updatedMember.rsvpStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating RSVP status:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: "Trip membership not found" },
          { status: 404 }
        );
      }

      if (error.message.includes("cancelled")) {
        return NextResponse.json(
          { error: "This invitation has been cancelled" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update RSVP status. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/:id/members/:userId
 * Removes a member from a trip (uninvite or remove).
 * Only OWNER or ADMIN can remove members.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    const { id: tripId, userId: userIdToRemove } = await params;

    // 2. Check if user is a trip member with at least ADMIN role
    const membership = await requireTripMembershipOnly(auth.uid, tripId, TripMemberRole.ADMIN);

    if (!membership) {
      return NextResponse.json(
        { error: "Only trip organizers and admins can remove members" },
        { status: 403 }
      );
    }

    // 3. Prevent removing yourself if you're the owner
    if (auth.uid === userIdToRemove && membership.role === TripMemberRole.OWNER) {
      return NextResponse.json(
        { error: "Trip owner cannot remove themselves" },
        { status: 400 }
      );
    }

    // 4. Remove the member
    await removeTripMember(tripId, userIdToRemove, auth.uid);

    return NextResponse.json(
      {
        success: true,
        message: "Member removed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing trip member:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to remove member. Please try again." },
      { status: 500 }
    );
  }
}
