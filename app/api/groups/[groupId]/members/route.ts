import { NextRequest, NextResponse } from "next/server";
import {
  getAuthTokenFromHeader,
  requireAuth,
  requireGroupAdmin,
  requireGroupMember,
  requireUserRole,
} from "@/server/authz";
import { listGroupMembers, addGroupMember } from "@/server/services/groups";
import {
  GroupMemberCreateSchema,
  ListGroupMembersResponseSchema,
  AddGroupMemberResponseSchema,
} from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";

type Params = {
  params: Promise<{
    groupId: string;
  }>;
};

/**
 * GET /api/groups/:groupId/members
 * Lists all members of a group.
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

    // Require ADMIN role to access Groups feature
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Verify user is a member of this group
    await requireGroupMember(auth.uid, groupId);

    // 3. Get group members
    const members = await listGroupMembers(groupId);

    // 4. Return response
    const response = ListGroupMembersResponseSchema.parse({
      success: true,
      members: members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user
          ? {
              id: m.user.id,
              displayName: m.user.displayName,
              photoURL: m.user.photoURL,
            }
          : undefined,
      })),
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error getting group members:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get group members";
    const status = message.includes("Forbidden") ? 403 : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

/**
 * POST /api/groups/:groupId/members
 * Adds a new member to the group.
 * Requires admin rights.
 */
export async function POST(request: NextRequest, { params }: Params) {
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

    // Require ADMIN role to access Groups feature
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Verify user is an admin of this group
    await requireGroupAdmin(auth.uid, groupId);

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = GroupMemberCreateSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || "Invalid member data",
        },
        { status: 400 }
      );
    }

    // 4. Add member using service
    const member = await addGroupMember(groupId, auth.uid, validation.data);

    // 5. Return response
    const response = AddGroupMemberResponseSchema.parse({
      success: true,
      member: {
        id: member.id,
        groupId: member.groupId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user
          ? {
              id: member.user.id,
              displayName: member.user.displayName,
              photoURL: member.user.photoURL,
            }
          : undefined,
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error adding group member:", error);
    const message =
      error instanceof Error ? error.message : "Failed to add member";
    const status = message.includes("Forbidden")
      ? 403
      : message.includes("already a member")
        ? 409
        : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
