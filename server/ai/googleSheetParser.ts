/**
 * Google Sheet Parser Service
 * Uses Claude API to extract menu items from Google Sheets
 * Supports flexible sheet formats by having AI interpret the data
 */

import Anthropic from "@anthropic-ai/sdk";
import { MenuParseResponseSchema, type MenuParseResponse } from "@/types/menu";
import { parsePriceToMinor, prefixCourse } from "@/lib/menu";

interface ParseGoogleSheetOptions {
  sheetUrl: string;
  currencyHint?: string;
  tripCurrency?: string;
}

interface ParsedMenuItem {
  name: string;
  description?: string;
  priceMinor?: number;
  course?: string;
  currency: string;
}

/**
 * Extracts the Google Sheet ID from various URL formats
 */
function extractSheetId(url: string): string | null {
  // Handle various Google Sheets URL formats:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
  // https://docs.google.com/spreadsheets/d/SHEET_ID/pub
  // https://docs.google.com/spreadsheets/d/SHEET_ID
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]{20,})$/, // Just the ID itself
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetches Google Sheet data as CSV using the public export URL
 */
async function fetchSheetAsCSV(sheetId: string): Promise<string> {
  // Google Sheets public export URL - works for sheets with link sharing enabled
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const response = await fetch(exportUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TripAppSheetParser/1.0)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Google Sheet not found. Please check the URL and ensure the sheet exists."
      );
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error(
        "Cannot access the Google Sheet. Please make sure the sheet is publicly accessible (Share → Anyone with the link can view)."
      );
    }
    throw new Error(
      `Failed to fetch Google Sheet: ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get("content-type") || "";

  // Check if we got an HTML page (sign-in required or error page)
  if (contentType.includes("text/html")) {
    throw new Error(
      "Cannot access the Google Sheet. Please make sure the sheet is publicly accessible (Share → Anyone with the link can view)."
    );
  }

  return response.text();
}

/**
 * Parses a Google Sheet and extracts menu items using Claude API
 *
 * @param options - Options for parsing the Google Sheet
 * @returns Structured menu items with normalized prices
 * @throws Error if API key is missing, sheet is inaccessible, or parsing fails
 */
export async function parseGoogleSheet(
  options: ParseGoogleSheetOptions
): Promise<{ items: ParsedMenuItem[]; currencyUsed: string }> {
  const { sheetUrl, currencyHint, tripCurrency = "GBP" } = options;

  // Extract sheet ID from URL
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    throw new Error(
      "Invalid Google Sheet URL. Please provide a valid Google Sheets link (e.g., https://docs.google.com/spreadsheets/d/...)."
    );
  }

  // Fetch sheet data as CSV
  let csvContent: string;
  try {
    csvContent = await fetchSheetAsCSV(sheetId);
  } catch (fetchError) {
    console.error("Failed to fetch Google Sheet:", fetchError);
    throw fetchError instanceof Error
      ? fetchError
      : new Error("Unable to access the Google Sheet. Please check the URL and try again.");
  }

  // Check if we got any content
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error("The Google Sheet appears to be empty.");
  }

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  // Create the prompt for Claude to analyze the spreadsheet data
  const prompt = `Extract menu/list items from this spreadsheet data and return ONLY raw JSON. No markdown formatting, no code blocks, no explanations.

Output this exact JSON structure:
{"items":[{"course":"optional category/section","name":"item name","description":"optional details","price":"numeric value or empty string"}],"currency_hint":"£"}

CRITICAL RULES:
1. Return ONLY the JSON object - no backtick marks, no json label, no extra text
2. Analyze the spreadsheet structure and identify which columns contain relevant data
3. The spreadsheet format may vary - use your best judgment to identify:
   - Item names (required)
   - Descriptions (optional)
   - Prices (optional)
   - Categories/courses (optional)
4. For course: use any category, section, or grouping headers you find
5. For name: extract the item/dish name
6. For description: include any additional details, notes, or dietary info
7. For price: Extract numeric values only, or leave empty if no price
8. For currency_hint: include the currency symbol if you can detect it from the data
9. Keep all items even without prices
10. Skip any rows that appear to be headers, totals, or empty
11. If the data doesn't look like a menu or list of items, still try to extract meaningful items

${currencyHint ? `Expected currency: ${currencyHint}` : ""}

Output format: Pure JSON only, starting with curly brace and ending with curly brace`;

  // Call Claude API to parse the spreadsheet data
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here is the CSV data from a Google Sheet:\n\n${csvContent.substring(0, 50000)}\n\n${prompt}`,
          },
        ],
      },
    ],
  });

  // Parse the response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```)
  let cleanedText = responseText.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "");
  }

  let rawResponse: unknown;
  try {
    rawResponse = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("Failed to parse Claude response:", responseText);
    throw new Error(
      "Failed to parse items from the Google Sheet. Please try again or check the sheet format."
    );
  }

  // Validate with Zod schema
  const validationResult = MenuParseResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    console.error("Sheet parse validation failed:", validationResult.error);
    throw new Error(
      "Invalid data format from Google Sheet. Please try again or check the sheet format."
    );
  }

  const parsedResponse: MenuParseResponse = validationResult.data;

  // Determine currency to use
  const detectedCurrency = parsedResponse.currency_hint || currencyHint;
  const currencyToUse = detectedCurrency || tripCurrency;

  // Normalize items
  const normalizedItems: ParsedMenuItem[] = parsedResponse.items
    .map((item) => {
      // Parse price to minor units
      let priceMinor: number | undefined;
      let currency = currencyToUse;

      // Only parse if price looks numeric (skip "MP", "POA", etc.)
      const priceStr = item.price.trim();
      const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(priceStr);

      if (isNumericPrice) {
        try {
          const parsed = parsePriceToMinor(item.price, currencyToUse);
          priceMinor = parsed.minor;
          currency = parsed.currency;
        } catch (error) {
          // If price parsing fails, log but continue without price
          console.warn(`Failed to parse price "${item.price}":`, error);
          priceMinor = undefined;
        }
      } else if (priceStr && priceStr !== "") {
        // Non-numeric price like "MP" (Market Price), "POA" (Price on Application), etc.
        console.log(
          `Skipping non-numeric price "${item.price}" for item "${item.name}"`
        );
        priceMinor = undefined;
      }

      // Prefix name with course if present
      const displayName = item.course
        ? prefixCourse(item.name, item.course)
        : item.name;

      return {
        name: displayName.trim().substring(0, 200), // Limit name length
        description: item.description?.trim().substring(0, 500),
        priceMinor,
        course: item.course?.trim().substring(0, 100),
        currency,
      };
    })
    .filter((item) => item.name); // Keep items even if they don't have a price

  // Filter out items without names
  const validItems = normalizedItems.filter((item) => item.name);

  if (validItems.length === 0) {
    throw new Error(
      "No valid items found in the Google Sheet. Please check the sheet content and format."
    );
  }

  return {
    items: validItems,
    currencyUsed: currencyToUse,
  };
}
