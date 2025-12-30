import type { ListTypeHandler } from "./base";
import type { DeepLink } from "@/types/schemas";
import { actionToDeepLink } from "@/lib/deeplinks";

/**
 * TODO List Handler
 * Manages TODO list items with completion tracking and action launching
 */
export const todoHandler: ListTypeHandler = {
  async copyTemplateItems(ctx) {
    const { prisma, sourceTemplateId, targetTemplateId, tripId } = ctx;

    // Fetch source template items
    const sourceItems = await prisma.todoItemTemplate.findMany({
      where: { templateId: sourceTemplateId },
      orderBy: { orderIndex: "asc" },
    });

    // Copy to target template
    await prisma.todoItemTemplate.createMany({
      data: sourceItems.map((item) => ({
        templateId: targetTemplateId,
        tripId, // Denormalized for faster toggle lookups
        label: item.label,
        notes: item.notes,
        actionType: item.actionType,
        actionData: item.actionData as any,
        parameters: item.parameters as any,
        orderIndex: item.orderIndex,
        perPerson: item.perPerson,
      })),
    });
  },

  async mergeTemplateItems(ctx) {
    const { prisma, sourceTemplateId, targetTemplateId, mode, tripId } = ctx;

    // Fetch source template items
    const sourceItems = await prisma.todoItemTemplate.findMany({
      where: { templateId: sourceTemplateId },
      orderBy: { orderIndex: "asc" },
    });

    // Fetch existing target template items
    const existingItems = await prisma.todoItemTemplate.findMany({
      where: { templateId: targetTemplateId },
    });

    // Build a set of existing labels (case-insensitive)
    const existingLabels = new Set(
      existingItems.map((item) => item.label.toLowerCase())
    );

    let added = 0;
    let skipped = 0;

    for (const sourceItem of sourceItems) {
      const labelLower = sourceItem.label.toLowerCase();

      if (mode === "MERGE_ADD_ALLOW_DUPES") {
        // Always add
        await prisma.todoItemTemplate.create({
          data: {
            templateId: targetTemplateId,
            tripId, // Denormalized for faster toggle lookups
            label: sourceItem.label,
            notes: sourceItem.notes,
            actionType: sourceItem.actionType,
            actionData: sourceItem.actionData as any,
            parameters: sourceItem.parameters as any,
            orderIndex: sourceItem.orderIndex,
            perPerson: sourceItem.perPerson,
          },
        });
        added++;
      } else if (mode === "MERGE_ADD") {
        // Only add if label doesn't exist (case-insensitive)
        if (!existingLabels.has(labelLower)) {
          await prisma.todoItemTemplate.create({
            data: {
              templateId: targetTemplateId,
              tripId, // Denormalized for faster toggle lookups
              label: sourceItem.label,
              notes: sourceItem.notes,
              actionType: sourceItem.actionType,
              actionData: sourceItem.actionData as any,
              parameters: sourceItem.parameters as any,
              orderIndex: sourceItem.orderIndex,
              perPerson: sourceItem.perPerson,
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
    const { prisma, itemId, state, actorId, isShared } = ctx;

    if (state) {
      // Ticking the item - create an ItemTick for this user
      await prisma.itemTick.upsert({
        where: {
          todoItemId_userId: {
            todoItemId: itemId,
            userId: actorId,
          },
        },
        create: {
          itemType: "TODO",
          userId: actorId,
          todoItemId: itemId,
          isShared,
        },
        update: {
          // Update timestamp by touching the record
          createdAt: new Date(),
        },
      });
    } else {
      // Unticking the item - delete the ItemTick for this user
      await prisma.itemTick.deleteMany({
        where: {
          todoItemId: itemId,
          userId: actorId,
        },
      });
    }
  },

  async launchItemAction(ctx) {
    const { prisma, itemId, tripId } = ctx;

    const item = await prisma.todoItemTemplate.findUnique({
      where: { id: itemId },
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
