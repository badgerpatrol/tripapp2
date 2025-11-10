import type { ListTypeHandler } from "./base";
import type { DeepLink } from "@/types/schemas";
import { actionToDeepLink } from "@/lib/deeplinks";

/**
 * TODO List Handler
 * Manages TODO list items with completion tracking and action launching
 */
export const todoHandler: ListTypeHandler = {
  async copyTemplateItemsToInstance(ctx) {
    const { prisma, templateId, instanceId } = ctx;

    // Fetch template items
    const templateItems = await prisma.todoItemTemplate.findMany({
      where: { templateId },
      orderBy: { orderIndex: "asc" },
    });

    // Copy to instance
    await prisma.todoItemInstance.createMany({
      data: templateItems.map((item) => ({
        listId: instanceId,
        label: item.label,
        notes: item.notes,
        actionType: item.actionType,
        actionData: item.actionData as any,
        orderIndex: item.orderIndex,
        isDone: false,
      })),
    });
  },

  async mergeIntoInstance(ctx) {
    const { prisma, templateId, instanceId, mode } = ctx;

    // Fetch template items
    const templateItems = await prisma.todoItemTemplate.findMany({
      where: { templateId },
      orderBy: { orderIndex: "asc" },
    });

    // Fetch existing instance items
    const existingItems = await prisma.todoItemInstance.findMany({
      where: { listId: instanceId },
    });

    // Build a set of existing labels (case-insensitive)
    const existingLabels = new Set(
      existingItems.map((item) => item.label.toLowerCase())
    );

    let added = 0;
    let skipped = 0;

    for (const templateItem of templateItems) {
      const labelLower = templateItem.label.toLowerCase();

      if (mode === "MERGE_ADD_ALLOW_DUPES") {
        // Always add
        await prisma.todoItemInstance.create({
          data: {
            listId: instanceId,
            label: templateItem.label,
            notes: templateItem.notes,
            actionType: templateItem.actionType,
            actionData: templateItem.actionData as any,
            orderIndex: templateItem.orderIndex,
            isDone: false,
          },
        });
        added++;
      } else if (mode === "MERGE_ADD") {
        // Only add if label doesn't exist (case-insensitive)
        if (!existingLabels.has(labelLower)) {
          await prisma.todoItemInstance.create({
            data: {
              listId: instanceId,
              label: templateItem.label,
              notes: templateItem.notes,
              actionType: templateItem.actionType,
              actionData: templateItem.actionData as any,
              orderIndex: templateItem.orderIndex,
              isDone: false,
            },
          });
          added++;
        } else {
          skipped++;
        }
      }
    }

    return { added, skipped };
  },

  async toggleItemState(ctx) {
    const { prisma, itemId, state, actorId } = ctx;

    await prisma.todoItemInstance.update({
      where: { id: itemId },
      data: {
        isDone: state,
        doneBy: state ? actorId : null,
        doneAt: state ? new Date() : null,
      },
    });
  },

  async launchItemAction(ctx) {
    const { prisma, itemInstanceId, tripId } = ctx;

    const item = await prisma.todoItemInstance.findUnique({
      where: { id: itemInstanceId },
    });

    if (!item || !item.actionType) {
      // No action defined, return to trip
      return {
        route: `/trips/${tripId}`,
        params: {},
      };
    }

    // Use the deeplinks helper to convert action to route
    return actionToDeepLink(item.actionType, item.actionData, { tripId });
  },
};
