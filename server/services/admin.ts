import { prisma } from "@/lib/prisma";
import { UserRole, EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import { adminAuth } from "@/lib/firebase/admin";
import type { UserRoleUpdate } from "@/types/schemas";

// ============================================================================
// User Management Operations (Admin-only)
// ============================================================================

/**
 * Lists all users in the system with their basic information.
 * Admin-only function.
 */
export async function listAllUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      photoURL: true,
      phoneNumber: true,
      role: true,
      subscription: true,
      timezone: true,
      language: true,
      defaultCurrency: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      _count: {
        select: {
          tripMemberships: true,
          groupMemberships: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Map to include trip and group counts
  return users.map((user) => ({
    ...user,
    tripCount: user._count.tripMemberships,
    groupCount: user._count.groupMemberships,
  }));
}

/**
 * Gets a single user by ID with detailed information.
 * Admin-only function.
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          tripMemberships: true,
          groupMemberships: true,
          tripsCreated: true,
          groupsOwned: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    ...user,
    tripCount: user._count.tripMemberships,
    groupCount: user._count.groupMemberships,
    createdTripCount: user._count.tripsCreated,
    ownedGroupCount: user._count.groupsOwned,
  };
}

/**
 * Updates a user's role.
 * Admin-only function.
 * Only ADMIN users can promote/demote between USER and ADMIN.
 * SUPERADMIN promotion requires SUPERADMIN privileges (handled at auth layer).
 */
export async function updateUserRole(
  adminUserId: string,
  targetUserId: string,
  data: UserRoleUpdate
) {
  // Prevent self-demotion
  if (adminUserId === targetUserId) {
    throw new Error("You cannot change your own role");
  }

  // Get target user
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Update the role
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      role: data.role,
    },
  });

  // Log event
  await logEvent("User", targetUserId, EventType.USER_UPDATED, adminUserId, {
    field: "role",
    oldValue: user.role,
    newValue: data.role,
  });

  return updatedUser;
}

/**
 * Updates a user's basic information.
 * Admin-only function.
 */
export async function updateUserInfo(
  adminUserId: string,
  targetUserId: string,
  data: {
    displayName?: string;
    phoneNumber?: string | null;
    timezone?: string;
    language?: string;
    defaultCurrency?: string;
  }
) {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.language !== undefined && { language: data.language }),
      ...(data.defaultCurrency !== undefined && {
        defaultCurrency: data.defaultCurrency,
      }),
    },
  });

  // Log event
  await logEvent("User", targetUserId, EventType.USER_UPDATED, adminUserId, {
    updatedFields: Object.keys(data),
  });

  return updatedUser;
}

/**
 * Soft-deletes a user by setting deletedAt timestamp.
 * Admin-only function.
 * This preserves data integrity by not hard-deleting.
 */
export async function deactivateUser(adminUserId: string, targetUserId: string) {
  // Prevent self-deactivation
  if (adminUserId === targetUserId) {
    throw new Error("You cannot deactivate your own account");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.deletedAt) {
    throw new Error("User is already deactivated");
  }

  // Soft delete by setting deletedAt
  const deactivatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      deletedAt: new Date(),
    },
  });

  // Log event
  await logEvent("User", targetUserId, EventType.USER_UPDATED, adminUserId, {
    action: "deactivated",
    email: user.email,
    displayName: user.displayName,
  });

  return deactivatedUser;
}

/**
 * Reactivates a soft-deleted user by clearing deletedAt.
 * Admin-only function.
 */
export async function reactivateUser(adminUserId: string, targetUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.deletedAt) {
    throw new Error("User is not deactivated");
  }

  const reactivatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      deletedAt: null,
    },
  });

  // Log event
  await logEvent("User", targetUserId, EventType.USER_CREATED, adminUserId, {
    action: "reactivated",
    email: user.email,
    displayName: user.displayName,
  });

  return reactivatedUser;
}

/**
 * Searches users by email or display name.
 * Admin-only function.
 */
export async function searchUsers(query: string) {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          email: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          displayName: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      photoURL: true,
      role: true,
      subscription: true,
      createdAt: true,
    },
    take: 50, // Limit results
    orderBy: {
      email: "asc",
    },
  });

  return users;
}

/**
 * Resets a user's password.
 * Admin-only function.
 * Uses Firebase Admin SDK to update the password directly.
 */
export async function resetUserPassword(
  adminUserId: string,
  targetUserId: string,
  newPassword: string
) {
  console.log('[resetUserPassword] Starting password reset for user:', targetUserId);

  // Prevent self-password reset through admin panel
  if (adminUserId === targetUserId) {
    throw new Error("You cannot reset your own password through the admin panel");
  }

  // Validate password length
  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Get target user
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  console.log('[resetUserPassword] User found in database:', user.email);

  // Update password using Firebase Admin SDK
  try {
    console.log('[resetUserPassword] Attempting to update password in Firebase for userId:', targetUserId);
    await adminAuth.updateUser(targetUserId, {
      password: newPassword,
    });
    console.log('[resetUserPassword] Password updated successfully in Firebase');
  } catch (firebaseError: any) {
    console.error("Firebase Admin SDK error:", firebaseError);
    console.error("Firebase error code:", firebaseError.code);
    console.error("Firebase error message:", firebaseError.message);

    // If user doesn't exist in Firebase, create them
    if (firebaseError.code === 'auth/user-not-found') {
      console.log('[resetUserPassword] User not found in Firebase, creating new Firebase user...');
      try {
        await adminAuth.createUser({
          uid: targetUserId,
          email: user.email,
          password: newPassword,
          displayName: user.displayName || undefined,
          phoneNumber: user.phoneNumber || undefined,
        });
        console.log('[resetUserPassword] Firebase user created successfully with new password');
      } catch (createError: any) {
        console.error("Failed to create Firebase user:", createError);
        throw new Error(`Failed to create Firebase user: ${createError.message}`);
      }
    } else {
      throw new Error(`Failed to update password in Firebase: ${firebaseError.message}`);
    }
  }

  // Log event
  await logEvent("User", targetUserId, EventType.USER_UPDATED, adminUserId, {
    action: "password_reset",
    email: user.email,
  });

  return { success: true };
}
