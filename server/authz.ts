import { adminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { TripMemberRole, UserRole } from "@/lib/generated/prisma";

// ============================================================================
// Auth & Authorization Helpers
// ============================================================================

/**
 * Verifies a Firebase ID token and returns the decoded token.
 * Throws an error if the token is invalid or expired.
 */
export async function verifyIdToken(idToken: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid or expired authentication token");
  }
}

/**
 * Gets a user from the database by Firebase UID.
 * Throws an error if the user doesn't exist.
 */
export async function getUserByUid(uid: string) {
  const user = await prisma.user.findUnique({
    where: { id: uid },
  });

  if (!user) {
    throw new Error("User not found in database");
  }

  return user;
}

/**
 * Verifies that a user exists in the database.
 * Throws an error with a clear message if authentication fails.
 */
export async function requireAuth(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Authentication required: User not found");
  }

  return user;
}

/**
 * Verifies that a user is a member of a trip with an optional minimum role.
 * Throws an error if the user is not authorized.
 *
 * @param userId - Firebase UID of the user
 * @param tripId - ID of the trip to check membership
 * @param minRole - Optional minimum role required (defaults to MEMBER)
 */
export async function requireTripMember(
  userId: string,
  tripId: string,
  minRole?: TripMemberRole
) {
  // First verify user exists
  await requireAuth(userId);

  // Check trip membership
  const membership = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden: You are not a member of this trip");
  }

  // Check role if specified
  if (minRole) {
    const roleHierarchy = {
      [TripMemberRole.VIEWER]: 0,
      [TripMemberRole.MEMBER]: 1,
      [TripMemberRole.ADMIN]: 2,
      [TripMemberRole.OWNER]: 3,
    };

    const userRoleLevel = roleHierarchy[membership.role];
    const requiredRoleLevel = roleHierarchy[minRole];

    if (userRoleLevel < requiredRoleLevel) {
      throw new Error(
        `Forbidden: ${minRole} role required for this action`
      );
    }
  }

  return membership;
}

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Returns the decoded token if valid, null if no token provided.
 * Throws an error if token is invalid.
 */
export async function getAuthTokenFromHeader(
  authHeader: string | null
): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.substring(7);
  const decodedToken = await verifyIdToken(idToken);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
  };
}

/**
 * Checks if a user has a specific role or higher in a trip.
 */
export async function hasRole(
  userId: string,
  tripId: string,
  requiredRole: TripMemberRole
): Promise<boolean> {
  try {
    await requireTripMember(userId, tripId, requiredRole);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a user is the owner of a trip.
 */
export async function isTripOwner(
  userId: string,
  tripId: string
): Promise<boolean> {
  const membership = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
  });

  return membership?.role === TripMemberRole.OWNER;
}

/**
 * Requires a user to have a specific global role.
 * Throws an error if the user doesn't have the required role.
 *
 * @param userId - Firebase UID of the user
 * @param minRole - Minimum required global role (defaults to USER)
 */
export async function requireUserRole(
  userId: string,
  minRole: UserRole = UserRole.USER
) {
  const user = await requireAuth(userId);

  const roleHierarchy = {
    [UserRole.USER]: 0,
    [UserRole.ADMIN]: 1,
    [UserRole.SUPERADMIN]: 2,
  };

  const userRoleLevel = roleHierarchy[user.role];
  const requiredRoleLevel = roleHierarchy[minRole];

  if (userRoleLevel < requiredRoleLevel) {
    throw new Error(
      `Forbidden: ${minRole} role required for this action`
    );
  }

  return user;
}

/**
 * Checks if a user has a specific global role or higher.
 */
export async function hasUserRole(
  userId: string,
  requiredRole: UserRole
): Promise<boolean> {
  try {
    await requireUserRole(userId, requiredRole);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a user is an admin (global role).
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasUserRole(userId, UserRole.ADMIN);
}

/**
 * Checks if a user is a superadmin (global role).
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  return hasUserRole(userId, UserRole.SUPERADMIN);
}
