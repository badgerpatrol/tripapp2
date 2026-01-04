import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import { createGroup, listUserGroups } from "@/server/services/groups";
import {
  GroupCreateSchema,
  CreateGroupResponseSchema,
  ListGroupsResponseSchema,
} from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";

/**
 * POST /api/groups
 * Creates a new group with the authenticated user as owner.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // Require ADMIN role to access Groups feature
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = GroupCreateSchema.safeParse(body);

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

    // 3. Create group using service
    const group = await createGroup(auth.uid, validation.data);

    // 4. Return response
    const response = CreateGroupResponseSchema.parse({
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

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create group. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/groups
 * Gets all groups for the authenticated user (owned or member).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // Note: No ADMIN role check here - users can see groups they are members of
    // The listUserGroups service filters to only groups where user is owner/member

    // 2. Get user's groups
    const groups = await listUserGroups(auth.uid);

    // 3. Return response
    const response = ListGroupsResponseSchema.parse({
      success: true,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        ownerId: g.ownerId,
        memberCount: g.memberCount,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error getting groups:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get groups. Please try again.",
      },
      { status: 500 }
    );
  }
}
