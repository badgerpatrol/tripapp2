import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireUserRole } from "@/server/authz";
import { listAllUsers } from "@/server/services/admin";
import { ListUsersResponseSchema, SignUpSchema } from "@/types/schemas";
import { UserRole } from "@/lib/generated/prisma";
import { adminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/server/eventLog";
import { EventType } from "@/lib/generated/prisma";

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

/**
 * POST /api/admin/users
 * Creates a new user account.
 * Admin-only endpoint.
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

    // Require ADMIN role to create users
    await requireUserRole(auth.uid, UserRole.ADMIN);

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = SignUpSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    const { email, password, displayName } = validation.data;

    // 3. Create user in Firebase Auth
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.createUser({
        email,
        password,
        displayName: displayName || undefined,
      });
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { success: false, error: "A user with this email already exists" },
          { status: 400 }
        );
      }
      throw firebaseError;
    }

    // 4. Create user in database
    const user = await prisma.user.create({
      data: {
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: displayName || "",
        photoURL: null,
        phoneNumber: null,
        role: UserRole.USER,
        subscription: "FREE",
        timezone: "UTC",
        language: "en",
        defaultCurrency: "GBP",
      },
    });

    // 5. Log event
    await logEvent("User", user.id, EventType.USER_CREATED, auth.uid, {
      createdBy: "admin",
      email: user.email,
      displayName: user.displayName,
    });

    // 6. Return response
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);

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
        error: error.message || "Failed to create user. Please try again.",
      },
      { status: 500 }
    );
  }
}
