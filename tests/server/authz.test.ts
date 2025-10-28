import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuthErrorMessage } from "@/components/LoginForm";

describe("Authorization Helpers", () => {
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
