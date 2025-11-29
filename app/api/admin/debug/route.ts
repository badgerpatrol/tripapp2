import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import { UserRole } from "@/lib/generated/prisma";

/**
 * GET /api/admin/debug
 * Returns debug information including environment variables.
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

    // Require ADMIN role to access debug info
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Gather debug information
    const databaseUrl = process.env.DATABASE_URL || "Not set";

    const response = {
      success: true,
      debug: {
        databaseUrl,
        nodeEnv: process.env.NODE_ENV || "Not set",
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching debug info:", error);

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
        error: "Failed to fetch debug info. Please try again.",
      },
      { status: 500 }
    );
  }
}
