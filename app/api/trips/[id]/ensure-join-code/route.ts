import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireTripMember } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { createOrUpdateSignUpViewer } from "@/server/services/trips";
import { TripMemberRole } from "@/lib/generated/prisma";
import crypto from "crypto";

/**
 * POST /api/trips/[id]/ensure-join-code
 * Ensures a trip has a join code (signUpPassword) generated.
 * Creates one if it doesn't exist. Returns existing code if it does.
 * This is idempotent - calling multiple times returns the same code.
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
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Verify user is a trip member with ADMIN role (OWNER is higher than ADMIN)
    const membership = await requireTripMember(auth.uid, tripId, "ADMIN");

    // 3. Get the trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        signUpPassword: true,
        signUpViewerUserId: true,
        name: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    // 4. If password exists and viewer user exists, return the password
    if (trip.signUpPassword && trip.signUpViewerUserId) {
      return NextResponse.json({
        success: true,
        joinCode: trip.signUpPassword,
      });
    }

    // 5. Generate a new 6-character alphanumeric code (or use existing)
    const joinCode = trip.signUpPassword || generateJoinCode();

    // 6. Create or update the viewer user
    const { userId: viewerUserId } = await createOrUpdateSignUpViewer(
      tripId,
      trip.name,
      trip.signUpViewerUserId,
      joinCode
    );

    // 7. Update the trip with the new code and viewer user
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        signUpPassword: joinCode,
        signUpViewerUserId: viewerUserId,
      },
    });

    // 8. Add the viewer as a trip member or restore if soft-deleted
    const existingMembership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: viewerUserId,
        },
      },
    });

    if (!existingMembership) {
      // Create new membership
      await prisma.tripMember.create({
        data: {
          tripId,
          userId: viewerUserId,
          role: TripMemberRole.VIEWER,
          rsvpStatus: "ACCEPTED",
        },
      });
    } else if (existingMembership.deletedAt !== null) {
      // Restore soft-deleted membership
      await prisma.tripMember.update({
        where: {
          tripId_userId: {
            tripId,
            userId: viewerUserId,
          },
        },
        data: {
          deletedAt: null,
          role: TripMemberRole.VIEWER,
          rsvpStatus: "ACCEPTED",
        },
      });
    }

    return NextResponse.json({
      success: true,
      joinCode,
    });
  } catch (error) {
    console.error("Error ensuring join code:", error);

    if (error instanceof Error && error.message.startsWith("Forbidden:")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate join code" },
      { status: 500 }
    );
  }
}

/**
 * Generates a 6-character alphanumeric join code.
 * Uses uppercase letters and digits for easy readability.
 */
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes I, O, 0, 1 for clarity
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
