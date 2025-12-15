import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { inviteUsersToTrip } from "@/server/services/invitations";
import { InviteUsersSchema } from "@/types/schemas";
import { TripMemberRole } from "@/lib/generated/prisma";

/**
 * POST /api/trips/:id/invitations
 * Invites users to a trip by email or userId.
 * When using userIds with groupIds, validates users are in the caller's discoverable set.
 * Creates TripMember rows with RSVP=PENDING and sends in-app notifications.
 *
 * Only OWNER or ADMIN can invite users.
 */
export async function POST(
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

    // 2. Check if user is a trip member with at least ADMIN role
    const membership = await requireTripMember(auth.uid, tripId, TripMemberRole.ADMIN);

    if (!membership) {
      return NextResponse.json(
        { error: "Only trip organizers and admins can invite users" },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validationResult = InviteUsersSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid invitation data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { emails, userIds, groupIds, nonUserNames } = validationResult.data;

    // 4. Invite users
    const result = await inviteUsersToTrip(
      tripId,
      { emails, userIds, groupIds, nonUserNames },
      auth.uid
    );

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inviting users to trip:", error);
    return NextResponse.json(
      { error: "Failed to invite users. Please try again." },
      { status: 500 }
    );
  }
}
