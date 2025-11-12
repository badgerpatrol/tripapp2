import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import { resetUserPassword } from "@/server/services/admin";
import { PasswordResetSchema, PasswordResetResponseSchema } from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";

/**
 * POST /api/admin/users/[userId]/password
 * Resets a user's password.
 * Admin-only endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Await params
    const { userId } = await params;

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
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = PasswordResetSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || "Invalid password data",
        },
        { status: 400 }
      );
    }

    // 3. Reset password
    await resetUserPassword(auth.uid, userId, validation.data.newPassword);

    // 4. Return response
    const response = PasswordResetResponseSchema.parse({
      success: true,
      message: "Password reset successfully",
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error resetting password:", error);

    if (error.message === "User not found") {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (
      error.message === "You cannot reset your own password through the admin panel" ||
      error.message === "Password must be at least 6 characters long"
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (error.message?.includes("Forbidden") || error.message?.includes("role required")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset password. Please try again.",
      },
      { status: 500 }
    );
  }
}
