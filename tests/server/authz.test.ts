import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAuthErrorMessage } from "@/components/LoginForm";
import {
  requireAuth,
  requireTripMember,
  requireUserRole,
  hasUserRole,
  isAdmin,
  isSuperAdmin,
  hasRole,
  isTripOwner,
} from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { UserRole, TripMemberRole } from "@/lib/generated/prisma";

describe("Authorization Helpers", () => {
  const testUserId = "test-user-123";
  const testAdminId = "test-admin-456";
  const testSuperAdminId = "test-superadmin-789";
  const testTripId = "test-trip-abc";

  beforeEach(async () => {
    // Clean up test data
    await prisma.tripMember.deleteMany({
      where: { userId: { in: [testUserId, testAdminId, testSuperAdminId] } },
    });
    await prisma.trip.deleteMany({ where: { id: testTripId } });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testAdminId, testSuperAdminId] } },
    });

    // Create test users
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "user@test.com",
        role: UserRole.USER,
      },
    });

    await prisma.user.create({
      data: {
        id: testAdminId,
        email: "admin@test.com",
        role: UserRole.ADMIN,
      },
    });

    await prisma.user.create({
      data: {
        id: testSuperAdminId,
        email: "superadmin@test.com",
        role: UserRole.SUPERADMIN,
      },
    });

    // Create test trip
    await prisma.trip.create({
      data: {
        id: testTripId,
        name: "Test Trip",
        createdById: testUserId,
        members: {
          create: [
            {
              userId: testUserId,
              role: TripMemberRole.OWNER,
            },
            {
              userId: testAdminId,
              role: TripMemberRole.MEMBER,
            },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.tripMember.deleteMany({
      where: { userId: { in: [testUserId, testAdminId, testSuperAdminId] } },
    });
    await prisma.trip.deleteMany({ where: { id: testTripId } });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testAdminId, testSuperAdminId] } },
    });
  });

  describe("requireAuth", () => {
    it("should return user if exists", async () => {
      const user = await requireAuth(testUserId);
      expect(user.id).toBe(testUserId);
      expect(user.email).toBe("user@test.com");
    });

    it("should throw error if user does not exist", async () => {
      await expect(requireAuth("non-existent-user")).rejects.toThrow(
        "Authentication required: User not found"
      );
    });
  });

  describe("requireUserRole", () => {
    it("should allow USER role when USER is required", async () => {
      const user = await requireUserRole(testUserId, UserRole.USER);
      expect(user.id).toBe(testUserId);
    });

    it("should allow ADMIN role when USER is required", async () => {
      const user = await requireUserRole(testAdminId, UserRole.USER);
      expect(user.id).toBe(testAdminId);
    });

    it("should allow ADMIN role when ADMIN is required", async () => {
      const user = await requireUserRole(testAdminId, UserRole.ADMIN);
      expect(user.id).toBe(testAdminId);
    });

    it("should throw error when USER tries to access ADMIN-only resource", async () => {
      await expect(
        requireUserRole(testUserId, UserRole.ADMIN)
      ).rejects.toThrow("Forbidden: ADMIN role required");
    });

    it("should allow SUPERADMIN to access everything", async () => {
      await expect(
        requireUserRole(testSuperAdminId, UserRole.ADMIN)
      ).resolves.toBeTruthy();
      await expect(
        requireUserRole(testSuperAdminId, UserRole.USER)
      ).resolves.toBeTruthy();
    });
  });

  describe("hasUserRole", () => {
    it("should return true if user has required role", async () => {
      expect(await hasUserRole(testAdminId, UserRole.ADMIN)).toBe(true);
    });

    it("should return false if user lacks required role", async () => {
      expect(await hasUserRole(testUserId, UserRole.ADMIN)).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("should return true for admin user", async () => {
      expect(await isAdmin(testAdminId)).toBe(true);
    });

    it("should return true for superadmin user", async () => {
      expect(await isAdmin(testSuperAdminId)).toBe(true);
    });

    it("should return false for regular user", async () => {
      expect(await isAdmin(testUserId)).toBe(false);
    });
  });

  describe("isSuperAdmin", () => {
    it("should return true for superadmin user", async () => {
      expect(await isSuperAdmin(testSuperAdminId)).toBe(true);
    });

    it("should return false for admin user", async () => {
      expect(await isSuperAdmin(testAdminId)).toBe(false);
    });

    it("should return false for regular user", async () => {
      expect(await isSuperAdmin(testUserId)).toBe(false);
    });
  });

  describe("requireTripMember", () => {
    it("should allow trip member to access trip", async () => {
      const membership = await requireTripMember(testUserId, testTripId);
      expect(membership.userId).toBe(testUserId);
      expect(membership.tripId).toBe(testTripId);
    });

    it("should throw error if user is not a trip member", async () => {
      await expect(
        requireTripMember(testSuperAdminId, testTripId)
      ).rejects.toThrow("Forbidden: You are not a member of this trip");
    });

    it("should allow OWNER when ADMIN role is required", async () => {
      await expect(
        requireTripMember(testUserId, testTripId, TripMemberRole.ADMIN)
      ).resolves.toBeTruthy();
    });

    it("should throw error when MEMBER tries to access ADMIN-only action", async () => {
      await expect(
        requireTripMember(testAdminId, testTripId, TripMemberRole.ADMIN)
      ).rejects.toThrow("Forbidden: ADMIN role required");
    });
  });

  describe("hasRole", () => {
    it("should return true if user has required trip role", async () => {
      expect(
        await hasRole(testUserId, testTripId, TripMemberRole.OWNER)
      ).toBe(true);
    });

    it("should return false if user lacks required trip role", async () => {
      expect(
        await hasRole(testAdminId, testTripId, TripMemberRole.OWNER)
      ).toBe(false);
    });
  });

  describe("isTripOwner", () => {
    it("should return true for trip owner", async () => {
      expect(await isTripOwner(testUserId, testTripId)).toBe(true);
    });

    it("should return false for non-owner member", async () => {
      expect(await isTripOwner(testAdminId, testTripId)).toBe(false);
    });

    it("should return false for non-member", async () => {
      expect(await isTripOwner(testSuperAdminId, testTripId)).toBe(false);
    });
  });

  describe("getAuthErrorMessage", () => {
    it("should return user-friendly message for email-already-in-use", () => {
      const error = {
        code: "auth/email-already-in-use",
        message: "Firebase: Error (auth/email-already-in-use).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("already exists");
    });

    it("should return user-friendly message for wrong-password", () => {
      const error = {
        code: "auth/wrong-password",
        message: "Firebase: Error (auth/wrong-password).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("Incorrect password");
    });

    it("should return user-friendly message for user-not-found", () => {
      const error = {
        code: "auth/user-not-found",
        message: "Firebase: Error (auth/user-not-found).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("No account found");
    });

    it("should return user-friendly message for invalid-email", () => {
      const error = {
        code: "auth/invalid-email",
        message: "Firebase: Error (auth/invalid-email).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("Invalid email");
    });

    it("should return user-friendly message for weak-password", () => {
      const error = {
        code: "auth/weak-password",
        message: "Firebase: Error (auth/weak-password).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("too weak");
    });

    it("should return user-friendly message for too-many-requests", () => {
      const error = {
        code: "auth/too-many-requests",
        message: "Firebase: Error (auth/too-many-requests).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("Too many failed attempts");
    });

    it("should return user-friendly message for network-request-failed", () => {
      const error = {
        code: "auth/network-request-failed",
        message: "Firebase: Error (auth/network-request-failed).",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("Network error");
    });

    it("should return default message for unknown error code", () => {
      const error = {
        code: "auth/unknown-error",
        message: "Unknown error occurred",
      } as any;

      const message = getAuthErrorMessage(error);
      expect(message).toContain("Unknown error occurred");
    });
  });
});
