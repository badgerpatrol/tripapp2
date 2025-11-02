import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, isTripOwner } from "@/server/authz";
import {
  getTripOverviewForInvitee,
  getTripOverviewForMember,
  updateTrip,
  checkAndAutoCloseRsvp,
} from "@/server/services/trips";
import { RsvpStatus } from "@/lib/generated/prisma";
import { UpdateTripSchema } from "@/types/schemas";

/**
 * GET /api/trips/:id
 * Gets trip overview with role-based visibility.
 *
 * - Invitees (PENDING/DECLINED): See basic info, organizer, and participant list only
 * - Accepted members: See full info including spends, timeline, and balances
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: tripId } = await params;

    // 2. Check and auto-close RSVP if deadline has passed
    await checkAndAutoCloseRsvp(tripId);

    // 3. Get trip with basic info to check membership
    const basicOverview = await getTripOverviewForInvitee(tripId, auth.uid);

    if (!basicOverview) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    // 4. Check if user is a member
    if (!basicOverview.userRole) {
      // User is not a member at all
      return NextResponse.json(
        { error: "You do not have access to this trip" },
        { status: 403 }
      );
    }

    // 5. Return data based on RSVP status
    if (basicOverview.userRsvpStatus === RsvpStatus.ACCEPTED) {
      // Accepted members get full overview
      const fullOverview = await getTripOverviewForMember(tripId, auth.uid);
      return NextResponse.json({ trip: fullOverview }, { status: 200 });
    } else {
      // Invitees (PENDING/DECLINED) get limited overview
      return NextResponse.json({ trip: basicOverview }, { status: 200 });
    }
  } catch (error) {
    console.error("Error getting trip overview:", error);
    return NextResponse.json(
      { error: "Failed to get trip overview. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trips/:id
 * Updates trip basic details (dates, location, RSVP deadline, spending window).
 * Only trip owners can update the trip.
 * Updates dependent timeline items and writes an EventLog entry.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: tripId } = await params;

    // 2. Check if user is trip owner
    const isOwner = await isTripOwner(auth.uid, tripId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only trip owners can edit trip details" },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateTripSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid trip data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    // 4. Update the trip
    const updatedTrip = await updateTrip(tripId, auth.uid, validationResult.data);

    return NextResponse.json(
      {
        success: true,
        trip: updatedTrip
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating trip:", error);
    return NextResponse.json(
      { error: "Failed to update trip. Please try again." },
      { status: 500 }
    );
  }
}
