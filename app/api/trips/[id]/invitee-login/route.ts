import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * POST /api/trips/:id/invitee-login
 * Logs in as a specific invitee on the trip.
 *
 * For SIGNUP users (created via trip sign-up):
 * - Verifies the trip password
 * - Returns the user's email and the trip password (which is their account password)
 *
 * For FULL users (real accounts):
 * - Returns a flag indicating they need to use their own credentials
 * - Does NOT verify any password here
 *
 * Request body:
 * - memberId: The trip member ID to login as
 * - tripPassword: The trip password (required for SIGNUP users)
 *
 * Returns on success for SIGNUP users:
 * - userType: "SIGNUP"
 * - email: The user's email (for Firebase auth)
 * - password: The password to use (trip password)
 *
 * Returns on success for FULL users:
 * - userType: "FULL"
 * - email: The user's email (for Firebase auth)
 * - requiresOwnPassword: true
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    // 1. Parse request body
    const body = await request.json();
    const { memberId, tripPassword } = body;

    if (!memberId || typeof memberId !== "string") {
      return NextResponse.json(
        { error: "Member ID is required" },
        { status: 400 }
      );
    }

    // 2. Get trip and verify it exists with password
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        signInMode: true,
        signUpPassword: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    if (!trip.signInMode) {
      return NextResponse.json(
        { error: "Sign-in mode is not enabled for this trip" },
        { status: 400 }
      );
    }

    // 3. Get the member and their user info
    const member = await prisma.tripMember.findUnique({
      where: {
        id: memberId,
        tripId: tripId,
        deletedAt: null,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            userType: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found on this trip" },
        { status: 404 }
      );
    }

    // 4. Handle based on user type
    if (member.user.userType === "SIGNUP") {
      // SIGNUP users use the trip password
      if (!tripPassword || typeof tripPassword !== "string") {
        return NextResponse.json(
          { error: "Trip password is required" },
          { status: 400 }
        );
      }

      if (!trip.signUpPassword) {
        return NextResponse.json(
          { error: "Trip does not have a password configured" },
          { status: 400 }
        );
      }

      if (tripPassword !== trip.signUpPassword) {
        return NextResponse.json(
          { error: "Incorrect trip password" },
          { status: 401 }
        );
      }

      // Sync the user's Firebase password with the current trip password
      // This ensures login works even if the trip password was changed after the user was created
      try {
        await adminAuth.updateUser(member.user.id, {
          password: trip.signUpPassword,
        });
      } catch (firebaseError) {
        console.error("Failed to sync Firebase password:", firebaseError);
        // Continue anyway - the password might already be correct
      }

      // Return credentials for SIGNUP user
      console.log("[invitee-login] Returning SIGNUP credentials:", {
        email: member.user.email,
        userId: member.user.id,
        displayName: member.user.displayName,
      });
      return NextResponse.json(
        {
          userType: "SIGNUP",
          email: member.user.email,
          password: trip.signUpPassword, // SIGNUP users use trip password as their account password
          displayName: member.user.displayName,
        },
        { status: 200 }
      );
    } else if (member.user.userType === "FULL") {
      // FULL users need to enter their own password
      return NextResponse.json(
        {
          userType: "FULL",
          email: member.user.email,
          displayName: member.user.displayName,
          requiresOwnPassword: true,
        },
        { status: 200 }
      );
    } else {
      // SYSTEM users shouldn't be selectable
      return NextResponse.json(
        { error: "Cannot sign in as this user type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in invitee login:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
