import { z } from "zod";

/**
 * Schema for a single receipt item extracted from an image
 * Matches the JSON structure returned by Claude vision API
 */
export const ReceiptItemSchema = z.object({
  name: z.string().min(1, "Receipt item name is required"),
  description: z.string().optional(),
  // Quantity - if more than 1, item should be expanded into multiple items
  quantity: z.number().int().positive().default(1),
  // Unit price (price per item)
  unitPrice: z.union([z.string(), z.number()]).transform(val => String(val)).pipe(z.string().min(1, "Price is required")),
});

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;

/**
 * Schema for the full response from Claude's receipt parsing
 */
export const ReceiptParseResponseSchema = z.object({
  items: z.array(ReceiptItemSchema).min(1, "At least one receipt item is required"),
  // Optional hint about currency symbol detected in the receipt
  currency_hint: z.string().optional(),
  // Optional total from receipt (for validation)
  total: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});

export type ReceiptParseResponse = z.infer<typeof ReceiptParseResponseSchema>;

/**
 * Normalized receipt item ready for spend item creation
 */
export interface ParsedReceiptItem {
  name: string;
  description?: string;
  costMinor: number; // Cost per item in minor units (e.g., cents, pence)
  currency: string;
  quantity: number; // Used to expand into multiple items if > 1
}
