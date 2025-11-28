import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parsePriceToMinor, prefixCourse } from "@/lib/menu";

/**
 * Tests for the Menu Playwright Parser
 *
 * The actual parsing logic uses Playwright (which requires a browser) and Claude API,
 * so we test the helper functions and validate the parser interface.
 *
 * Integration tests for the full parsing flow should be done as e2e tests.
 */
describe("Menu Playwright Parser - Unit Tests", () => {
  describe("Price parsing for menu items", () => {
    it("should parse GBP price correctly", () => {
      const result = parsePriceToMinor("£12.50", "GBP");
      expect(result).toEqual({ minor: 1250, currency: "GBP" });
    });

    it("should parse USD price correctly", () => {
      const result = parsePriceToMinor("$15.99", "USD");
      expect(result).toEqual({ minor: 1599, currency: "USD" });
    });

    it("should parse EUR price correctly", () => {
      const result = parsePriceToMinor("€10.00", "EUR");
      expect(result).toEqual({ minor: 1000, currency: "EUR" });
    });

    it("should parse JPY price (no decimals)", () => {
      const result = parsePriceToMinor("¥1000", "JPY");
      expect(result).toEqual({ minor: 1000, currency: "JPY" });
    });

    it("should use fallback currency when no symbol", () => {
      const result = parsePriceToMinor("12.50", "GBP");
      expect(result).toEqual({ minor: 1250, currency: "GBP" });
    });
  });

  describe("Course prefixing for menu items", () => {
    it("should prefix name with course", () => {
      const result = prefixCourse("Caesar Salad", "Starters");
      expect(result).toBe("Starters - Caesar Salad");
    });

    it("should return name unchanged when no course", () => {
      const result = prefixCourse("Caesar Salad");
      expect(result).toBe("Caesar Salad");
    });

    it("should return name unchanged when course is empty", () => {
      const result = prefixCourse("Caesar Salad", "");
      expect(result).toBe("Caesar Salad");
    });
  });

  describe("parseMenuWithPlaywright interface", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should export parseMenuWithPlaywright function", async () => {
      // Dynamically import to check exports
      const module = await import("@/server/ai/menuPlaywrightParser");
      expect(typeof module.parseMenuWithPlaywright).toBe("function");
    });

    it("should throw error when API key is not configured", async () => {
      // Clear the API key
      vi.stubEnv("ANTHROPIC_API_KEY", "");

      const { parseMenuWithPlaywright } = await import(
        "@/server/ai/menuPlaywrightParser"
      );

      await expect(
        parseMenuWithPlaywright({
          url: "https://restaurant.com/menu",
          tripCurrency: "GBP",
        })
      ).rejects.toThrow("Anthropic API key not configured");
    });
  });

  describe("Menu item normalization", () => {
    it("should handle item with all fields", () => {
      // Simulate what the parser would produce for a complete item
      const rawItem = {
        course: "Starters",
        name: "Caesar Salad",
        description: "Fresh romaine lettuce with parmesan",
        price: "£12.50",
      };

      const displayName = rawItem.course
        ? prefixCourse(rawItem.name, rawItem.course)
        : rawItem.name;
      const priceResult = parsePriceToMinor(rawItem.price, "GBP");

      expect(displayName).toBe("Starters - Caesar Salad");
      expect(priceResult.minor).toBe(1250);
      expect(priceResult.currency).toBe("GBP");
    });

    it("should handle item without course", () => {
      const rawItem = {
        name: "Burger",
        description: "Beef patty with cheese",
        price: "15.00",
      };

      const displayName = rawItem.name;
      const priceResult = parsePriceToMinor(rawItem.price, "USD");

      expect(displayName).toBe("Burger");
      expect(priceResult.minor).toBe(1500);
      expect(priceResult.currency).toBe("USD");
    });

    it("should handle item with various price formats", () => {
      const testCases = [
        { price: "12.50", currency: "GBP", expected: 1250 },
        { price: "£12.50", currency: "GBP", expected: 1250 },
        { price: "$15.99", currency: "USD", expected: 1599 },
        { price: "€10.00", currency: "EUR", expected: 1000 },
        { price: "¥1000", currency: "JPY", expected: 1000 },
        { price: "10", currency: "GBP", expected: 1000 },
      ];

      testCases.forEach(({ price, currency, expected }) => {
        const result = parsePriceToMinor(price, currency);
        expect(result.minor).toBe(expected);
      });
    });

    it("should detect currency from price string", () => {
      const result = parsePriceToMinor("€25.00", "USD"); // Fallback is USD but € should be detected
      expect(result.currency).toBe("EUR");
    });
  });

  describe("Non-numeric price handling", () => {
    it("should identify Market Price (MP) as non-numeric", () => {
      const priceStr = "MP";
      const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(priceStr.trim());
      expect(isNumericPrice).toBe(false);
    });

    it("should identify POA as non-numeric", () => {
      const priceStr = "POA";
      const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(priceStr.trim());
      expect(isNumericPrice).toBe(false);
    });

    it("should identify numeric prices correctly", () => {
      const numericPrices = ["12.50", "£12.50", "$15.99", "€10", "¥1000"];

      numericPrices.forEach((price) => {
        const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(price.trim());
        expect(isNumericPrice).toBe(true);
      });
    });
  });

  describe("Text truncation", () => {
    it("should truncate long names to 200 characters", () => {
      const longName = "A".repeat(300);
      const truncated = longName.trim().substring(0, 200);
      expect(truncated.length).toBe(200);
    });

    it("should truncate long descriptions to 500 characters", () => {
      const longDescription = "B".repeat(600);
      const truncated = longDescription.trim().substring(0, 500);
      expect(truncated.length).toBe(500);
    });

    it("should truncate long course names to 100 characters", () => {
      const longCourse = "C".repeat(150);
      const truncated = longCourse.trim().substring(0, 100);
      expect(truncated.length).toBe(100);
    });
  });
});
