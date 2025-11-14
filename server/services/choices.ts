/**
 * Choice Service
 * Handles business logic for menu choices/voting system
 */

import { prisma } from "@/lib/prisma";
import { ChoiceStatus, Prisma, EventType, MilestoneTriggerType } from "@/lib/generated/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { logEvent } from "@/server/eventLog";

// ============================================================================
// Types
// ============================================================================

export interface CreateChoiceData {
  name: string;
  description?: string;
  datetime?: Date;
  place?: string;
  visibility?: "TRIP" | "PRIVATE";
}

export interface UpdateChoiceData {
  name?: string;
  description?: string | null;
  datetime?: Date | null;
  place?: string | null;
  visibility?: "TRIP" | "PRIVATE";
}

export interface CreateChoiceItemData {
  name: string;
  description?: string;
  price?: number;
  course?: string;
  sortIndex?: number;
  tags?: string[];
  maxPerUser?: number;
  maxTotal?: number;
  allergens?: string[];
  isActive?: boolean;
}

export interface UpdateChoiceItemData {
  name?: string;
  description?: string | null;
  price?: number | null;
  tags?: string[] | null;
  maxPerUser?: number | null;
  maxTotal?: number | null;
  allergens?: string[] | null;
  isActive?: boolean;
}

export interface SelectionLine {
  itemId: string;
  quantity: number;
  note?: string;
}

export interface CreateSelectionData {
  lines: SelectionLine[];
}

// ============================================================================
// Choice Management (Epic A)
// ============================================================================

/**
 * A1. Create a Choice
 */
export async function createChoice(
  userId: string,
  tripId: string,
  data: CreateChoiceData & { deadline?: Date }
) {
  // Use a transaction to create choice and milestone together
  const result = await prisma.$transaction(async (tx) => {
    const choice = await tx.choice.create({
      data: {
        tripId,
        name: data.name,
        description: data.description,
        datetime: data.datetime,
        place: data.place,
        visibility: data.visibility || "TRIP",
        status: "OPEN",
        deadline: data.deadline,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
            photoURL: true,
          },
        },
      },
    });

    // If deadline is provided, create a milestone for it
    if (data.deadline) {
      // Get the highest order number for existing timeline items
      const lastItem = await tx.timelineItem.findFirst({
        where: {
          tripId,
          deletedAt: null,
        },
        orderBy: {
          order: "desc",
        },
      });

      const nextOrder = lastItem ? lastItem.order + 1 : 0;

      await tx.timelineItem.create({
        data: {
          tripId,
          choiceId: choice.id,
          title: `Choice: ${data.name}`,
          description: `Deadline for choice "${data.name}"`,
          date: data.deadline,
          isCompleted: false,
          order: nextOrder,
          createdById: userId,
        },
      });
      console.log(`[createChoice] Created milestone for choice "${data.name}" with deadline ${data.deadline}`);
    }

    // Create activity log
    await tx.choiceActivity.create({
      data: {
        choiceId: choice.id,
        actorId: userId,
        action: "created",
        payload: { name: data.name, deadline: data.deadline },
      },
    });

    return choice;
  });

  // Log event (outside transaction)
  await logEvent("Choice", result.id, EventType.CHOICE_CREATED, userId, {
    tripId,
    name: data.name,
    deadline: data.deadline,
  });

  return result;
}

/**
 * A2. Update a Choice
 */
export async function updateChoice(
  choiceId: string,
  userId: string,
  data: UpdateChoiceData
) {
  // Fetch choice to check status and ownership
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  if (choice.archivedAt) {
    throw new Error("Cannot update archived choice");
  }

  const updateData: Prisma.ChoiceUpdateInput = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.datetime !== undefined) updateData.datetime = data.datetime;
  if (data.place !== undefined) updateData.place = data.place;
  if (data.visibility) updateData.visibility = data.visibility;

  const updated = await prisma.choice.update({
    where: { id: choiceId },
    data: updateData,
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
    },
  });

  // Log event
  await logEvent("Choice", choiceId, EventType.CHOICE_UPDATED, userId, {
    tripId: choice.tripId,
    changes: data,
  });

  // Create activity log
  await prisma.choiceActivity.create({
    data: {
      choiceId,
      actorId: userId,
      action: "updated",
      payload: data as any,
    },
  });

  return updated;
}

/**
 * A2. Update Choice Status (Open/Close)
 */
export async function updateChoiceStatus(
  choiceId: string,
  userId: string,
  status: ChoiceStatus,
  deadline?: Date | null
) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  if (choice.archivedAt) {
    throw new Error("Cannot update archived choice");
  }

  // Check if trying to reopen a choice that has a linked spend
  if (status === "OPEN" && choice.status === "CLOSED") {
    const spendActivity = await prisma.choiceActivity.findFirst({
      where: {
        choiceId,
        action: "spend_created",
      },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });

    if (spendActivity?.payload) {
      const spendId = (spendActivity.payload as { spendId?: string }).spendId;
      if (spendId) {
        const spend = await prisma.spend.findUnique({
          where: { id: spendId },
          select: { id: true, deletedAt: true },
        });

        if (spend && !spend.deletedAt) {
          throw new Error("Cannot reopen choice: A spend has been auto-generated from this choice. Delete the spend first to reopen the choice.");
        }
      }
    }
  }

  const now = new Date();

  // Use transaction to update choice status and milestone together
  const updated = await prisma.$transaction(async (tx) => {
    const updateData: Prisma.ChoiceUpdateInput = { status };
    if (deadline !== undefined) updateData.deadline = deadline;

    const updatedChoice = await tx.choice.update({
      where: { id: choiceId },
      data: updateData,
    });

    // Find the milestone linked to this choice
    const choiceMilestone = await tx.timelineItem.findFirst({
      where: {
        choiceId,
        tripId: choice.tripId,
        deletedAt: null,
      },
    });

    // Handle choice milestone based on status change
    if (choiceMilestone) {
      if (status === "CLOSED" && !choiceMilestone.isCompleted) {
        // Closing choice - mark milestone as completed
        await tx.timelineItem.update({
          where: { id: choiceMilestone.id },
          data: {
            isCompleted: true,
            completedAt: now,
            triggerType: MilestoneTriggerType.MANUAL,
          },
        });
        console.log(`[updateChoiceStatus] Marked choice milestone as completed (MANUAL) for choice "${choice.name}"`);
      } else if (status === "OPEN" && choiceMilestone.isCompleted) {
        // Reopening choice - reset milestone to uncompleted
        await tx.timelineItem.update({
          where: { id: choiceMilestone.id },
          data: {
            isCompleted: false,
            completedAt: null,
            triggerType: null,
          },
        });
        console.log(`[updateChoiceStatus] Reset choice milestone to uncompleted for choice "${choice.name}"`);
      }
    }

    // If deadline is being set/updated
    if (deadline !== undefined && deadline !== null) {
      if (choiceMilestone) {
        // Update existing milestone's date
        await tx.timelineItem.update({
          where: { id: choiceMilestone.id },
          data: {
            date: deadline,
            title: `Choice: ${updatedChoice.name}`,
            description: `Deadline for choice "${updatedChoice.name}"`,
          },
        });
        console.log(`[updateChoiceStatus] Updated milestone date for choice "${choice.name}" to ${deadline}`);
      } else {
        // Create new milestone if none exists
        // Get the highest order number for existing timeline items
        const lastItem = await tx.timelineItem.findFirst({
          where: {
            tripId: choice.tripId,
            deletedAt: null,
          },
          orderBy: {
            order: "desc",
          },
        });

        const nextOrder = lastItem ? lastItem.order + 1 : 0;

        await tx.timelineItem.create({
          data: {
            tripId: choice.tripId,
            choiceId,
            title: `Choice: ${choice.name}`,
            description: `Deadline for choice "${choice.name}"`,
            date: deadline,
            isCompleted: status === "CLOSED", // If already closed, mark milestone as completed
            completedAt: status === "CLOSED" ? now : null,
            triggerType: status === "CLOSED" ? MilestoneTriggerType.MANUAL : null,
            order: nextOrder,
            createdById: userId,
          },
        });
        console.log(`[updateChoiceStatus] Created milestone for choice "${choice.name}" with deadline ${deadline}`);
      }
    }

    // If deadline is being removed, delete the milestone
    if (deadline === null && choiceMilestone) {
      await tx.timelineItem.update({
        where: { id: choiceMilestone.id },
        data: { deletedAt: now },
      });
      console.log(`[updateChoiceStatus] Deleted milestone for choice "${choice.name}" - deadline removed`);
    }

    // Create activity log
    await tx.choiceActivity.create({
      data: {
        choiceId,
        actorId: userId,
        action: status === "CLOSED" ? "closed" : "reopened",
        payload: { status, deadline },
      },
    });

    return updatedChoice;
  });

  // Log event (outside transaction)
  const eventType = status === "CLOSED" ? EventType.CHOICE_CLOSED : EventType.CHOICE_REOPENED;
  await logEvent("Choice", choiceId, eventType, userId, {
    tripId: choice.tripId,
    status,
    deadline,
  });

  return updated;
}

/**
 * A3. Archive a Choice (soft delete)
 */
export async function archiveChoice(choiceId: string, userId: string) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  const now = new Date();

  // Use transaction to archive choice and delete its milestone
  const archived = await prisma.$transaction(async (tx) => {
    const archivedChoice = await tx.choice.update({
      where: { id: choiceId },
      data: {
        archivedAt: now,
      },
    });

    // Delete the associated milestone (soft delete)
    await tx.timelineItem.updateMany({
      where: {
        choiceId,
        tripId: choice.tripId,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    });
    console.log(`[archiveChoice] Deleted milestone for archived choice "${choice.name}"`);

    // Create activity log
    await tx.choiceActivity.create({
      data: {
        choiceId,
        actorId: userId,
        action: "archived",
      },
    });

    return archivedChoice;
  });

  // Log event (outside transaction)
  await logEvent("Choice", choiceId, EventType.CHOICE_ARCHIVED, userId, {
    tripId: choice.tripId,
  });

  return archived;
}

/**
 * A3. Restore an archived Choice
 */
export async function restoreChoice(choiceId: string, userId: string) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  const restored = await prisma.choice.update({
    where: { id: choiceId },
    data: {
      archivedAt: null,
    },
  });

  // Log event
  await logEvent("Choice", choiceId, EventType.CHOICE_RESTORED, userId, {
    tripId: choice.tripId,
  });

  // Create activity log
  await prisma.choiceActivity.create({
    data: {
      choiceId,
      actorId: userId,
      action: "restored",
    },
  });

  return restored;
}

/**
 * A3. Delete a Choice (hard delete)
 * Deletes the choice and all associated menu items and selections (cascade)
 */
export async function deleteChoice(choiceId: string, userId: string) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  // Log event before deletion
  await logEvent("Choice", choiceId, EventType.CHOICE_ARCHIVED, userId, {
    tripId: choice.tripId,
    name: choice.name,
  });

  // Delete the choice (cascade will delete items, selections, and selection lines)
  await prisma.choice.delete({
    where: { id: choiceId },
  });

  return { success: true };
}

/**
 * A4. Add Menu Item to a Choice
 */
export async function createChoiceItem(
  choiceId: string,
  userId: string,
  data: CreateChoiceItemData
) {
  const item = await prisma.choiceItem.create({
    data: {
      choiceId,
      name: data.name,
      description: data.description,
      price: data.price ? new Decimal(data.price) : null,
      course: data.course,
      sortIndex: data.sortIndex ?? 0,
      tags: data.tags as any || null,
      maxPerUser: data.maxPerUser,
      maxTotal: data.maxTotal,
      allergens: data.allergens as any || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  // Get choice for tripId
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
    select: { tripId: true },
  });

  // Log event
  await logEvent("ChoiceItem", item.id, EventType.CHOICE_ITEM_CREATED, userId, {
    tripId: choice?.tripId,
    choiceId,
    name: data.name,
  });

  return item;
}

/**
 * A4b. Bulk Create Menu Items for a Choice
 * Used when scanning menus or importing multiple items at once
 */
export async function bulkCreateChoiceItems(
  choiceId: string,
  userId: string,
  items: CreateChoiceItemData[]
) {
  // Get choice to verify it exists and get tripId
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
    select: { tripId: true, archivedAt: true },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  if (choice.archivedAt) {
    throw new Error("Cannot add items to archived choice");
  }

  // Use transaction to create all items atomically
  const createdItems = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const itemData of items) {
      const item = await tx.choiceItem.create({
        data: {
          choiceId,
          name: itemData.name,
          description: itemData.description,
          price: itemData.price ? new Decimal(itemData.price) : null,
          course: itemData.course,
          sortIndex: itemData.sortIndex ?? 0,
          tags: itemData.tags as any || null,
          maxPerUser: itemData.maxPerUser,
          maxTotal: itemData.maxTotal,
          allergens: itemData.allergens as any || null,
          isActive: itemData.isActive !== undefined ? itemData.isActive : true,
        },
      });
      results.push(item);
    }

    return results;
  });

  // Log event for bulk creation
  await logEvent("ChoiceItem", choiceId, EventType.CHOICE_ITEMS_BULK_ADD, userId, {
    tripId: choice.tripId,
    choiceId,
    itemCount: createdItems.length,
  });

  return createdItems;
}

/**
 * A5. Update a Choice Item
 */
export async function updateChoiceItem(
  itemId: string,
  userId: string,
  data: UpdateChoiceItemData
) {
  const item = await prisma.choiceItem.findUnique({
    where: { id: itemId },
    include: { choice: true },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  const updateData: Prisma.ChoiceItemUpdateInput = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) {
    updateData.price = data.price !== null ? new Decimal(data.price) : null;
  }
  if (data.tags !== undefined) updateData.tags = data.tags as any;
  if (data.maxPerUser !== undefined) updateData.maxPerUser = data.maxPerUser;
  if (data.maxTotal !== undefined) updateData.maxTotal = data.maxTotal;
  if (data.allergens !== undefined) updateData.allergens = data.allergens as any;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.choiceItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // Log event
  await logEvent("ChoiceItem", itemId, EventType.CHOICE_ITEM_UPDATED, userId, {
    tripId: item.choice.tripId,
    changes: data,
  });

  return updated;
}

/**
 * A5. Deactivate a Choice Item (soft delete)
 */
export async function deactivateChoiceItem(itemId: string, userId: string) {
  const item = await prisma.choiceItem.findUnique({
    where: { id: itemId },
    include: { choice: true },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  const deactivated = await prisma.choiceItem.update({
    where: { id: itemId },
    data: {
      isActive: false,
    },
  });

  // Log event
  await logEvent("ChoiceItem", itemId, EventType.CHOICE_ITEM_DEACTIVATED, userId, {
    tripId: item.choice.tripId,
    name: item.name,
  });

  return deactivated;
}

/**
 * A6. Get all Choices for a Trip
 */
export async function getTripChoices(
  tripId: string,
  options: {
    includeClosed?: boolean;
    includeArchived?: boolean;
  } = {}
) {
  const where: Prisma.ChoiceWhereInput = {
    tripId,
    ...(options.includeArchived === false && { archivedAt: null }),
    ...(options.includeClosed === false && { status: "OPEN" }),
  };

  const choices = await prisma.choice.findMany({
    where,
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
      _count: {
        select: {
          items: true,
          selections: true,
        },
      },
    },
    orderBy: [
      { datetime: "asc" },
      { createdAt: "desc" },
    ],
  });

  return choices;
}

// ============================================================================
// Selection Management (Epic B)
// ============================================================================

/**
 * B1. Get Choice Detail with items and user's selections
 */
export async function getChoiceDetail(choiceId: string, userId: string) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
      items: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  // Get user's current selection
  const mySelection = await prisma.choiceSelection.findUnique({
    where: {
      choiceId_userId: {
        choiceId,
        userId,
      },
    },
    include: {
      lines: {
        include: {
          item: true,
        },
      },
    },
  });

  // Calculate user's total
  let myTotal: number | undefined;
  if (mySelection) {
    myTotal = mySelection.lines.reduce((sum, line) => {
      const itemPrice = line.item.price ? parseFloat(line.item.price.toString()) : 0;
      return sum + (itemPrice * line.quantity);
    }, 0);
  }

  return {
    choice,
    items: choice.items,
    mySelections: mySelection?.lines || [],
    myTotal,
  };
}

/**
 * B2. Create or Update Selections (with cap validation)
 */
export async function createOrUpdateSelection(
  choiceId: string,
  userId: string,
  data: CreateSelectionData
) {
  // Check if choice is open
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  if (choice.status === "CLOSED") {
    throw new Error("Choice is closed for selections");
  }

  if (choice.archivedAt) {
    throw new Error("Choice is archived");
  }

  // Check deadline
  if (choice.deadline && new Date() > choice.deadline) {
    throw new Error("Choice deadline has passed");
  }

  // Fetch all items to validate caps
  const items = await prisma.choiceItem.findMany({
    where: {
      id: { in: data.lines.map(l => l.itemId) },
    },
    include: {
      lines: {
        include: {
          selection: true,
        },
      },
    },
  });

  // Validate each line against caps
  for (const line of data.lines) {
    const item = items.find(i => i.id === line.itemId);
    if (!item) {
      throw new Error(`Item ${line.itemId} not found`);
    }

    if (!item.isActive) {
      throw new Error(`Item "${item.name}" is no longer active`);
    }

    // Check maxPerUser
    if (item.maxPerUser && line.quantity > item.maxPerUser) {
      throw new Error(
        `Item "${item.name}" exceeds per-user limit of ${item.maxPerUser}`
      );
    }

    // Check maxTotal across all users
    if (item.maxTotal) {
      // Calculate current total (excluding this user's current selection)
      const currentTotal = item.lines
        .filter(l => l.selection.userId !== userId)
        .reduce((sum, l) => sum + l.quantity, 0);

      const newTotal = currentTotal + line.quantity;

      if (newTotal > item.maxTotal) {
        throw new Error(
          `Item "${item.name}" would exceed total stock limit of ${item.maxTotal} (current: ${currentTotal}, requested: ${line.quantity})`
        );
      }
    }
  }

  // Use transaction to atomically update/create selection
  const result = await prisma.$transaction(async (tx) => {
    // Find or create selection
    let selection = await tx.choiceSelection.findUnique({
      where: {
        choiceId_userId: {
          choiceId,
          userId,
        },
      },
    });

    const isNew = !selection;

    if (!selection) {
      selection = await tx.choiceSelection.create({
        data: {
          choiceId,
          userId,
        },
      });
    } else {
      // Delete existing lines
      await tx.choiceSelectionLine.deleteMany({
        where: { selectionId: selection.id },
      });

      // Update timestamp
      selection = await tx.choiceSelection.update({
        where: { id: selection.id },
        data: { updatedAt: new Date() },
      });
    }

    // Create new lines
    await tx.choiceSelectionLine.createMany({
      data: data.lines.map(line => ({
        selectionId: selection.id,
        itemId: line.itemId,
        quantity: line.quantity,
        note: line.note,
      })),
    });

    // Fetch complete selection with lines
    const completeSelection = await tx.choiceSelection.findUnique({
      where: { id: selection.id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    });

    return { selection: completeSelection, isNew };
  });

  // Log event
  const eventType = result.isNew ? EventType.CHOICE_SELECTION_CREATED : EventType.CHOICE_SELECTION_UPDATED;
  await logEvent("ChoiceSelection", result.selection!.id, eventType, userId, {
    tripId: choice.tripId,
    choiceId,
    lineCount: data.lines.length,
  });

  // Calculate total
  const myTotal = result.selection!.lines.reduce((sum, line) => {
    const itemPrice = line.item.price ? parseFloat(line.item.price.toString()) : 0;
    return sum + (itemPrice * line.quantity);
  }, 0);

  return {
    mySelections: result.selection!.lines,
    myTotal,
  };
}

/**
 * B3. Delete User's Selection
 */
export async function deleteSelection(choiceId: string, userId: string) {
  const selection = await prisma.choiceSelection.findUnique({
    where: {
      choiceId_userId: {
        choiceId,
        userId,
      },
    },
    include: {
      choice: true,
    },
  });

  if (!selection) {
    throw new Error("Selection not found");
  }

  // Check if choice is open
  if (selection.choice.status === "CLOSED") {
    throw new Error("Choice is closed for modifications");
  }

  await prisma.choiceSelection.delete({
    where: { id: selection.id },
  });

  // Log event
  await logEvent("ChoiceSelection", selection.id, EventType.CHOICE_SELECTION_DELETED, userId, {
    tripId: selection.choice.tripId,
    choiceId,
  });

  return { success: true };
}

/**
 * B5. Get respondents for a Choice
 */
export async function getChoiceRespondents(choiceId: string, tripId: string) {
  // Get all active trip members (excluding deleted)
  const tripMembers = await prisma.tripMember.findMany({
    where: {
      tripId,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
    },
  });

  const allUserIds = tripMembers.map(m => m.userId);

  // Get users who have selections
  const selections = await prisma.choiceSelection.findMany({
    where: { choiceId },
    select: { userId: true },
  });

  const respondedUserIds = selections.map(s => s.userId);
  const pendingUserIds = allUserIds.filter(id => !respondedUserIds.includes(id));

  // Build user details maps
  const respondedUsers = tripMembers
    .filter(m => respondedUserIds.includes(m.userId))
    .map(m => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      photoURL: m.user.photoURL,
    }));

  const pendingUsers = tripMembers
    .filter(m => pendingUserIds.includes(m.userId))
    .map(m => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      photoURL: m.user.photoURL,
    }));

  return {
    respondedUserIds,
    pendingUserIds,
    respondedUsers,
    pendingUsers,
  };
}

/**
 * B6. Update user's overall note for their selection
 */
export async function updateSelectionNote(
  choiceId: string,
  userId: string,
  note?: string
) {
  const selection = await prisma.choiceSelection.findUnique({
    where: {
      choiceId_userId: {
        choiceId,
        userId,
      },
    },
  });

  if (!selection) {
    // Create selection if it doesn't exist
    const newSelection = await prisma.choiceSelection.create({
      data: {
        choiceId,
        userId,
        note,
      },
    });
    return { note: newSelection.note };
  }

  const updated = await prisma.choiceSelection.update({
    where: { id: selection.id },
    data: { note },
  });

  return { note: updated.note };
}

// ============================================================================
// Reporting (Epic C)
// ============================================================================

/**
 * C1. Get Item Totals Report
 */
export async function getItemsReport(choiceId: string) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
    include: {
      items: {
        include: {
          lines: {
            include: {
              selection: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      displayName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  const items = choice.items.map(item => {
    const qtyTotal = item.lines.reduce((sum, line) => sum + line.quantity, 0);
    const userIds = new Set(item.lines.map(line => line.selection.userId));
    const distinctUsers = userIds.size;

    // Get unique users with their display names (fallback to email)
    const usersMap = new Map();
    item.lines.forEach(line => {
      if (!usersMap.has(line.selection.userId)) {
        const userName = line.selection.user.displayName || line.selection.user.email;
        usersMap.set(line.selection.userId, userName);
      }
    });
    const userNames = Array.from(usersMap.values());

    const totalPrice = item.price
      ? parseFloat(item.price.toString()) * qtyTotal
      : null;

    return {
      itemId: item.id,
      name: item.name,
      qtyTotal,
      totalPrice,
      distinctUsers,
      userNames,
    };
  });

  const grandTotalPrice = items.reduce((sum, item) => {
    return sum + (item.totalPrice || 0);
  }, 0);

  return {
    items,
    grandTotalPrice: grandTotalPrice > 0 ? grandTotalPrice : null,
  };
}

/**
 * C2. Get Per-User Report
 */
export async function getUsersReport(choiceId: string) {
  const selections = await prisma.choiceSelection.findMany({
    where: { choiceId },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      lines: {
        include: {
          item: true,
        },
      },
    },
    orderBy: {
      user: {
        displayName: "asc",
      },
    },
  });

  const users = selections.map(selection => {
    const lines = selection.lines.map(line => ({
      itemName: line.item.name,
      quantity: line.quantity,
      linePrice: line.item.price
        ? parseFloat(line.item.price.toString()) * line.quantity
        : null,
      note: line.note,
    }));

    const userTotalPrice = lines.reduce((sum, line) => {
      return sum + (line.linePrice || 0);
    }, 0);

    return {
      userId: selection.userId,
      displayName: selection.user.displayName || selection.user.email,
      note: selection.note,
      lines,
      userTotalPrice: userTotalPrice > 0 ? userTotalPrice : null,
    };
  });

  const grandTotalPrice = users.reduce((sum, user) => {
    return sum + (user.userTotalPrice || 0);
  }, 0);

  return {
    users,
    grandTotalPrice: grandTotalPrice > 0 ? grandTotalPrice : null,
  };
}

// ============================================================================
// Activity Log (Epic E2)
// ============================================================================

/**
 * E2. Get Activity Log for a Choice
 */
export async function getChoiceActivity(choiceId: string) {
  const activities = await prisma.choiceActivity.findMany({
    where: { choiceId },
    orderBy: { createdAt: "desc" },
  });

  return activities;
}

// ============================================================================
// Spend Integration (Epic F)
// ============================================================================

/**
 * F1. Create Spend from Choice Report
 */
export async function createSpendFromChoice(
  choiceId: string,
  userId: string,
  mode: "byItem" | "byUser"
) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
    include: {
      trip: true,
      items: {
        include: {
          lines: {
            include: {
              selection: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!choice) {
    throw new Error("Choice not found");
  }

  // Get the appropriate report
  const itemsReport = await getItemsReport(choiceId);
  const usersReport = await getUsersReport(choiceId);

  if (!itemsReport.grandTotalPrice || itemsReport.grandTotalPrice === 0) {
    throw new Error("Cannot create spend with zero total");
  }

  // Create spend
  const spend = await prisma.spend.create({
    data: {
      tripId: choice.tripId,
      description: `${choice.name} - Menu Order`,
      amount: new Decimal(itemsReport.grandTotalPrice),
      currency: choice.trip.baseCurrency,
      fxRate: new Decimal(1.0),
      normalizedAmount: new Decimal(itemsReport.grandTotalPrice),
      paidById: userId,
      date: choice.datetime || new Date(),
      status: "OPEN",
      notes: `Auto-generated from choice: ${choice.name}`,
    },
  });

  // Log event
  await logEvent("Spend", spend.id, EventType.SPEND_CREATED, userId, {
    tripId: choice.tripId,
    fromChoiceId: choiceId,
    description: spend.description,
  });

  if (mode === "byItem") {
    // Create spend items for each user's selection of each menu item
    // This allows each item to show who ordered it (assignedUserId)

    // Group selections by user and item
    const userItemSelections = new Map<string, Map<string, { itemName: string; quantity: number; price: number }>>();

    for (const choiceItem of choice.items) {
      const itemPrice = choiceItem.price ? parseFloat(choiceItem.price.toString()) : 0;
      if (itemPrice > 0) {
        for (const line of choiceItem.lines) {
          const selectedUserId = line.selection.userId;

          if (!userItemSelections.has(selectedUserId)) {
            userItemSelections.set(selectedUserId, new Map());
          }

          const userItems = userItemSelections.get(selectedUserId)!;
          const existingSelection = userItems.get(choiceItem.id);

          if (existingSelection) {
            // Add to existing quantity
            existingSelection.quantity += line.quantity;
          } else {
            // New selection
            userItems.set(choiceItem.id, {
              itemName: choiceItem.name,
              quantity: line.quantity,
              price: itemPrice,
            });
          }
        }
      }
    }

    // Create spend items for each user's selection
    // Track total per user for assignments
    const userTotals = new Map<string, number>();

    for (const [selectedUserId, userItems] of userItemSelections.entries()) {
      let userTotal = 0;

      for (const [itemId, selection] of userItems.entries()) {
        const itemCost = selection.price * selection.quantity;
        userTotal += itemCost;

        // Create a spend item for this user's selection of this item
        await prisma.spendItem.create({
          data: {
            spendId: spend.id,
            name: selection.itemName,
            description: `Qty: ${selection.quantity}`,
            cost: new Decimal(itemCost),
            assignedUserId: selectedUserId,
            createdById: userId,
          },
        });
      }

      userTotals.set(selectedUserId, userTotal);
    }

    // Create one assignment per user with their total
    for (const [selectedUserId, totalAmount] of userTotals.entries()) {
      if (totalAmount > 0) {
        await prisma.spendAssignment.create({
          data: {
            spendId: spend.id,
            userId: selectedUserId,
            shareAmount: new Decimal(totalAmount),
            normalizedShareAmount: new Decimal(totalAmount),
            splitType: "EXACT",
          },
        });
      }
    }
  } else if (mode === "byUser") {
    // Create spend items for each user's total
    for (const user of usersReport.users) {
      if (user.userTotalPrice && user.userTotalPrice > 0) {
        const userName = user.displayName || user.userId;
        const itemDescription = user.lines
          .map(l => `${l.quantity}x ${l.itemName}`)
          .join(", ");

        const spendItem = await prisma.spendItem.create({
          data: {
            spendId: spend.id,
            name: `${userName}'s order`,
            description: itemDescription.substring(0, 280), // Truncate to fit
            cost: new Decimal(user.userTotalPrice),
            assignedUserId: user.userId,
            createdById: userId,
          },
        });

        // Create assignment for this user, linked to their specific item
        await prisma.spendAssignment.create({
          data: {
            spendId: spend.id,
            itemId: spendItem.id,
            userId: user.userId,
            shareAmount: new Decimal(user.userTotalPrice),
            normalizedShareAmount: new Decimal(user.userTotalPrice),
            splitType: "EXACT",
          },
        });
      }
    }
  }

  // Create activity log linking back to choice
  await prisma.choiceActivity.create({
    data: {
      choiceId,
      actorId: userId,
      action: "spend_created",
      payload: { spendId: spend.id, mode },
    },
  });

  return { spendId: spend.id };
}
