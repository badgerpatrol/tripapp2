/**
 * Choice Service
 * Handles business logic for menu choices/voting system
 */

import { prisma } from "@/lib/prisma";
import { ChoiceStatus, Prisma, EventType } from "@/lib/generated/prisma";
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
  data: CreateChoiceData
) {
  const choice = await prisma.choice.create({
    data: {
      tripId,
      name: data.name,
      description: data.description,
      datetime: data.datetime,
      place: data.place,
      visibility: data.visibility || "TRIP",
      status: "OPEN",
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

  // Log event
  await logEvent("Choice", choice.id, EventType.CHOICE_CREATED, userId, {
    tripId,
    name: data.name,
  });

  // Create activity log
  await prisma.choiceActivity.create({
    data: {
      choiceId: choice.id,
      actorId: userId,
      action: "created",
      payload: { name: data.name },
    },
  });

  return choice;
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

  const updateData: Prisma.ChoiceUpdateInput = { status };
  if (deadline !== undefined) updateData.deadline = deadline;

  const updated = await prisma.choice.update({
    where: { id: choiceId },
    data: updateData,
  });

  // Log event
  const eventType = status === "CLOSED" ? EventType.CHOICE_CLOSED : EventType.CHOICE_REOPENED;
  await logEvent("Choice", choiceId, eventType, userId, {
    tripId: choice.tripId,
    status,
    deadline,
  });

  // Create activity log
  await prisma.choiceActivity.create({
    data: {
      choiceId,
      actorId: userId,
      action: status === "CLOSED" ? "closed" : "reopened",
      payload: { status, deadline },
    },
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

  const archived = await prisma.choice.update({
    where: { id: choiceId },
    data: {
      archivedAt: new Date(),
    },
  });

  // Log event
  await logEvent("Choice", choiceId, EventType.CHOICE_ARCHIVED, userId, {
    tripId: choice.tripId,
  });

  // Create activity log
  await prisma.choiceActivity.create({
    data: {
      choiceId,
      actorId: userId,
      action: "archived",
    },
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
  // Get all trip members
  const tripMembers = await prisma.tripMember.findMany({
    where: { tripId },
    select: { userId: true },
  });

  const allUserIds = tripMembers.map(m => m.userId);

  // Get users who have selections
  const selections = await prisma.choiceSelection.findMany({
    where: { choiceId },
    select: { userId: true },
  });

  const respondedUserIds = selections.map(s => s.userId);
  const pendingUserIds = allUserIds.filter(id => !respondedUserIds.includes(id));

  return {
    respondedUserIds,
    pendingUserIds,
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

  const items = choice.items.map(item => {
    const qtyTotal = item.lines.reduce((sum, line) => sum + line.quantity, 0);
    const distinctUsers = new Set(item.lines.map(line => line.selection.userId)).size;
    const totalPrice = item.price
      ? parseFloat(item.price.toString()) * qtyTotal
      : null;

    return {
      itemId: item.id,
      name: item.name,
      qtyTotal,
      totalPrice,
      distinctUsers,
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
      displayName: selection.user.displayName,
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
