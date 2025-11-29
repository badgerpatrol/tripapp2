/**
 * Receipt Parser Service
 * Uses Claude Vision API to extract receipt items from receipt images
 * Reuses patterns from menuParser.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { ReceiptParseResponseSchema, type ReceiptParseResponse, type ParsedReceiptItem } from "@/types/receipt";
import { parsePriceToMinor } from "@/lib/menu";
import { createSystemLog } from "@/server/systemLog";
import { LogSeverity } from "@/lib/generated/prisma";

interface ParseReceiptOptions {
  imageBase64: string;
  imageType: string;
  currencyHint?: string;
  tripCurrency?: string;
}

/**
 * Parses a receipt image using Claude Vision API
 *
 * @param options - Options for parsing the receipt
 * @returns Structured receipt items with normalized prices and quantities
 * @throws Error if API key is missing or parsing fails
 */
export async function parseReceiptImage(
  options: ParseReceiptOptions
): Promise<{ items: ParsedReceiptItem[]; currencyUsed: string; total?: number }> {
  const { imageBase64, imageType, currencyHint, tripCurrency = "GBP" } = options;

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey });

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

  // Create the prompt for Claude to analyze the receipt
  const prompt = `You are analyzing a receipt image to extract purchased items. Your task is to identify what was bought, how many of each item, and what each item cost.

Return ONLY raw JSON with no markdown formatting, no code blocks, no explanations.

Required JSON structure:
{"items":[{"name":"item name","description":"optional details","quantity":1,"unitPrice":"12.50"}],"currency_hint":"GBP","total":"45.50"}

Your task:
1. Identify all purchased items on the receipt (products, food items, etc.)
2. For each item, determine:
   - The item name (what it is)
   - The quantity purchased (how many)
   - The price per single unit (unitPrice)
   - Any additional details like size, variant, or flavor (description field, optional)

3. Also identify:
   - Service charges, tips, or gratuity (treat as separate items with quantity: 1)
   - Delivery or other fees (treat as separate items with quantity: 1)
   - The currency as a 3-letter ISO code (USD, GBP, EUR, JPY, etc.) - NOT a symbol like $ or £
   - The final total amount paid

4. Do NOT include:
   - Subtotal lines
   - Tax lines (unless tax is a separate added charge)
   - Payment method information
   - Dates or times
   - The final total line itself (but DO extract the total value for the "total" field)

CRITICAL VALIDATION:
- If a total is shown on the receipt, you MUST verify that the sum of (quantity × unitPrice) for all items equals the total
- Double-check your math: add up all items and ensure they match the receipt total
- If the items don't add up to the total, you've missed items or made a calculation error - look more carefully at the receipt
- Common mistakes: missing items, wrong quantities, wrong prices, including items that shouldn't be there

Important notes:
- The unitPrice should ALWAYS be the price for ONE unit of the item, not the total for multiple units
- If an item was purchased multiple times, the quantity should reflect this
- Focus on the actual purchased items, filtering out the surrounding receipt noise
- Return ONLY the JSON object - no backticks, no "json" label, no extra text
${currencyHint ? `- Expected currency: ${currencyHint}` : ""}

Output format: Pure JSON only, starting with { and ending with }`;

  console.log("Receipt parsing - trying Sonnet first");

  // Try Sonnet first, fall back to Haiku if busy
  let message;
  let modelUsed = "claude-sonnet-4-5-20250929";
  const startTime = Date.now();

  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
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
  } catch (apiError: any) {
    console.error("Anthropic API error with Sonnet:", {
      message: apiError?.message,
      status: apiError?.status,
      error: apiError?.error,
      type: apiError?.error?.type,
    });

    // Check if it's an overload error or rate limit
    const isOverloaded = apiError?.message?.includes("overloaded") ||
                        apiError?.error?.type === "overloaded_error" ||
                        apiError?.status === 529;
    const isRateLimit = apiError?.status === 429;

    // If Sonnet is busy, try Haiku once
    if (isOverloaded || isRateLimit) {
      console.log("Sonnet is busy, falling back to Haiku");

      // Log Sonnet failure
      await createSystemLog(
        LogSeverity.WARNING,
        "ai",
        "receipt_parse_api_call",
        `Receipt parsing API call failed with ${modelUsed}`,
        {
          model: modelUsed,
          callType: "receipt",
          status: "failed",
          reason: isOverloaded ? "overloaded" : "rate_limit",
          errorStatus: apiError?.status,
          durationMs: Date.now() - startTime,
        }
      );

      modelUsed = "claude-3-haiku-20240307";

      try {
        message = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                {
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
      } catch (haikuError: any) {
        console.error("Anthropic API error with Haiku fallback:", {
          message: haikuError?.message,
          status: haikuError?.status,
          error: haikuError?.error,
        });

        // Log Haiku failure
        await createSystemLog(
          LogSeverity.ERROR,
          "ai",
          "receipt_parse_api_call",
          `Receipt parsing API call failed with ${modelUsed}`,
          {
            model: modelUsed,
            callType: "receipt",
            status: "failed",
            reason: haikuError?.message || "Unknown error",
            errorStatus: haikuError?.status,
            durationMs: Date.now() - startTime,
          }
        );

        throw new Error("The AI service is currently busy. Please try again in a moment.");
      }
    } else {
      // Non-overload error, log details and throw with specific message
      const errorMessage = apiError?.message || apiError?.error?.message || "Unknown error";
      console.error("Non-overload API error details:", errorMessage);

      // Log non-overload error
      await createSystemLog(
        LogSeverity.ERROR,
        "ai",
        "receipt_parse_api_call",
        `Receipt parsing API call failed with ${modelUsed}`,
        {
          model: modelUsed,
          callType: "receipt",
          status: "failed",
          reason: errorMessage,
          errorStatus: apiError?.status,
          durationMs: Date.now() - startTime,
        }
      );

      throw new Error(`Failed to analyze receipt: ${errorMessage}`);
    }
  }

  // Log successful API call
  const durationMs = Date.now() - startTime;
  await createSystemLog(
    LogSeverity.INFO,
    "ai",
    "receipt_parse_api_call",
    `Receipt parsing API call succeeded with ${modelUsed}`,
    {
      model: modelUsed,
      callType: "receipt",
      status: "success",
      durationMs,
    }
  );

  console.log(`Receipt parsed successfully using ${modelUsed}`);

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
      "Failed to parse receipt data. Please try again with a clearer image."
    );
  }

  // Validate with Zod schema
  const validationResult = ReceiptParseResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    console.error("Receipt parse validation failed:", validationResult.error);
    throw new Error(
      "Invalid receipt data format. Please try again with a clearer image."
    );
  }

  const parsedResponse: ReceiptParseResponse = validationResult.data;

  // Determine currency to use
  const detectedCurrency = parsedResponse.currency_hint || currencyHint;
  const currencyToUse = detectedCurrency || tripCurrency;

  // Parse total if present
  let totalMinor: number | undefined;
  if (parsedResponse.total) {
    try {
      const priceStr = parsedResponse.total.trim();
      const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(priceStr);
      if (isNumericPrice) {
        const parsed = parsePriceToMinor(parsedResponse.total, currencyToUse);
        totalMinor = parsed.minor;
      }
    } catch (error) {
      console.warn(`Failed to parse receipt total "${parsedResponse.total}":`, error);
    }
  }

  // Normalize items
  const normalizedItems = parsedResponse.items
    .map((item) => {
      // Parse price to minor units
      let costMinor: number;
      let currency = currencyToUse;

      const priceStr = item.unitPrice.trim();
      const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(priceStr);

      if (!isNumericPrice) {
        console.warn(`Skipping non-numeric price "${item.unitPrice}" for item "${item.name}"`);
        return null;
      }

      try {
        const parsed = parsePriceToMinor(item.unitPrice, currencyToUse);
        costMinor = parsed.minor;
        currency = parsed.currency;
      } catch (error) {
        console.warn(`Failed to parse price "${item.unitPrice}":`, error);
        return null;
      }

      return {
        name: item.name.trim().substring(0, 80), // Match spend item name limit
        ...(item.description && { description: item.description.trim().substring(0, 280) }), // Match spend item description limit
        costMinor,
        currency,
        quantity: item.quantity,
      };
    })
    .filter((item): item is ParsedReceiptItem => item !== null);

  if (normalizedItems.length === 0) {
    throw new Error(
      "No valid receipt items found. Please ensure the receipt is clear and readable."
    );
  }

  // Validate total: calculate sum of all items and compare with receipt total
  const calculatedTotal = normalizedItems.reduce(
    (sum, item) => sum + (item.costMinor * item.quantity),
    0
  );

  if (totalMinor !== undefined) {
    const difference = Math.abs(calculatedTotal - totalMinor);
    const percentageDiff = (difference / totalMinor) * 100;

    // Log warning if difference is more than 1% or more than 10 minor units
    if (difference > 10 && percentageDiff > 1) {
      console.warn(
        `Receipt total validation warning: Items sum to ${(calculatedTotal / 100).toFixed(2)}, ` +
        `but receipt total is ${(totalMinor / 100).toFixed(2)} ${currencyToUse}. ` +
        `Difference: ${(difference / 100).toFixed(2)} (${percentageDiff.toFixed(1)}%). ` +
        `This may indicate missing items or incorrect parsing.`
      );
    } else {
      console.log(
        `Receipt total validated: Items sum to ${(calculatedTotal / 100).toFixed(2)}, ` +
        `receipt total is ${(totalMinor / 100).toFixed(2)} ${currencyToUse}`
      );
    }
  } else {
    console.warn("Receipt total not found on receipt, skipping validation");
  }

  // Return the result
  return {
    items: normalizedItems,
    currencyUsed: currencyToUse,
    total: totalMinor,
  };
}
