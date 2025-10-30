import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { SpendStatus, TripMemberRole } from "@/lib/generated/prisma";

/**
 * POST /api/trips/[id]/spend-status
 * Toggle trip spend status (close/reopen all spending on the trip)
 * Only OWNER and ADMIN can toggle spend status
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
        { error: "Only trip organizers can change spend status" },
        { status: 403 }
      );
    }

    // Parse request body for optional action parameter
    const body = await req.json().catch(() => ({}));
    const action = body.action; // 'close' or 'open', optional

    // Determine new status
    let newStatus: SpendStatus;
    if (action === "close") {
      newStatus = SpendStatus.CLOSED;
    } else if (action === "open") {
      newStatus = SpendStatus.OPEN;
    } else {
      // Toggle behavior
      newStatus = trip.spendStatus === SpendStatus.OPEN ? SpendStatus.CLOSED : SpendStatus.OPEN;
    }

    // Update trip spend status
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { spendStatus: newStatus },
    });

    return NextResponse.json({
      success: true,
      trip: {
        id: updatedTrip.id,
        spendStatus: updatedTrip.spendStatus,
      },
      message: newStatus === SpendStatus.CLOSED
        ? "Trip spending is now closed. No one can add or edit spends."
        : "Trip spending is now open. Members can add and edit spends.",
    });
  } catch (error) {
    console.error("Error toggling trip spend status:", error);
    return NextResponse.json(
      { error: "Failed to toggle spend status" },
      { status: 500 }
    );
  }
}
