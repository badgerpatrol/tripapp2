import { z } from "zod";

/**
 * Schema for a single menu item extracted from an image
 * Matches the JSON structure returned by Claude vision API
 */
export const MenuItemSchema = z.object({
  course: z.string().trim().optional(),
  name: z.string().min(1, "Menu item name is required"),
  description: z.string().optional(),
  // Accept various price formats: "12.50", "£12.50", "12", "12.5"
  // Also accept numbers and coerce to string (Claude sometimes returns numbers)
  // Server-side will normalize to minor units
  price: z.union([z.string(), z.number()]).transform(val => String(val)).pipe(z.string().min(1, "Price is required")),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

/**
 * Schema for the full response from Claude's menu parsing
 */
export const MenuParseResponseSchema = z.object({
  items: z.array(MenuItemSchema).min(1, "At least one menu item is required"),
  // Optional hint about currency symbol detected in the menu
  currency_hint: z.string().optional(),
});

export type MenuParseResponse = z.infer<typeof MenuParseResponseSchema>;

/**
 * Schema for bulk-adding items to a choice
 * Used in the API endpoint that creates multiple ChoiceItems from scanned menu
 */
export const BulkCreateChoiceItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200, "Item name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  priceMinor: z.number().int().nonnegative().optional(), // Price in minor units
  course: z.string().max(100, "Course name is too long").optional(),
  sortIndex: z.number().int().nonnegative().default(0),
  // Inherit other optional fields from existing ChoiceItem schema
  tags: z.array(z.string()).optional(),
  maxPerUser: z.number().int().positive().optional(),
  maxTotal: z.number().int().positive().optional(),
  allergens: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export type BulkCreateChoiceItem = z.infer<typeof BulkCreateChoiceItemSchema>;

/**
 * Schema for the bulk items endpoint request body
 */
export const BulkCreateItemsRequestSchema = z.object({
  items: z.array(BulkCreateChoiceItemSchema).min(1, "At least one item is required"),
});

export type BulkCreateItemsRequest = z.infer<typeof BulkCreateItemsRequestSchema>;
