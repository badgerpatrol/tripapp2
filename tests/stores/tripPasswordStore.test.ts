import { describe, it, expect, beforeEach } from "vitest";
import { useTripPasswordStore } from "@/lib/stores/tripPasswordStore";

describe("useTripPasswordStore", () => {
  beforeEach(() => {
    // Reset the store state before each test
    useTripPasswordStore.getState().clearTripPassword();
  });

  describe("setTripPassword", () => {
    it("stores password with trip ID", () => {
      const { setTripPassword, getTripPassword } = useTripPasswordStore.getState();

      setTripPassword("trip-123", "secret-password");

      expect(getTripPassword("trip-123")).toBe("secret-password");
    });

    it("overwrites previous password", () => {
      const { setTripPassword, getTripPassword } = useTripPasswordStore.getState();

      setTripPassword("trip-123", "old-password");
      setTripPassword("trip-123", "new-password");

      expect(getTripPassword("trip-123")).toBe("new-password");
    });

    it("stores password for different trip", () => {
      const { setTripPassword, getTripPassword } = useTripPasswordStore.getState();

      setTripPassword("trip-123", "password-123");
      setTripPassword("trip-456", "password-456");

      // Only the most recent trip's password should be stored
      expect(getTripPassword("trip-456")).toBe("password-456");
      expect(getTripPassword("trip-123")).toBeNull();
    });
  });

  describe("getTripPassword", () => {
    it("returns null when no password is stored", () => {
      const { getTripPassword } = useTripPasswordStore.getState();

      expect(getTripPassword("trip-123")).toBeNull();
    });

    it("returns null for different trip ID", () => {
      const { setTripPassword, getTripPassword } = useTripPasswordStore.getState();

      setTripPassword("trip-123", "secret-password");

      expect(getTripPassword("trip-456")).toBeNull();
    });

    it("returns password for matching trip ID", () => {
      const { setTripPassword, getTripPassword } = useTripPasswordStore.getState();

      setTripPassword("trip-abc", "my-password");

      expect(getTripPassword("trip-abc")).toBe("my-password");
    });
  });

  describe("clearTripPassword", () => {
    it("clears stored password", () => {
      const { setTripPassword, getTripPassword, clearTripPassword } = useTripPasswordStore.getState();

      setTripPassword("trip-123", "secret-password");
      expect(getTripPassword("trip-123")).toBe("secret-password");

      clearTripPassword();

      expect(getTripPassword("trip-123")).toBeNull();
    });
  });
});
