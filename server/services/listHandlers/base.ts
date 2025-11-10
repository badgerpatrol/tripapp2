import type { PrismaClient } from "@/lib/generated/prisma";
import type { DeepLink } from "@/types/schemas";

/**
 * Base interface for list type handlers
 * Each list type (TODO, KIT, etc.) implements this interface
 */
export interface ListTypeHandler {
  /**
   * Copy all items from a template to a new instance
   */
  copyTemplateItemsToInstance(ctx: {
    prisma: PrismaClient;
    templateId: string;
    instanceId: string;
  }): Promise<void>;

  /**
   * Merge template items into an existing instance
   * @param mode - How to handle duplicates
   */
  mergeIntoInstance(ctx: {
    prisma: PrismaClient;
    templateId: string;
    instanceId: string;
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
    itemInstanceId: string;
    tripId: string;
  }): Promise<DeepLink>;
}
