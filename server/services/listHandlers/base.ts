import type { PrismaClient } from "@/lib/generated/prisma";
import type { DeepLink } from "@/types/schemas";

/**
 * Base interface for list type handlers
 * Each list type (TODO, KIT, etc.) implements this interface
 */
export interface ListTypeHandler {
  /**
   * Copy all items from a source template to a target template
   */
  copyTemplateItems(ctx: {
    prisma: PrismaClient;
    sourceTemplateId: string;
    targetTemplateId: string;
  }): Promise<void>;

  /**
   * Merge items from a source template into a target template
   * @param mode - How to handle duplicates
   */
  mergeTemplateItems(ctx: {
    prisma: PrismaClient;
    sourceTemplateId: string;
    targetTemplateId: string;
    mode: "MERGE_ADD" | "MERGE_ADD_ALLOW_DUPES";
  }): Promise<{ added: number; skipped: number }>;

  /**
   * Toggle the state of an item (done/packed)
   */
  toggleItemState(ctx: {
    prisma: PrismaClient;
    itemId: string;
    state: boolean;
    actorId: string;
  }): Promise<void>;

  /**
   * Optional: Launch an action associated with an item
   * Currently only used by TODO items
   */
  launchItemAction?(ctx: {
    prisma: PrismaClient;
    itemId: string;
    tripId: string;
  }): Promise<DeepLink>;
}
