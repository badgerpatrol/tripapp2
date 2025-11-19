import { z } from "zod";
import { TagEntityType } from "@/lib/generated/prisma";

// ============================================================================
// Tag Schemas
// ============================================================================

export const TagSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  slug: z.string(),
  usageCount: z.number().int().min(0).optional(),
});

export const TagCreateSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(80, "Tag name must be 80 characters or less"),
});

export const TagListSchema = z.array(TagSchema);

export const TagLinkSchema = z.object({
  id: z.string(),
  tagId: z.string(),
  entityType: z.nativeEnum(TagEntityType),
  entityId: z.string(),
  createdAt: z.coerce.date(),
});

export const TagLinkCreateSchema = z.object({
  tagId: z.string().min(1, "Tag ID is required"),
});

export const TagLinkListSchema = z.array(TagLinkSchema);

// ============================================================================
// Type Exports
// ============================================================================

export type Tag = z.infer<typeof TagSchema>;
export type TagCreate = z.infer<typeof TagCreateSchema>;
export type TagList = z.infer<typeof TagListSchema>;
export type TagLink = z.infer<typeof TagLinkSchema>;
export type TagLinkCreate = z.infer<typeof TagLinkCreateSchema>;
export type TagLinkList = z.infer<typeof TagLinkListSchema>;

// Entity type helper (string literal for client-side use)
export type TagEntityTypeString = 'spend' | 'checklist_item' | 'kit_item';
