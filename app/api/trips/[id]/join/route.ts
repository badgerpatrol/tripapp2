import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { TripMemberRole, EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";

/**
 * POST /api/trips/:id/join
 * Allows an authenticated user to join a trip when signUpMode is enabled.
 * Requires authentication and trip password verification.
 *
 * Request body:
 * - password: The trip's signUpPassword for verification
 *
 * Returns:
 * - success: boolean
 * - membership: The created/existing trip membership
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

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
    const user = await requireAuth(auth.uid);

    // 2. Get trip and verify signUpMode is enabled
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        name: true,
        signUpMode: true,
        signUpPassword: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    if (!trip.signUpMode) {
      return NextResponse.json(
        { error: "Sign-up is not enabled for this trip" },
        { status: 400 }
      );
    }

    if (!trip.signUpPassword) {
      return NextResponse.json(
        { error: "Trip sign-up password not configured" },
        { status: 400 }
      );
    }

    // 3. Parse request body and verify password
    const body = await request.json();
    const { password } = body;

    if (!password || password !== trip.signUpPassword) {
      return NextResponse.json(
        { error: "Invalid trip password" },
        { status: 401 }
      );
    }

    // 4. Check if user is already a member
    const existingMembership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: user.id,
        },
      },
    });

    if (existingMembership && !existingMembership.deletedAt) {
      // Already a member - just return success
      return NextResponse.json(
        {
          success: true,
          alreadyMember: true,
          membership: existingMembership,
        },
        { status: 200 }
      );
    }

    // 5. Create or restore membership
    let membership;
    if (existingMembership?.deletedAt) {
      // Restore soft-deleted membership
      membership = await prisma.tripMember.update({
        where: { id: existingMembership.id },
        data: {
          deletedAt: null,
          role: TripMemberRole.MEMBER,
          rsvpStatus: "ACCEPTED",
        },
      });
    } else {
      // Create new membership
      membership = await prisma.tripMember.create({
        data: {
          tripId,
          userId: user.id,
          role: TripMemberRole.MEMBER,
          rsvpStatus: "ACCEPTED",
        },
      });
    }

    // 6. Log the event
    await logEvent("TripMember", membership.id, EventType.TRIP_MEMBER_ADDED, user.id, {
      tripId,
      method: "self-join",
    });

    return NextResponse.json(
      {
        success: true,
        alreadyMember: false,
        membership,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error joining trip:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to join trip" },
      { status: 500 }
    );
  }
}
