import { NextRequest, NextResponse } from "next/server";
import {
  getAuthTokenFromHeader,
  requireAuth,
  requireGroupAdmin,
  requireUserRole,
} from "@/server/authz";
import { removeGroupMember } from "@/server/services/groups";
import { RemoveGroupMemberResponseSchema } from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";

type Params = {
  params: Promise<{
    groupId: string;
    userId: string;
  }>;
};

/**
 * DELETE /api/groups/:groupId/members/:userId
 * Removes a member from the group.
 * Requires admin rights.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { groupId, userId } = await params;

    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    // Require ADMIN role to access Groups feature
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Verify user is an admin of this group
    await requireGroupAdmin(auth.uid, groupId);

    // 3. Remove member using service
    await removeGroupMember(groupId, userId, auth.uid);

    // 4. Return response
    const response = RemoveGroupMemberResponseSchema.parse({
      success: true,
      message: "Member removed successfully",
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error removing group member:", error);
    const message =
      error instanceof Error ? error.message : "Failed to remove member";
    const status = message.includes("Forbidden") || message.includes("Cannot")
      ? 403
      : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
