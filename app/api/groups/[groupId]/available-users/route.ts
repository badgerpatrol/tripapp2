import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireGroupAdmin } from "@/server/authz";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/groups/:groupId/available-users
 * Gets list of users who are not yet members of this group.
 * Only group admins can access this endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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

    const { groupId } = await params;

    // 2. Check if user is a group admin
    await requireGroupAdmin(auth.uid, groupId);

    // 3. Get all current group members
    const currentMembers = await prisma.groupMember.findMany({
      where: {
        groupId,
      },
      select: {
        userId: true,
      },
    });

    const currentMemberIds = currentMembers.map(m => m.userId);

    // 4. Get all FULL users who are NOT in this group
    const availableUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: currentMemberIds,
        },
        deletedAt: null,
        userType: "FULL",
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
