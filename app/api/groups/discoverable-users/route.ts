import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { getDiscoverableUsers } from "@/server/services/groups";
import {
  DiscoverableUsersQuerySchema,
  DiscoverableUsersResponseSchema,
} from "@/types/schemas";

/**
 * GET /api/groups/discoverable-users
 * Returns union of members from selected groups (de-duplicated).
 * Query params: groupIds (comma-separated), tripId (optional)
 * Excludes existing trip members if tripId is provided.
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

    await requireAuth(auth.uid);

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const groupIdsParam = searchParams.get("groupIds");
    const tripId = searchParams.get("tripId") || undefined;

    if (!groupIdsParam) {
      return NextResponse.json(
        {
          success: false,
          error: "groupIds query parameter is required",
        },
        { status: 400 }
      );
    }

    const groupIds = groupIdsParam.split(",").filter((id) => id.trim());

    const validation = DiscoverableUsersQuerySchema.safeParse({
      groupIds,
      tripId,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || "Invalid query parameters",
        },
        { status: 400 }
      );
    }

    // 3. Get discoverable users using service
    const users = await getDiscoverableUsers(
      auth.uid,
      validation.data.groupIds,
      validation.data.tripId
    );

    // 4. Return response
    const response = DiscoverableUsersResponseSchema.parse({
      success: true,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        photoURL: u.photoURL,
      })),
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error getting discoverable users:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get discoverable users";
    const status = message.includes("not a member") ? 403 : 500;

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
