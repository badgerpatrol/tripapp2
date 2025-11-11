import { describe, it, expect } from "vitest";
import {
  parsePriceToMinor,
  prefixCourse,
  formatPrice,
  detectCurrency,
} from "@/lib/menu";

describe("Menu Utilities", () => {
  describe("parsePriceToMinor", () => {
    it("should parse GBP price with symbol", () => {
      const result = parsePriceToMinor("£12.50", "GBP");
      expect(result).toEqual({ minor: 1250, currency: "GBP" });
    });

    it("should parse USD price with symbol", () => {
      const result = parsePriceToMinor("$15.99", "USD");
      expect(result).toEqual({ minor: 1599, currency: "USD" });
    });

    it("should parse EUR price with symbol", () => {
      const result = parsePriceToMinor("€10.00", "EUR");
      expect(result).toEqual({ minor: 1000, currency: "EUR" });
    });

    it("should parse JPY price (no decimals)", () => {
      const result = parsePriceToMinor("¥1000", "JPY");
      expect(result).toEqual({ minor: 1000, currency: "JPY" });
    });

    it("should parse price without symbol using fallback currency", () => {
      const result = parsePriceToMinor("12.50", "GBP");
      expect(result).toEqual({ minor: 1250, currency: "GBP" });
    });

    it("should parse price without decimals", () => {
      const result = parsePriceToMinor("£12", "GBP");
      expect(result).toEqual({ minor: 1200, currency: "GBP" });
    });

    it("should parse price with single decimal", () => {
      const result = parsePriceToMinor("$12.5", "USD");
      expect(result).toEqual({ minor: 1250, currency: "USD" });
    });

    it("should handle price with symbol at the end", () => {
      const result = parsePriceToMinor("12.50€", "EUR");
      expect(result).toEqual({ minor: 1250, currency: "EUR" });
    });

    it("should handle price with whitespace", () => {
      const result = parsePriceToMinor("  £ 12.50  ", "GBP");
      expect(result).toEqual({ minor: 1250, currency: "GBP" });
    });

    it("should handle price with comma separators", () => {
      const result = parsePriceToMinor("£1,250.50", "GBP");
      expect(result).toEqual({ minor: 125050, currency: "GBP" });
    });

    it("should round to nearest minor unit", () => {
      const result = parsePriceToMinor("£12.555", "GBP");
      expect(result).toEqual({ minor: 1256, currency: "GBP" });
    });

    it("should throw error on invalid price format", () => {
      expect(() => parsePriceToMinor("invalid", "GBP")).toThrow(
        "Invalid price format"
      );
    });

    it("should throw error on empty price", () => {
      expect(() => parsePriceToMinor("", "GBP")).toThrow("Invalid price format");
    });
  });

  describe("prefixCourse", () => {
    it("should prefix name with course", () => {
      const result = prefixCourse("Caesar Salad", "Starters");
      expect(result).toBe("Starters - Caesar Salad");
    });

    it("should handle Mains course", () => {
      const result = prefixCourse("Ribeye Steak", "Mains");
      expect(result).toBe("Mains - Ribeye Steak");
    });

    it("should handle Desserts course", () => {
      const result = prefixCourse("Tiramisu", "Desserts");
      expect(result).toBe("Desserts - Tiramisu");
    });

    it("should return name unchanged when no course", () => {
      const result = prefixCourse("Caesar Salad");
      expect(result).toBe("Caesar Salad");
    });

    it("should return name unchanged when course is undefined", () => {
      const result = prefixCourse("Caesar Salad", undefined);
      expect(result).toBe("Caesar Salad");
    });

    it("should return name unchanged when course is empty string", () => {
      const result = prefixCourse("Caesar Salad", "");
      expect(result).toBe("Caesar Salad");
    });

    it("should trim whitespace from course", () => {
      const result = prefixCourse("Caesar Salad", "  Starters  ");
      expect(result).toBe("Starters - Caesar Salad");
    });

    it("should handle course with special characters", () => {
      const result = prefixCourse("Soup", "Starters & Soups");
      expect(result).toBe("Starters & Soups - Soup");
    });
  });

  describe("formatPrice", () => {
    it("should format GBP price", () => {
      const result = formatPrice(1250, "GBP");
      expect(result).toBe("£12.50");
    });

    it("should format USD price", () => {
      const result = formatPrice(1599, "USD");
      expect(result).toBe("$15.99");
    });

    it("should format EUR price", () => {
      const result = formatPrice(1000, "EUR");
      expect(result).toBe("€10.00");
    });

    it("should format JPY price (no decimals)", () => {
      const result = formatPrice(1000, "JPY");
      expect(result).toBe("¥1000");
    });

    it("should format whole amounts with .00", () => {
      const result = formatPrice(1200, "GBP");
      expect(result).toBe("£12.00");
    });

    it("should handle zero price", () => {
      const result = formatPrice(0, "GBP");
      expect(result).toBe("£0.00");
    });

    it("should handle unknown currency with code", () => {
      const result = formatPrice(1250, "XXX");
      expect(result).toBe("XXX12.50");
    });
  });

  describe("detectCurrency", () => {
    it("should detect GBP from symbol", () => {
      const result = detectCurrency("£");
      expect(result).toBe("GBP");
    });

    it("should detect USD from symbol", () => {
      const result = detectCurrency("$");
      expect(result).toBe("USD");
    });

    it("should detect EUR from symbol", () => {
      const result = detectCurrency("€");
      expect(result).toBe("EUR");
    });

    it("should detect JPY from symbol", () => {
      const result = detectCurrency("¥");
      expect(result).toBe("JPY");
    });

    it("should detect currency from ISO code", () => {
      const result = detectCurrency("GBP");
      expect(result).toBe("GBP");
    });

    it("should detect currency from lowercase ISO code", () => {
      const result = detectCurrency("gbp");
      expect(result).toBe("GBP");
    });

    it("should return null for unrecognized currency", () => {
      const result = detectCurrency("INVALID");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = detectCurrency("");
      expect(result).toBeNull();
    });

    it("should return null for undefined", () => {
      const result = detectCurrency(undefined);
      expect(result).toBeNull();
    });

    it("should handle whitespace in hint", () => {
      const result = detectCurrency("  GBP  ");
      expect(result).toBe("GBP");
    });
  });
});
