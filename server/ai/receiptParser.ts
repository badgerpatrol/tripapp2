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
  const prompt = `Extract all items from this receipt image and return ONLY raw JSON. No markdown formatting, no code blocks, no explanations.

Output this exact JSON structure:
{"items":[{"name":"item name","description":"optional details","quantity":1,"unitPrice":"12.50"}],"currency_hint":"£","total":"45.50"}

CRITICAL RULES:
1. Return ONLY the JSON object - no backtick marks, no json label, no extra text
2. Read ALL purchased items from the receipt, INCLUDING:
   - All food/product items
   - Service charges (as a separate item named "Service Charge")
   - Tips/gratuity (as a separate item named "Tip" or "Gratuity")
   - Delivery fees (as a separate item)
   - EXCLUDE: subtotal lines, final total line, tax (unless it's a separate added charge), payment info, dates
3. For name: extract the item/product name ONLY (remove quantity indicators like "2x", "x3", "2 @", etc.)
4. For description: add any variant info (size, flavor, etc.) if present
5. For quantity: CAREFULLY look for quantity indicators in these formats:
   - "2x Item" or "Item x2" → quantity: 2
   - "2 @ £5.00" → quantity: 2
   - "Item (2)" → quantity: 2
   - "2 Item" at start of line → quantity: 2
   - If no quantity shown, default to 1
6. For unitPrice: the price PER SINGLE ITEM (if you see "2x Coffee £7.00", unitPrice is "3.50" not "7.00")
   - ALWAYS divide the total item price by quantity to get unit price
   - If the receipt shows unit price separately, use that
   - For service charges/tips/fees, the unitPrice is the full amount (quantity: 1)
7. For currency_hint: the currency symbol you see (£, $, €, etc.)
8. For total: ALWAYS include the final total amount from the receipt
   - Look for "Total", "Amount Due", "Balance", etc.
   - This is CRITICAL for validation

${currencyHint ? `Expected currency: ${currencyHint}` : ""}

Examples:
- "2x Coffee @ £3.50 each" → {"name":"Coffee","quantity":2,"unitPrice":"3.50"}
- "2x Coffee £7.00" → {"name":"Coffee","quantity":2,"unitPrice":"3.50"}
- "Service Charge (12.5%) £5.00" → {"name":"Service Charge","quantity":1,"unitPrice":"5.00"}
- "Tip £3.00" → {"name":"Tip","quantity":1,"unitPrice":"3.00"}
- "Large Latte £4.50" → {"name":"Latte","description":"Large","quantity":1,"unitPrice":"4.50"}
- "Sandwich x3 £15.00" → {"name":"Sandwich","quantity":3,"unitPrice":"5.00"}

IMPORTANT:
- Pay close attention to quantities - they are CRITICAL for accurate receipt parsing!
- ALWAYS include service charges, tips, and fees as separate items
- ALWAYS extract the final total amount for validation

Output format: Pure JSON only, starting with curly brace and ending with curly brace`;

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
            text: prompt,
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
  const normalizedItems: ParsedReceiptItem[] = parsedResponse.items
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
        description: item.description?.trim().substring(0, 280), // Match spend item description limit
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

    // Log warning if difference is more than 1% or more than 10 minor units (e.g., 10 pence)
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

  return {
    items: normalizedItems,
    currencyUsed: currencyToUse,
    total: totalMinor,
  };
}
