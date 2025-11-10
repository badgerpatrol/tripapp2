import type { ListTypeHandler } from "./base";

/**
 * KIT List Handler
 * Manages packing kit items with quantity, weight, and category tracking
 */
export const kitHandler: ListTypeHandler = {
  async copyTemplateItemsToInstance(ctx) {
    const { prisma, templateId, instanceId } = ctx;

    // Fetch template items
    const templateItems = await prisma.kitItemTemplate.findMany({
      where: { templateId },
      orderBy: { orderIndex: "asc" },
    });

    // Copy to instance
    await prisma.kitItemInstance.createMany({
      data: templateItems.map((item) => ({
        listId: instanceId,
        label: item.label,
        notes: item.notes,
        quantity: item.quantity,
        perPerson: item.perPerson,
        required: item.required,
        weightGrams: item.weightGrams,
        category: item.category,
        orderIndex: item.orderIndex,
        isPacked: false,
      })),
    });
  },

  async mergeIntoInstance(ctx) {
    const { prisma, templateId, instanceId, mode } = ctx;

    // Fetch template items
    const templateItems = await prisma.kitItemTemplate.findMany({
      where: { templateId },
      orderBy: { orderIndex: "asc" },
    });

    // Fetch existing instance items
    const existingItems = await prisma.kitItemInstance.findMany({
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
        await prisma.kitItemInstance.create({
          data: {
            listId: instanceId,
            label: templateItem.label,
            notes: templateItem.notes,
            quantity: templateItem.quantity,
            perPerson: templateItem.perPerson,
            required: templateItem.required,
            weightGrams: templateItem.weightGrams,
            category: templateItem.category,
            orderIndex: templateItem.orderIndex,
            isPacked: false,
          },
        });
        added++;
      } else if (mode === "MERGE_ADD") {
        // Only add if label doesn't exist (case-insensitive)
        if (!existingLabels.has(labelLower)) {
          await prisma.kitItemInstance.create({
            data: {
              listId: instanceId,
              label: templateItem.label,
              notes: templateItem.notes,
              quantity: templateItem.quantity,
              perPerson: templateItem.perPerson,
              required: templateItem.required,
              weightGrams: templateItem.weightGrams,
              category: templateItem.category,
              orderIndex: templateItem.orderIndex,
              isPacked: false,
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

    await prisma.kitItemInstance.update({
      where: { id: itemId },
      data: {
        isPacked: state,
        packedBy: state ? actorId : null,
        packedAt: state ? new Date() : null,
      },
    });
  },

  // KIT items don't have actions
  launchItemAction: undefined,
};
