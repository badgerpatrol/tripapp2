import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebase/admin";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { TripMemberRole, UserRole, UserType, EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";

/**
 * POST /api/trips/:id/add-member-by-name
 * Creates a new fake user account and adds them to the trip.
 * Requires authentication - only trip owners/admins can use this.
 * Requires trip password to be set (but not signUpMode).
 *
 * Request body:
 * - displayName: The name for the new user
 *
 * Returns:
 * - user: The created user info
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
    await requireAuth(auth.uid);

    // 2. Check if user is a trip member with sufficient role
    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: auth.uid,
        },
        deletedAt: null,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a trip member to add people by name" },
        { status: 403 }
      );
    }

    // Only owners and admins can add members
    if (membership.role !== TripMemberRole.OWNER && membership.role !== TripMemberRole.ADMIN) {
      return NextResponse.json(
        { error: "Only trip owners and admins can add people by name" },
        { status: 403 }
      );
    }

    // 3. Get trip and verify password is set
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        name: true,
        signUpPassword: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    if (!trip.signUpPassword) {
      return NextResponse.json(
        { error: "Trip password must be set to add people by name. Set a trip password in trip settings." },
        { status: 400 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    const trimmedName = displayName.trim();

    // 5. Check if a participant with this name already exists on the trip (case-insensitive)
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

    // 6. Generate email for the new user
    // Format: <name>@<tripId>.fake
    // Clean the name: lowercase, replace spaces with dots, remove special chars
    const cleanName = trimmedName
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "");

    const shortTripId = tripId.slice(0, 8);
    const email = `${cleanName}@${shortTripId}.fake`;

    // 7. Check if user with this email already exists
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

    // 8. Create or update user in database
    const dbUser = await prisma.user.upsert({
      where: { id: firebaseUser.uid },
      create: {
        id: firebaseUser.uid,
        email,
        displayName: trimmedName,
        role: UserRole.USER,
        userType: UserType.SIGNUP, // Created during trip sign-up
        timezone: "UTC",
        language: "en",
        defaultCurrency: "GBP",
      },
      update: {
        displayName: trimmedName,
      },
    });

    // 9. Add user as trip member if not already
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

    // 10. Log the event
    await logEvent("User", dbUser.id, EventType.USER_CREATED, auth.uid, {
      tripId,
      method: "add-member-by-name",
      displayName: trimmedName,
      addedBy: auth.uid,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: dbUser.id,
          email,
          displayName: trimmedName,
        },
        isNewUser: isNewFirebaseUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding member by name:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add member" },
      { status: 500 }
    );
  }
}
