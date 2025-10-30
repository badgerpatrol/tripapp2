"use server";

import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/server/authz";
import { logEvent } from "@/server/eventLog";
import {
  AuthTokenSchema,
  SignUpResponseSchema,
  type SignUpResponse,
  type UserProfile,
} from "@/types/schemas";
import { EventType } from "@/lib/generated/prisma";

/**
 * Syncs a Firebase user to the Prisma database.
 * This should be called after successful Firebase authentication.
 * It's idempotent - safe to call multiple times for the same user.
 *
 * @param idToken - Firebase ID token from the authenticated user
 * @returns User profile if successful, error message if failed
 */
export async function syncUserToDatabase(
  idToken: string
): Promise<SignUpResponse> {
  try {
    // Validate input
    const validation = AuthTokenSchema.safeParse({ idToken });
    if (!validation.success) {
      return {
        success: false,
        error: "Invalid authentication token",
      };
    }

    // Verify the Firebase token
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return {
        success: false,
        error: "Invalid or expired authentication token",
      };
    }

    const { uid, email, name, picture, phone_number } = decodedToken;

    if (!email) {
      return {
        success: false,
        error: "Email is required for authentication",
      };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { id: uid },
    });

    let user;
    let isNewUser = false;

    if (existingUser) {
      // Update existing user (in case profile changed in Firebase)
      user = await prisma.user.update({
        where: { id: uid },
        data: {
          email,
          displayName: name || existingUser.displayName,
          photoURL: picture || existingUser.photoURL,
          phoneNumber: phone_number || existingUser.phoneNumber,
          updatedAt: new Date(),
        },
      });

      // Log sign in event
      await logEvent("User", uid, EventType.USER_SIGNED_IN, uid, {
        email,
        method: "email/password",
      });
    } else {
      // Create new user
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          id: uid,
          email,
          displayName: name || null,
          photoURL: picture || null,
          phoneNumber: phone_number || null,
          timezone: "UTC",
          language: "en",
          defaultCurrency: "GBP",
        },
      });

      // Log sign up event
      await logEvent("User", uid, EventType.USER_CREATED, uid, {
        email,
        method: "email/password",
      });
    }

    // Prepare response
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
      role: user.role,
      subscription: user.subscription,
      timezone: user.timezone || "UTC",
      language: user.language || "en",
      defaultCurrency: user.defaultCurrency || "USD",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      success: true,
      user: userProfile,
    };
  } catch (error) {
    console.error("Error syncing user to database:", error);
    return {
      success: false,
      error: "Failed to sync user profile. Please try again.",
    };
  }
}

/**
 * Gets a user profile from the database.
 *
 * @param idToken - Firebase ID token from the authenticated user
 * @returns User profile if found, error message if failed
 */
export async function getUserProfile(
  idToken: string
): Promise<SignUpResponse> {
  try {
    // Validate input
    const validation = AuthTokenSchema.safeParse({ idToken });
    if (!validation.success) {
      return {
        success: false,
        error: "Invalid authentication token",
      };
    }

    // Verify the Firebase token
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return {
        success: false,
        error: "Invalid or expired authentication token",
      };
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found in database",
      };
    }

    // Prepare response
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
      role: user.role,
      subscription: user.subscription,
      timezone: user.timezone || "UTC",
      language: user.language || "en",
      defaultCurrency: user.defaultCurrency || "USD",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      success: true,
      user: userProfile,
    };
  } catch (error) {
    console.error("Error getting user profile:", error);
    return {
      success: false,
      error: "Failed to get user profile. Please try again.",
    };
  }
}
