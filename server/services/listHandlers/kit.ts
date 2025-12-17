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
            cost: templateItem.cost,
            url: templateItem.url,
            orderIndex: templateItem.orderIndex,
            // Inventory fields
            date: templateItem.date,
            needsRepair: templateItem.needsRepair,
            conditionNotes: templateItem.conditionNotes,
            lost: templateItem.lost,
            lastSeenText: templateItem.lastSeenText,
            lastSeenDate: templateItem.lastSeenDate,
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
              cost: templateItem.cost,
              url: templateItem.url,
              orderIndex: templateItem.orderIndex,
              // Inventory fields
              date: templateItem.date,
              needsRepair: templateItem.needsRepair,
              conditionNotes: templateItem.conditionNotes,
              lost: templateItem.lost,
              lastSeenText: templateItem.lastSeenText,
              lastSeenDate: templateItem.lastSeenDate,
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
    const item = await prisma.kitItemInstance.findUnique({
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
