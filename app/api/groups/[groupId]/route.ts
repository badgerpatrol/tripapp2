import { NextRequest, NextResponse } from "next/server";
import {
  getAuthTokenFromHeader,
  requireAuth,
  requireGroupMember,
  requireGroupAdmin,
} from "@/server/authz";
import {
  getGroup,
  updateGroup,
  deleteGroup,
} from "@/server/services/groups";
import {
  GroupUpdateSchema,
  GetGroupResponseSchema,
  UpdateGroupResponseSchema,
  DeleteGroupResponseSchema,
} from "@/types/schemas";

type Params = {
  params: Promise<{
    groupId: string;
  }>;
};

/**
 * GET /api/groups/:groupId
 * Gets a single group with member details.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { groupId } = await params;

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

    // 2. Verify user is a member of this group
    await requireGroupMember(auth.uid, groupId);

    // 3. Get group with members
    const groupWithMembers = await getGroup(groupId, true);

    // 4. Return response
    const response = GetGroupResponseSchema.parse({
      success: true,
      group: {
        id: groupWithMembers.id,
        name: groupWithMembers.name,
        description: groupWithMembers.description,
        ownerId: groupWithMembers.ownerId,
        createdAt: groupWithMembers.createdAt,
        updatedAt: groupWithMembers.updatedAt,
        members: (groupWithMembers as any).members?.map((m: any) => ({
          id: m.id,
          groupId: m.groupId,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user
            ? {
                id: m.user.id,
                email: m.user.email,
                displayName: m.user.displayName,
                photoURL: m.user.photoURL,
              }
            : undefined,
        })),
      },
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error getting group:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get group";
    const status = message.includes("Forbidden") ? 403 : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

/**
 * PATCH /api/groups/:groupId
 * Updates a group's name and/or description.
 * Requires admin rights.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { groupId } = await params;

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

    // 2. Verify user is an admin of this group
    await requireGroupAdmin(auth.uid, groupId);

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = GroupUpdateSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || "Invalid group data",
        },
        { status: 400 }
      );
    }

    // 4. Update group using service
    const group = await updateGroup(groupId, auth.uid, validation.data);

    // 5. Return response
    const response = UpdateGroupResponseSchema.parse({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        ownerId: group.ownerId,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error updating group:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update group";
    const status = message.includes("Forbidden") ? 403 : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

/**
 * DELETE /api/groups/:groupId
 * Deletes a group and all its members.
 * Only the group owner can delete.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { groupId } = await params;

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

    // 2. Delete group (service verifies ownership)
    await deleteGroup(groupId, auth.uid);

    // 3. Return response
    const response = DeleteGroupResponseSchema.parse({
      success: true,
      message: "Group deleted successfully",
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error deleting group:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete group";
    const status =
      message.includes("Forbidden") || message.includes("Only the")
        ? 403
        : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
