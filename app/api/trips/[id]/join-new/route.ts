import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebase/admin";
import { TripMemberRole, UserRole, UserType, EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";

/**
 * POST /api/trips/:id/join-new
 * Creates a new user account for joining the trip.
 * No authentication required - this is for creating new participant accounts.
 *
 * The password is NOT sent to this endpoint. Instead:
 * 1. This endpoint creates the user with the trip's signUpPassword
 * 2. The user then needs to verify the password via /verify-password
 * 3. Then they log in with Firebase auth using their email and the trip password
 *
 * Request body:
 * - displayName: The name for the new user
 *
 * Returns:
 * - email: The generated email for the user (for login)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    // 1. Get trip and verify signUpMode is enabled
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

    // 2. Parse request body
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    const trimmedName = displayName.trim();

    // 3. Check if a participant with this name already exists on the trip (case-insensitive)
    const existingParticipant = await prisma.tripMember.findFirst({
      where: {
        tripId,
        deletedAt: null,
        user: {
          displayName: {
            equals: trimmedName,
            mode: "insensitive",
          },
        },
      },
      include: {
        user: {
          select: { displayName: true },
        },
      },
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: `The name "${trimmedName}" is already taken on this trip. Please choose a different name.` },
        { status: 400 }
      );
    }

    // 4. Generate email for the new user
    // Format: <name>@<tripId>.fake
    // Clean the name: lowercase, replace spaces with dots, remove special chars
    const cleanName = trimmedName
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "");

    const shortTripId = tripId.slice(0, 8);
    const email = `${cleanName}@${shortTripId}.fake`;

    // 5. Check if user with this email already exists
    let firebaseUser;
    let isNewFirebaseUser = true;

    try {
      firebaseUser = await adminAuth.getUserByEmail(email);
      isNewFirebaseUser = false;
      // User exists - update their password to the trip password
      await adminAuth.updateUser(firebaseUser.uid, {
        password: trip.signUpPassword,
        displayName: trimmedName,
      });
    } catch (firebaseError: any) {
      if (firebaseError.code === "auth/user-not-found") {
        // Create new Firebase user
        firebaseUser = await adminAuth.createUser({
          email,
          password: trip.signUpPassword,
          displayName: trimmedName,
        });
      } else {
        console.error("Firebase error:", firebaseError);
        throw new Error(`Failed to create user: ${firebaseError.message}`);
      }
    }

    // 6. Create or update user in database
    const dbUser = await prisma.user.upsert({
      where: { id: firebaseUser.uid },
      create: {
        id: firebaseUser.uid,
        email,
        displayName: trimmedName,
        role: UserRole.USER, // Regular user, not viewer
        userType: UserType.SIGNUP, // Created during trip sign-up
        timezone: "UTC",
        language: "en",
        defaultCurrency: "GBP",
      },
      update: {
        displayName: trimmedName,
      },
    });

    // 7. Add user as trip member if not already
    const existingMembership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: dbUser.id,
        },
      },
    });

    if (!existingMembership) {
      await prisma.tripMember.create({
        data: {
          tripId,
          userId: dbUser.id,
          role: TripMemberRole.MEMBER,
          rsvpStatus: "ACCEPTED",
        },
      });
    } else if (existingMembership.deletedAt) {
      // Restore soft-deleted membership
      await prisma.tripMember.update({
        where: { id: existingMembership.id },
        data: {
          deletedAt: null,
          role: TripMemberRole.MEMBER,
          rsvpStatus: "ACCEPTED",
        },
      });
    }

    // 8. Log the event
    await logEvent("User", dbUser.id, EventType.USER_CREATED, dbUser.id, {
      tripId,
      method: "trip-join-new",
      displayName: trimmedName,
    });

    return NextResponse.json(
      {
        success: true,
        email,
        userId: dbUser.id,
        displayName: trimmedName,
        isNewUser: isNewFirebaseUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating new trip user:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create account" },
      { status: 500 }
    );
  }
}
