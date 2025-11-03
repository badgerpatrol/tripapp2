import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { RsvpWindowStatus, TripMemberRole } from "@/lib/generated/prisma";

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

    // Update trip RSVP status
    // NOTE: We do NOT reset the milestone when manually changing RSVP status.
    // Milestone status (isCompleted) and RSVP status are independent:
    // - Milestone tracks whether the deadline date has been processed (pending → done)
    // - RSVP status controls whether RSVPs are allowed (OPEN ↔ CLOSED)
    // Organizers can manually change RSVP status at any time, regardless of milestone state.
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { rsvpStatus: newStatus },
    });

    console.log(`[rsvp-status] Updated trip ${tripId} to status: ${newStatus}`);

    return NextResponse.json({
      success: true,
      trip: {
        id: updatedTrip.id,
        rsvpStatus: updatedTrip.rsvpStatus,
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
