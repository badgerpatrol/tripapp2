import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { TripMemberRole } from "@/lib/generated/prisma";

/**
 * GET /api/trips/:id/available-users
 * Gets list of users who are not yet members of this trip.
 * Only OWNER or ADMIN can access this endpoint.
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

    // 2. Check if user is a trip member with at least ADMIN role
    const membership = await requireTripMember(auth.uid, tripId, TripMemberRole.ADMIN);

    if (!membership) {
      return NextResponse.json(
        { error: "Only trip organizers and admins can view available users" },
        { status: 403 }
      );
    }

    // 3. Get all current trip members
    const currentMembers = await prisma.tripMember.findMany({
      where: {
        tripId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    const currentMemberIds = currentMembers.map(m => m.userId);

    // 4. Get all users who are NOT in this trip
    const availableUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: currentMemberIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        photoURL: true,
      },
      orderBy: [
        { displayName: "asc" },
        { email: "asc" },
      ],
      take: 100, // Limit to 100 users for performance
    });

    return NextResponse.json(
      {
        success: true,
        users: availableUsers,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching available users:", error);
    return NextResponse.json(
      { error: "Failed to fetch available users. Please try again." },
      { status: 500 }
    );
  }
}
