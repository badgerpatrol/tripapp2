import { describe, it, expect } from "vitest";
import {
  SignUpSchema,
  SignInSchema,
  AuthTokenSchema,
  UserProfileSchema,
} from "@/types/schemas";
import { UserRole, SubscriptionTier } from "@/lib/generated/prisma";

describe("Auth Schemas", () => {
  describe("SignUpSchema", () => {
    it("should validate correct sign up data", () => {
      const validData = {
        email: "test@example.com",
        password: "password123",
        displayName: "Test User",
      };

      const result = SignUpSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidData = {
        email: "not-an-email",
        password: "password123",
      };

      const result = SignUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const firstError = result.error.issues?.[0] || result.error.errors?.[0];
        expect(firstError?.message).toContain("Invalid email");
      }
    });

    it("should reject short password", () => {
      const invalidData = {
        email: "test@example.com",
        password: "12345",
      };

      const result = SignUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const firstError = result.error.issues?.[0] || result.error.errors?.[0];
        expect(firstError?.message).toContain("at least 6");
      }
    });

    it("should allow sign up without display name", () => {
      const validData = {
        email: "test@example.com",
        password: "password123",
      };

      const result = SignUpSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe("SignInSchema", () => {
    it("should validate correct sign in data", () => {
      const validData = {
        email: "test@example.com",
        password: "password123",
      };

      const result = SignInSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidData = {
        email: "not-an-email",
        password: "password123",
      };

      const result = SignInSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const invalidData = {
        email: "test@example.com",
        password: "12345",
      };

      const result = SignInSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("AuthTokenSchema", () => {
    it("should validate non-empty token", () => {
      const validData = {
        idToken: "valid-token-string",
      };

      const result = AuthTokenSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject empty token", () => {
      const invalidData = {
        idToken: "",
      };

      const result = AuthTokenSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("UserProfileSchema", () => {
    it("should validate complete user profile", () => {
      const validData = {
        id: "user123",
        email: "test@example.com",
        displayName: "Test User",
        photoURL: "https://example.com/photo.jpg",
        phoneNumber: "+1234567890",
        role: UserRole.USER,
        subscription: SubscriptionTier.FREE,
        timezone: "America/New_York",
        language: "en",
        defaultCurrency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = UserProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate user profile with nullable fields", () => {
      const validData = {
        id: "user123",
        email: "test@example.com",
        displayName: null,
        photoURL: null,
        phoneNumber: null,
        role: UserRole.ADMIN,
        subscription: SubscriptionTier.PREMIUM,
        timezone: "UTC",
        language: "en",
        defaultCurrency: "USD",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = UserProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
