import type { ListTypeHandler } from "./base";
import { todoHandler } from "./todo";
import { kitHandler } from "./kit";

/**
 * LIST Handler (Mixed List)
 * Manages lists that can contain both TODO and KIT items.
 * Delegates operations to the appropriate type-specific handlers.
 */
export const listHandler: ListTypeHandler = {
  async copyTemplateItems(ctx) {
    // Copy both TODO and KIT items from the source template
    await todoHandler.copyTemplateItems(ctx);
    await kitHandler.copyTemplateItems(ctx);
  },

  async mergeTemplateItems(ctx) {
    // Merge both TODO and KIT items
    const todoResult = await todoHandler.mergeTemplateItems(ctx);
    const kitResult = await kitHandler.mergeTemplateItems(ctx);

    return {
      added: todoResult.added + kitResult.added,
      skipped: todoResult.skipped + kitResult.skipped,
    };
  },

  async toggleItemState(ctx) {
    // Note: toggleItemState is called with the specific item type from the calling code
    // (lists.ts determines item type and calls the appropriate handler directly)
    // This method should not be called for LIST type - it's handled at a higher level
    throw new Error(
      "LIST handler toggleItemState should not be called directly. " +
      "Use todoHandler or kitHandler based on the item type."
    );
  },

  // LIST items can have actions from their TODO items
  async launchItemAction(ctx) {
    // Delegate to todoHandler since only TODO items have actions
    return todoHandler.launchItemAction!(ctx);
  },
};
