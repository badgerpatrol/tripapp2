import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { removeTripMember } from "@/server/services/invitations";
import { TripMemberRole } from "@/lib/generated/prisma";

/**
 * DELETE /api/trips/:id/members/:userId
 * Removes a member from a trip (uninvite or remove).
 * Only OWNER or ADMIN can remove members.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
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

    const { id: tripId, userId: userIdToRemove } = await params;

    // 2. Check if user is a trip member with at least ADMIN role
    const membership = await requireTripMember(auth.uid, tripId, TripMemberRole.ADMIN);

    if (!membership) {
      return NextResponse.json(
        { error: "Only trip organizers and admins can remove members" },
        { status: 403 }
      );
    }

    // 3. Prevent removing yourself if you're the owner
    if (auth.uid === userIdToRemove && membership.role === TripMemberRole.OWNER) {
      return NextResponse.json(
        { error: "Trip owner cannot remove themselves" },
        { status: 400 }
      );
    }

    // 4. Remove the member
    await removeTripMember(tripId, userIdToRemove, auth.uid);

    return NextResponse.json(
      {
        success: true,
        message: "Member removed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error removing trip member:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to remove member. Please try again." },
      { status: 500 }
    );
  }
}
