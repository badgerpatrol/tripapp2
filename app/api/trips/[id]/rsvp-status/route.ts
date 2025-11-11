import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { RsvpWindowStatus, TripMemberRole, MilestoneTriggerType } from "@/lib/generated/prisma";

/**
 * POST /api/trips/[id]/rsvp-status
 * Toggle trip RSVP status (close/reopen RSVP window)
 * Only OWNER and ADMIN can toggle RSVP status
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    const { id: tripId } = await params;

    // Get the trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      include: {
        members: {
          where: {
            userId: auth.uid,
            deletedAt: null,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check if user is OWNER or ADMIN
    const member = trip.members[0];
    if (!member || (member.role !== TripMemberRole.OWNER && member.role !== TripMemberRole.ADMIN)) {
      return NextResponse.json(
        { error: "Only trip organizers can change RSVP status" },
        { status: 403 }
      );
    }

    // Parse request body for optional action parameter
    const body = await req.json().catch(() => ({}));
    const action = body.action; // 'close' or 'open', optional

    // Determine new status
    let newStatus: RsvpWindowStatus;
    if (action === "close") {
      newStatus = RsvpWindowStatus.CLOSED;
    } else if (action === "open") {
      newStatus = RsvpWindowStatus.OPEN;
    } else {
      // Toggle behavior - trip.rsvpStatus comes from DB as string
      // Treat null/undefined as OPEN (default)
      const currentStatus = trip.rsvpStatus || "OPEN";
      newStatus = currentStatus === "OPEN" ? RsvpWindowStatus.CLOSED : RsvpWindowStatus.OPEN;
    }

    // Update trip RSVP status and mark milestone as completed when manually closing
    const now = new Date();

    // Use transaction to update both trip and milestone
    const result = await prisma.$transaction(async (tx) => {
      // Update trip RSVP status
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: { rsvpStatus: newStatus },
      });

      // Handle RSVP milestone based on status change
      const rsvpMilestone = await tx.timelineItem.findFirst({
        where: {
          tripId,
          title: "RSVP Deadline",
          deletedAt: null,
        },
      });

      if (rsvpMilestone) {
        if (newStatus === RsvpWindowStatus.CLOSED && !rsvpMilestone.isCompleted) {
          // Closing RSVP - mark milestone as completed
          await tx.timelineItem.update({
            where: { id: rsvpMilestone.id },
            data: {
              isCompleted: true,
              completedAt: now,
              triggerType: MilestoneTriggerType.MANUAL,
            },
          });
          console.log(`[rsvp-status] Marked RSVP Deadline milestone as completed (MANUAL) for trip ${tripId}`);
        } else if (newStatus === RsvpWindowStatus.OPEN && rsvpMilestone.isCompleted) {
          // Reopening RSVP - reset milestone to uncompleted
          await tx.timelineItem.update({
            where: { id: rsvpMilestone.id },
            data: {
              isCompleted: false,
              completedAt: null,
              triggerType: null,
            },
          });
          console.log(`[rsvp-status] Reset RSVP Deadline milestone to uncompleted for trip ${tripId}`);
        }
      }

      return updatedTrip;
    });

    console.log(`[rsvp-status] Updated trip ${tripId} to status: ${newStatus}`);

    return NextResponse.json({
      success: true,
      trip: {
        id: result.id,
        rsvpStatus: result.rsvpStatus,
      },
    });
  } catch (error) {
    console.error("Error toggling trip RSVP status:", error);
    return NextResponse.json(
      { error: "Failed to toggle RSVP status" },
      { status: 500 }
    );
  }
}
