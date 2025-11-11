/**
 * Menu utility functions for parsing and normalizing menu data
 */

/**
 * Currency symbols and their corresponding ISO codes
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  "£": "GBP",
  "$": "USD",
  "€": "EUR",
  "¥": "JPY",
  "₹": "INR",
  "A$": "AUD",
  "C$": "CAD",
  "CHF": "CHF",
  "kr": "SEK",
};

/**
 * Minor units per major unit for each currency
 * Most currencies use 100 (e.g., 100 cents = 1 dollar)
 * Some like JPY have no minor units (1 yen = 1 yen)
 */
const CURRENCY_MINOR_UNITS: Record<string, number> = {
  GBP: 100,
  USD: 100,
  EUR: 100,
  JPY: 1,
  INR: 100,
  AUD: 100,
  CAD: 100,
  CHF: 100,
  SEK: 100,
};

/**
 * Parses a price string (e.g., "12.50", "£12.50", "$12", "12") into minor units
 *
 * @param priceStr - The price string to parse
 * @param currencyFallback - The fallback currency code if none is detected (default: "GBP")
 * @returns Object with minor units and detected/fallback currency code
 *
 * @example
 * parsePriceToMinor("£12.50", "GBP") // => { minor: 1250, currency: "GBP" }
 * parsePriceToMinor("12.50", "USD") // => { minor: 1250, currency: "USD" }
 * parsePriceToMinor("¥1000", "JPY") // => { minor: 1000, currency: "JPY" }
 */
export function parsePriceToMinor(
  priceStr: string,
  currencyFallback: string = "GBP"
): { minor: number; currency: string } {
  // Remove whitespace
  const cleaned = priceStr.trim();

  // Try to detect currency symbol
  let detectedCurrency: string | null = null;
  let numericPart = cleaned;

  // Check for currency symbols at the start or end
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (cleaned.startsWith(symbol)) {
      detectedCurrency = code;
      numericPart = cleaned.slice(symbol.length).trim();
      break;
    } else if (cleaned.endsWith(symbol)) {
      detectedCurrency = code;
      numericPart = cleaned.slice(0, -symbol.length).trim();
      break;
    }
  }

  const currency = detectedCurrency || currencyFallback;

  // Remove any remaining non-numeric characters except decimal point
  numericPart = numericPart.replace(/[^\d.]/g, "");

  // Parse the numeric value
  const majorUnits = parseFloat(numericPart);
  if (isNaN(majorUnits)) {
    throw new Error(`Invalid price format: "${priceStr}"`);
  }

  // Convert to minor units
  const minorUnitsPerMajor = CURRENCY_MINOR_UNITS[currency] || 100;
  const minor = Math.round(majorUnits * minorUnitsPerMajor);

  return { minor, currency };
}

/**
 * Prefixes a menu item name with its course if present
 *
 * @param name - The menu item name
 * @param course - Optional course name (e.g., "Starters", "Mains", "Desserts")
 * @returns The name prefixed with course, or just the name if no course
 *
 * @example
 * prefixCourse("Caesar Salad", "Starters") // => "Starters - Caesar Salad"
 * prefixCourse("Caesar Salad") // => "Caesar Salad"
 * prefixCourse("Caesar Salad", "") // => "Caesar Salad"
 */
export function prefixCourse(name: string, course?: string): string {
  if (!course || course.trim() === "") {
    return name;
  }
  return `${course.trim()} - ${name}`;
}

/**
 * Formats a price in minor units to a display string
 *
 * @param minor - Price in minor units
 * @param currency - Currency code (e.g., "GBP", "USD")
 * @returns Formatted price string
 *
 * @example
 * formatPrice(1250, "GBP") // => "£12.50"
 * formatPrice(1000, "JPY") // => "¥1000"
 */
export function formatPrice(minor: number, currency: string): string {
  const minorUnitsPerMajor = CURRENCY_MINOR_UNITS[currency] || 100;
  const major = minor / minorUnitsPerMajor;

  // Find currency symbol
  const symbol =
    Object.entries(CURRENCY_SYMBOLS).find(([_, code]) => code === currency)?.[0] ||
    currency;

  // Format with appropriate decimal places
  if (minorUnitsPerMajor === 1) {
    // No decimals for currencies like JPY
    return `${symbol}${Math.round(major)}`;
  } else {
    return `${symbol}${major.toFixed(2)}`;
  }
}

/**
 * Detects currency hint from a string (e.g., "£", "GBP")
 *
 * @param hint - Currency hint string
 * @returns ISO currency code or null if not recognized
 *
 * @example
 * detectCurrency("£") // => "GBP"
 * detectCurrency("GBP") // => "GBP"
 * detectCurrency("") // => null
 */
export function detectCurrency(hint?: string): string | null {
  if (!hint) return null;

  const cleaned = hint.trim().toUpperCase();

  // Check if it's already a currency code
  if (CURRENCY_MINOR_UNITS[cleaned]) {
    return cleaned;
  }

  // Check if it's a symbol
  const code = CURRENCY_SYMBOLS[hint.trim()];
  return code || null;
}
