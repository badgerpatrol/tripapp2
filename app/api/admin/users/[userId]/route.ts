import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import {
  getUserById,
  updateUserRole,
  updateUserInfo,
  deactivateUser,
  reactivateUser,
} from "@/server/services/admin";
import {
  UserRoleUpdateSchema,
  UserInfoUpdateSchema,
  GetUserResponseSchema,
  UpdateUserRoleResponseSchema,
  UpdateUserInfoResponseSchema,
  DeactivateUserResponseSchema,
} from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";

/**
 * GET /api/admin/users/[userId]
 * Gets detailed information about a specific user.
 * Admin-only endpoint.
 */
export async function GET(
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

    // 2. Get user details
    const user = await getUserById(userId);

    // 3. Return response
    const response = GetUserResponseSchema.parse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        role: user.role,
        subscription: user.subscription,
        timezone: user.timezone || "UTC",
        language: user.language || "en",
        defaultCurrency: user.defaultCurrency || "GBP",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        tripCount: user.tripCount,
        groupCount: user.groupCount,
        createdTripCount: user.createdTripCount,
        ownedGroupCount: user.ownedGroupCount,
        deletedAt: user.deletedAt,
      },
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error getting user:", error);

    if (error.message === "User not found") {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (error.message?.includes("Forbidden") || error.message?.includes("role required")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to get user. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[userId]
 * Updates a user's role or information.
 * Admin-only endpoint.
 */
export async function PATCH(
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

    // Check if this is a role update or info update
    if (body.role !== undefined) {
      // Role update
      const validation = UserRoleUpdateSchema.safeParse(body);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        return NextResponse.json(
          {
            success: false,
            error: firstError?.message || "Invalid role data",
          },
          { status: 400 }
        );
      }

      const updatedUser = await updateUserRole(
        auth.uid,
        userId,
        validation.data
      );

      const response = UpdateUserRoleResponseSchema.parse({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.displayName || "",
          photoURL: updatedUser.photoURL,
          phoneNumber: updatedUser.phoneNumber,
          role: updatedUser.role,
          subscription: updatedUser.subscription,
          timezone: updatedUser.timezone || "UTC",
          language: updatedUser.language || "en",
          defaultCurrency: updatedUser.defaultCurrency || "GBP",
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          tripCount: 0, // Not fetched in update
          groupCount: 0, // Not fetched in update
        },
      });

      return NextResponse.json(response, { status: 200 });
    } else {
      // Info update
      const validation = UserInfoUpdateSchema.safeParse(body);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        return NextResponse.json(
          {
            success: false,
            error: firstError?.message || "Invalid user data",
          },
          { status: 400 }
        );
      }

      const updatedUser = await updateUserInfo(
        auth.uid,
        userId,
        validation.data
      );

      const response = UpdateUserInfoResponseSchema.parse({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.displayName || "",
          photoURL: updatedUser.photoURL,
          phoneNumber: updatedUser.phoneNumber,
          role: updatedUser.role,
          subscription: updatedUser.subscription,
          timezone: updatedUser.timezone || "UTC",
          language: updatedUser.language || "en",
          defaultCurrency: updatedUser.defaultCurrency || "GBP",
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          tripCount: 0, // Not fetched in update
          groupCount: 0, // Not fetched in update
        },
      });

      return NextResponse.json(response, { status: 200 });
    }
  } catch (error: any) {
    console.error("Error updating user:", error);

    if (error.message === "User not found") {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (
      error.message === "You cannot change your own role" ||
      error.message === "You cannot deactivate your own account"
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
      { success: false, error: "Failed to update user. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Soft-deletes (deactivates) a user.
 * Admin-only endpoint.
 */
export async function DELETE(
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

    // 2. Check if this is a reactivation request (query param)
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "reactivate") {
      await reactivateUser(auth.uid, userId);
      const response = DeactivateUserResponseSchema.parse({
        success: true,
        message: "User reactivated successfully",
      });
      return NextResponse.json(response, { status: 200 });
    }

    // 3. Deactivate user
    await deactivateUser(auth.uid, userId);

    // 4. Return response
    const response = DeactivateUserResponseSchema.parse({
      success: true,
      message: "User deactivated successfully",
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error deactivating user:", error);

    if (error.message === "User not found") {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (
      error.message === "You cannot deactivate your own account" ||
      error.message === "User is already deactivated" ||
      error.message === "User is not deactivated"
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
        error: "Failed to deactivate user. Please try again.",
      },
      { status: 500 }
    );
  }
}
