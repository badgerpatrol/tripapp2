import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import { listAllUsers } from "@/server/services/admin";
import { ListUsersResponseSchema } from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";

/**
 * GET /api/admin/users
 * Lists all users in the system.
 * Admin-only endpoint.
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

    // Require ADMIN role to access user management
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Get all users
    const users = await listAllUsers();

    // 3. Return response
    const response = {
      success: true,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName || "",
        photoURL: u.photoURL,
        phoneNumber: u.phoneNumber,
        role: u.role,
        subscription: u.subscription,
        timezone: u.timezone || "UTC",
        language: u.language || "en",
        defaultCurrency: u.defaultCurrency || "GBP",
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        tripCount: u.tripCount,
        groupCount: u.groupCount,
        deletedAt: u.deletedAt,
      })),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error listing users:", error);

    // Handle authorization errors
    if (error.message?.includes("Forbidden") || error.message?.includes("role required")) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied. Admin privileges required.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to list users. Please try again.",
      },
      { status: 500 }
    );
  }
}
