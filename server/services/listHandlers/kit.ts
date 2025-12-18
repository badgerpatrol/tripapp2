import type { ListTypeHandler } from "./base";

/**
 * KIT List Handler
 * Manages packing kit items with quantity, weight, and category tracking
 */
export const kitHandler: ListTypeHandler = {
  async copyTemplateItems(ctx) {
    const { prisma, sourceTemplateId, targetTemplateId } = ctx;

    // Fetch source template items
    const sourceItems = await prisma.kitItemTemplate.findMany({
      where: { templateId: sourceTemplateId },
      orderBy: { orderIndex: "asc" },
    });

    // Copy to target template
    await prisma.kitItemTemplate.createMany({
      data: sourceItems.map((item) => ({
        templateId: targetTemplateId,
        label: item.label,
        notes: item.notes,
        quantity: item.quantity,
        perPerson: item.perPerson,
        required: item.required,
        weightGrams: item.weightGrams,
        category: item.category,
        cost: item.cost,
        url: item.url,
        orderIndex: item.orderIndex,
        // Inventory fields
        date: item.date,
        needsRepair: item.needsRepair,
        conditionNotes: item.conditionNotes,
        lost: item.lost,
        lastSeenText: item.lastSeenText,
        lastSeenDate: item.lastSeenDate,
      })),
    });
  },

  async mergeTemplateItems(ctx) {
    const { prisma, sourceTemplateId, targetTemplateId, mode } = ctx;

    // Fetch source template items
    const sourceItems = await prisma.kitItemTemplate.findMany({
      where: { templateId: sourceTemplateId },
      orderBy: { orderIndex: "asc" },
    });

    // Fetch existing target template items
    const existingItems = await prisma.kitItemTemplate.findMany({
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
        await prisma.kitItemTemplate.create({
          data: {
            templateId: targetTemplateId,
            label: sourceItem.label,
            notes: sourceItem.notes,
            quantity: sourceItem.quantity,
            perPerson: sourceItem.perPerson,
            required: sourceItem.required,
            weightGrams: sourceItem.weightGrams,
            category: sourceItem.category,
            cost: sourceItem.cost,
            url: sourceItem.url,
            orderIndex: sourceItem.orderIndex,
            // Inventory fields
            date: sourceItem.date,
            needsRepair: sourceItem.needsRepair,
            conditionNotes: sourceItem.conditionNotes,
            lost: sourceItem.lost,
            lastSeenText: sourceItem.lastSeenText,
            lastSeenDate: sourceItem.lastSeenDate,
          },
        });
        added++;
      } else if (mode === "MERGE_ADD") {
        // Only add if label doesn't exist (case-insensitive)
        if (!existingLabels.has(labelLower)) {
          await prisma.kitItemTemplate.create({
            data: {
              templateId: targetTemplateId,
              label: sourceItem.label,
              notes: sourceItem.notes,
              quantity: sourceItem.quantity,
              perPerson: sourceItem.perPerson,
              required: sourceItem.required,
              weightGrams: sourceItem.weightGrams,
              category: sourceItem.category,
              cost: sourceItem.cost,
              url: sourceItem.url,
              orderIndex: sourceItem.orderIndex,
              // Inventory fields
              date: sourceItem.date,
              needsRepair: sourceItem.needsRepair,
              conditionNotes: sourceItem.conditionNotes,
              lost: sourceItem.lost,
              lastSeenText: sourceItem.lastSeenText,
              lastSeenDate: sourceItem.lastSeenDate,
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

    // Get the item to check if it's perPerson
    const item = await prisma.kitItemTemplate.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error("Item not found");
    }

    const isShared = !item.perPerson;

    if (state) {
      // Ticking the item - create an ItemTick for this user
      await prisma.itemTick.upsert({
        where: {
          kitItemId_userId: {
            kitItemId: itemId,
            userId: actorId,
          },
        },
        create: {
          itemType: "KIT",
          userId: actorId,
          kitItemId: itemId,
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
          kitItemId: itemId,
          userId: actorId,
        },
      });
    }
  },

  // KIT items don't have actions
  launchItemAction: undefined,
};
