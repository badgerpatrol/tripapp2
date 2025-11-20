/**
 * Receipt Parser Service
 * Uses Claude Vision API to extract receipt items from receipt images
 * Reuses patterns from menuParser.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { ReceiptParseResponseSchema, type ReceiptParseResponse, type ParsedReceiptItem } from "@/types/receipt";
import { parsePriceToMinor } from "@/lib/menu";

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
  const buildPrompt = (attemptNumber: number, previousError?: string) => `You are analyzing a receipt image to extract purchased items. Your task is to identify what was bought, how many of each item, and what each item cost.

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
${previousError ? `\n\nPREVIOUS ATTEMPT FAILED (Attempt ${attemptNumber}/3): ${previousError}\nPlease look more carefully at the receipt and ensure all items are captured correctly and add up to the total.` : ""}

Output format: Pure JSON only, starting with { and ending with }`;

  // Retry logic: attempt up to 3 times if items don't match total
  const MAX_ATTEMPTS = 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`Receipt parsing attempt ${attempt}/${MAX_ATTEMPTS}`);

    // Call Claude Vision API
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5", // Claude Haiku with vision support
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
              text: buildPrompt(attempt, lastError),
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
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          "Failed to parse receipt data. Please try again with a clearer image."
        );
      }
      lastError = "JSON parsing failed";
      continue;
    }

    // Validate with Zod schema
    const validationResult = ReceiptParseResponseSchema.safeParse(rawResponse);
    if (!validationResult.success) {
      console.error("Receipt parse validation failed:", validationResult.error);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          "Invalid receipt data format. Please try again with a clearer image."
        );
      }
      lastError = "Schema validation failed";
      continue;
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
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          "No valid receipt items found. Please ensure the receipt is clear and readable."
        );
      }
      lastError = "No valid items found";
      continue;
    }

    // Validate total: calculate sum of all items and compare with receipt total
    const calculatedTotal = normalizedItems.reduce(
      (sum, item) => sum + (item.costMinor * item.quantity),
      0
    );

    if (totalMinor !== undefined) {
      const difference = Math.abs(calculatedTotal - totalMinor);
      const percentageDiff = (difference / totalMinor) * 100;

      // If difference is more than 1% or more than 10 minor units, retry
      if (difference > 10 && percentageDiff > 1) {
        const errorMessage = `Items sum to ${(calculatedTotal / 100).toFixed(2)}, ` +
          `but receipt total is ${(totalMinor / 100).toFixed(2)} ${currencyToUse}. ` +
          `Difference: ${(difference / 100).toFixed(2)} (${percentageDiff.toFixed(1)}%)`;

        console.warn(`Receipt total validation warning (attempt ${attempt}/${MAX_ATTEMPTS}): ${errorMessage}`);

        if (attempt < MAX_ATTEMPTS) {
          lastError = errorMessage;
          continue; // Retry
        } else {
          // On final attempt, log warning but accept the result
          console.warn(`Final attempt: Accepting result despite total mismatch`);
        }
      } else {
        console.log(
          `Receipt total validated: Items sum to ${(calculatedTotal / 100).toFixed(2)}, ` +
          `receipt total is ${(totalMinor / 100).toFixed(2)} ${currencyToUse}`
        );
      }
    } else {
      console.warn("Receipt total not found on receipt, skipping validation");
    }

    // Success! Return the result
    return {
      items: normalizedItems,
      currencyUsed: currencyToUse,
      total: totalMinor,
    };
  }

  // This should never be reached, but just in case
  throw new Error("Failed to parse receipt after multiple attempts");
}
