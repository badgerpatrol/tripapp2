/**
 * Menu Parser Service
 * Uses Claude Vision API to extract menu items from restaurant menu images
 */

import Anthropic from "@anthropic-ai/sdk";
import { MenuParseResponseSchema, type MenuParseResponse } from "@/types/menu";
import { parsePriceToMinor, prefixCourse } from "@/lib/menu";

interface ParseMenuOptions {
  imageBase64: string;
  imageType: string;
  mediaType: string;
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
 * Parses a restaurant menu image or PDF using Claude Vision API
 *
 * @param options - Options for parsing the menu
 * @returns Structured menu items with normalized prices
 * @throws Error if API key is missing or parsing fails
 */
export async function parseMenuImage(
  options: ParseMenuOptions
): Promise<{ items: ParsedMenuItem[]; currencyUsed: string }> {
  const { imageBase64, imageType, mediaType, currencyHint, tripCurrency = "GBP" } = options;

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  // Determine if this is a PDF
  const isPDF = mediaType === "application/pdf";

  // Map to valid media types
  const validMediaType = (
    type: string
  ): "image/jpeg" | "image/png" | "image/gif" | "image/webp" => {
    const lowerType = type.toLowerCase();
    if (lowerType === "png") return "image/png";
    if (lowerType === "gif") return "image/gif";
    if (lowerType === "webp") return "image/webp";
    return "image/jpeg"; // Default to jpeg
  };

  // Create the prompt for Claude to analyze the menu
  const prompt = `Analyze this restaurant menu and extract all menu items.

Return ONLY a JSON object with this structure (no markdown, no code blocks, no explanations):

{
  "items": [
    {
      "name": "dish name",
      "description": "optional description",
      "price": "price value or MP",
      "course": "optional section like Starters, Mains, etc"
    }
  ],
  "currency_hint": "currency symbol like £, $, €"
}

Rules:
- Return ONLY the JSON object, nothing else
- Extract ALL items you can see
- Include items even if they don't have prices
- For prices: use the numeric value or "MP" for market price
${currencyHint ? `- Expected currency: ${currencyHint}` : ""}

Output the JSON object now:`;

  // Call Claude Vision API with image or document based on file type
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5", // Claude 3.5 Sonnet with vision support
    max_tokens: 2048, // More tokens for larger menus
    messages: [
      {
        role: "user",
        content: [
          isPDF
            ? {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: imageBase64,
                },
              }
            : {
                type: "image",
                source: {
                  type: "base64",
                  media_type: validMediaType(imageType),
                  data: imageBase64,
                },
              },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  // Parse the response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  if (!responseText) {
    console.error("Empty response from Claude API");
    console.error("Full message:", JSON.stringify(message, null, 2));
    throw new Error(
      `Menu parsing failed: Claude returned an empty response. The ${isPDF ? "PDF" : "image"} may be unreadable or in an unsupported format.`
    );
  }

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
    console.error("JSON parsing failed");
    console.error("Raw response:", responseText);
    console.error("Cleaned text:", cleanedText);
    console.error("Parse error:", parseError);

    // Return a more helpful error message with truncated response
    const preview = responseText.length > 200
      ? responseText.substring(0, 200) + "..."
      : responseText;

    throw new Error(
      `Menu parsing failed: Unable to parse AI response as JSON. Response preview: "${preview}". The ${isPDF ? "PDF" : "image"} may contain non-menu content or be formatted in an unexpected way.`
    );
  }

  // Validate with Zod schema
  const validationResult = MenuParseResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    console.error("Menu parse validation failed:", validationResult.error);
    console.error("Raw response object:", JSON.stringify(rawResponse, null, 2));

    const issues = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Menu parsing failed: AI response doesn't match expected format. Validation errors: ${issues}. The ${isPDF ? "PDF" : "image"} may not contain a standard menu layout.`
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
    console.error("No valid items after parsing. Original response had", parsedResponse.items.length, "items");
    throw new Error(
      `Menu parsing failed: No valid menu items could be extracted. AI found ${parsedResponse.items.length} items but none had valid names. The ${isPDF ? "PDF" : "image"} may not contain a readable menu or may be in an unexpected format.`
    );
  }

  return {
    items: validItems,
    currencyUsed: currencyToUse,
  };
}
