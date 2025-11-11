/**
 * Menu URL Parser Service
 * Uses Claude API to extract menu items from restaurant website URLs
 */

import Anthropic from "@anthropic-ai/sdk";
import { MenuParseResponseSchema, type MenuParseResponse } from "@/types/menu";
import { parsePriceToMinor, prefixCourse } from "@/lib/menu";

interface ParseMenuUrlOptions {
  url: string;
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
 * Parses a restaurant menu from a website URL using Claude API
 *
 * @param options - Options for parsing the menu URL
 * @returns Structured menu items with normalized prices
 * @throws Error if API key is missing or parsing fails
 */
export async function parseMenuUrl(
  options: ParseMenuUrlOptions
): Promise<{ items: ParsedMenuItem[]; currencyUsed: string }> {
  const { url, currencyHint, tripCurrency = "GBP" } = options;

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  // Create the prompt for Claude to analyze the website
  const prompt = `Extract menu items from this restaurant website and return ONLY raw JSON. No markdown formatting, no code blocks, no explanations.

Output this exact JSON structure:
{"items":[{"course":"optional course name","name":"item name","description":"optional details","price":"numeric or MP"}],"currency_hint":"£"}

CRITICAL RULES:
1. Return ONLY the JSON object - no backtick marks, no json label, no extra text
2. Read all menu items from the website
3. For course: use section headers like Starters, Mains, Desserts if visible
4. For name: extract the dish name only
5. For description: include dietary info like vegan or calories and brief details
6. For price: Include the numeric value or MP if Market Price
7. For currency_hint: include the currency symbol you see
8. Keep all items even without prices
9. Ignore any non-menu content like restaurant description, opening hours, contact info

${currencyHint ? `Expected currency: ${currencyHint}` : ""}

Output format: Pure JSON only, starting with curly brace and ending with curly brace`;

  // First, fetch the website content
  let websiteContent: string;
  try {
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TripAppMenuParser/1.0)',
      },
    });

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch URL: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }

    websiteContent = await fetchResponse.text();
  } catch (fetchError) {
    console.error("Failed to fetch URL:", fetchError);
    throw new Error("Unable to access the provided URL. Please check the URL and try again.");
  }

  // Call Claude API to parse the website content
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096, // More tokens for larger menus
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here is the HTML content from a restaurant website:\n\n${websiteContent.substring(0, 50000)}\n\n${prompt}`,
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
    // Remove markdown code blocks
    cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  }

  let rawResponse: any;
  try {
    rawResponse = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("Failed to parse Claude response:", responseText);
    throw new Error(
      "Failed to parse menu data from URL. Please try again or use a different URL."
    );
  }

  // Validate with Zod schema
  const validationResult = MenuParseResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    console.error("Menu parse validation failed:", validationResult.error);
    throw new Error(
      "Invalid menu data format from URL. Please try again or use a different URL."
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
      } else {
        // Non-numeric price like "MP" (Market Price), "POA" (Price on Application), etc.
        console.log(`Skipping non-numeric price "${item.price}" for item "${item.name}"`);
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
      "No valid menu items found at this URL. Please ensure the URL points to a menu page."
    );
  }

  return {
    items: validItems,
    currencyUsed: currencyToUse,
  };
}
