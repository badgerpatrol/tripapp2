import { prisma } from "@/lib/prisma";
import { EventType, SpendStatus } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import type { CreateSpendItemInput, UpdateSpendItemInput } from "@/types/schemas";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * SpendItem Service Layer
 * Handles CRUD operations for spend items with automatic assignment sync
 */

/**
 * Syncs item assignment: ensures exactly one Assignment row exists when userId is set,
 * or removes assignment when userId is null.
 *
 * This is called within a transaction to ensure atomicity.
 *
 * @param tx - Prisma transaction client
 * @param itemId - SpendItem ID
 * @param spendId - Spend ID
 * @param userId - User ID to assign (or null to unassign)
 * @param cost - Item cost (becomes shareAmount)
 * @param spend - Spend object with currency info for normalized calculation
 * @param actorUserId - User performing the action (for event logging)
 */
async function syncItemAssignment(
  tx: any,
  itemId: string,
  spendId: string,
  userId: string | null,
  cost: number,
  spend: { fxRate: Decimal; tripId: string },
  actorUserId: string
) {
  // Find existing assignment for this item
  const existingAssignment = await tx.spendAssignment.findFirst({
    where: { spendId, itemId },
  });

  if (userId === null) {
    // Unassign: delete existing assignment if present
    if (existingAssignment) {
      await tx.spendAssignment.delete({
        where: { id: existingAssignment.id },
      });

      await logEvent("SpendAssignment", existingAssignment.id, EventType.ASSIGNMENT_DELETED, actorUserId, {
        spendId,
        itemId,
        userId: existingAssignment.userId,
        reason: "Item unassigned",
      });
    }
  } else {
    // Assign: create or update assignment
    const shareAmount = new Decimal(cost);
    const normalizedShareAmount = shareAmount.mul(spend.fxRate);

    if (existingAssignment) {
      // Check if we're changing the user or just the amount
      if (existingAssignment.userId !== userId) {
        // Moving to a different user: delete old, create new
        await tx.spendAssignment.delete({
          where: { id: existingAssignment.id },
        });

        // Check if the new user already has an assignment for this spend (without an itemId)
        const newUserAssignment = await tx.spendAssignment.findUnique({
          where: {
            spendId_userId: { spendId, userId },
          },
        });

        if (newUserAssignment && !newUserAssignment.itemId) {
          // Update existing assignment to link to this item
          await tx.spendAssignment.update({
            where: { id: newUserAssignment.id },
            data: {
              itemId,
              shareAmount,
              normalizedShareAmount,
              splitType: "EXACT",
            },
          });
        } else {
          // Create new assignment
          await tx.spendAssignment.create({
            data: {
              spendId,
              itemId,
              userId,
              shareAmount,
              normalizedShareAmount,
              splitType: "EXACT",
            },
          });
        }

        await logEvent("SpendAssignment", "system", EventType.ASSIGNMENT_MOVED, actorUserId, {
          spendId,
          itemId,
          fromUserId: existingAssignment.userId,
          toUserId: userId,
          shareAmount: cost,
        });
      } else {
        // Same user, just update the amount
        await tx.spendAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            shareAmount,
            normalizedShareAmount,
          },
        });

        await logEvent("SpendAssignment", existingAssignment.id, EventType.ASSIGNMENT_UPDATED, actorUserId, {
          spendId,
          itemId,
          userId,
          newAmount: cost,
        });
      }
    } else {
      // No existing assignment for this item, check if user has assignment for spend
      const userAssignment = await tx.spendAssignment.findUnique({
        where: {
          spendId_userId: { spendId, userId },
        },
      });

      if (userAssignment && !userAssignment.itemId) {
        // Update existing unlinked assignment to link to this item
        await tx.spendAssignment.update({
          where: { id: userAssignment.id },
          data: {
            itemId,
            shareAmount,
            normalizedShareAmount,
            splitType: "EXACT",
          },
        });

        await logEvent("SpendAssignment", userAssignment.id, EventType.ASSIGNMENT_UPDATED, actorUserId, {
          spendId,
          itemId,
          userId,
          shareAmount: cost,
        });
      } else {
        // Create new assignment
        const newAssignment = await tx.spendAssignment.create({
          data: {
            spendId,
            itemId,
            userId,
            shareAmount,
            normalizedShareAmount,
            splitType: "EXACT",
          },
        });

        await logEvent("SpendAssignment", newAssignment.id, EventType.ASSIGNMENT_CREATED, actorUserId, {
          spendId,
          itemId,
          userId,
          shareAmount: cost,
        });
      }
    }
  }
}

/**
 * Creates a new spend item.
 * If userId is provided, creates/updates a single Assignment row linking item to debtor.
 *
 * @param spendId - Spend ID
 * @param userId - User creating the item
 * @param data - Item creation data
 * @returns Created item with full details
 */
export async function createSpendItem(spendId: string, userId: string, data: CreateSpendItemInput) {
  // Get spend and check if it's editable
  const spend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    select: {
      id: true,
      status: true,
      fxRate: true,
      tripId: true,
      trip: {
        select: {
          spendStatus: true,
        },
      },
    },
  });

  if (!spend) {
    throw new Error("Spend not found");
  }

  if (spend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot add items to a closed spend");
  }

  if (spend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot add items. The trip organizer has closed spending for this trip.");
  }

  // Create item and sync assignment in a transaction
  return prisma.$transaction(async (tx) => {
    const item = await tx.spendItem.create({
      data: {
        spendId,
        name: data.name,
        description: data.description || null,
        cost: new Decimal(data.cost),
        assignedUserId: data.userId || null,
        createdById: userId,
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
      },
    });

    // Log item creation
    await logEvent("SpendItem", item.id, EventType.SPEND_ITEM_CREATED, userId, {
      spendId,
      name: item.name,
      cost: item.cost.toString(),
      assignedUserId: data.userId || null,
    });

    // Sync assignment if userId provided
    if (data.userId) {
      await syncItemAssignment(tx, item.id, spendId, data.userId, data.cost, spend, userId);
    }

    return item;
  });
}

/**
 * Updates a spend item.
 * Automatically syncs assignment when userId or cost changes.
 *
 * @param itemId - Item ID
 * @param userId - User making the update
 * @param data - Item update data
 * @returns Updated item with full details
 */
export async function updateSpendItem(itemId: string, userId: string, data: UpdateSpendItemInput) {
  // Get existing item and spend
  const existingItem = await prisma.spendItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      spendId: true,
      name: true,
      description: true,
      cost: true,
      assignedUserId: true,
      spend: {
        select: {
          id: true,
          status: true,
          fxRate: true,
          tripId: true,
          trip: {
            select: {
              spendStatus: true,
            },
          },
        },
      },
    },
  });

  if (!existingItem) {
    throw new Error("Item not found");
  }

  if (existingItem.spend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot update items on a closed spend");
  }

  if (existingItem.spend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot update items. The trip organizer has closed spending for this trip.");
  }

  // Determine new values (use existing if not provided)
  const newUserId = data.userId !== undefined ? data.userId : existingItem.assignedUserId;
  const newCost = data.cost !== undefined ? data.cost : Number(existingItem.cost);

  // Update item and sync assignment in a transaction
  return prisma.$transaction(async (tx) => {
    const item = await tx.spendItem.update({
      where: { id: itemId },
      data: {
        name: data.name,
        description: data.description !== undefined ? data.description : undefined,
        cost: data.cost !== undefined ? new Decimal(data.cost) : undefined,
        assignedUserId: data.userId !== undefined ? data.userId : undefined,
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
      },
    });

    // Log item update
    await logEvent("SpendItem", item.id, EventType.SPEND_ITEM_UPDATED, userId, {
      spendId: existingItem.spendId,
      name: item.name,
      cost: item.cost.toString(),
      assignedUserId: newUserId,
      changes: {
        userId: data.userId !== undefined,
        cost: data.cost !== undefined,
        name: data.name !== undefined,
        description: data.description !== undefined,
      },
    });

    // Sync assignment if userId or cost changed
    if (data.userId !== undefined || data.cost !== undefined) {
      await syncItemAssignment(
        tx,
        itemId,
        existingItem.spendId,
        newUserId,
        newCost,
        existingItem.spend,
        userId
      );
    }

    return item;
  });
}

/**
 * Deletes a spend item.
 * Automatically removes linked assignment.
 *
 * @param itemId - Item ID
 * @param userId - User making the deletion
 */
export async function deleteSpendItem(itemId: string, userId: string) {
  // Get existing item and spend
  const existingItem = await prisma.spendItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      spendId: true,
      name: true,
      cost: true,
      assignedUserId: true,
      spend: {
        select: {
          status: true,
          trip: {
            select: {
              spendStatus: true,
            },
          },
        },
      },
    },
  });

  if (!existingItem) {
    throw new Error("Item not found");
  }

  if (existingItem.spend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot delete items from a closed spend");
  }

  if (existingItem.spend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot delete items. The trip organizer has closed spending for this trip.");
  }

  // Delete item and cascade to assignments in a transaction
  return prisma.$transaction(async (tx) => {
    // Find and delete linked assignment if exists
    const linkedAssignment = await tx.spendAssignment.findFirst({
      where: { spendId: existingItem.spendId, itemId },
    });

    if (linkedAssignment) {
      const assignedUserId = linkedAssignment.userId;

      // Delete the assignment for this item
      await tx.spendAssignment.delete({
        where: { id: linkedAssignment.id },
      });

      await logEvent("SpendAssignment", linkedAssignment.id, EventType.ASSIGNMENT_DELETED, userId, {
        spendId: existingItem.spendId,
        itemId,
        userId: assignedUserId,
        reason: "Item deleted",
      });

      // Check if user has any other assignments for this spend
      const remainingAssignments = await tx.spendAssignment.findFirst({
        where: {
          spendId: existingItem.spendId,
          userId: assignedUserId
        },
      });

      // If no other assignments exist, create a zero-amount assignment to keep user on spend
      if (!remainingAssignments) {
        const newAssignment = await tx.spendAssignment.upsert({
          where: {
            spendId_userId: {
              spendId: existingItem.spendId,
              userId: assignedUserId,
            },
          },
          create: {
            spendId: existingItem.spendId,
            userId: assignedUserId,
            shareAmount: new Decimal(0),
            normalizedShareAmount: new Decimal(0),
            splitType: "EXACT",
            itemId: null,
          },
          update: {
            shareAmount: new Decimal(0),
            normalizedShareAmount: new Decimal(0),
            splitType: "EXACT",
            itemId: null,
          },
        });

        await logEvent("SpendAssignment", newAssignment.id, EventType.ASSIGNMENT_CREATED, userId, {
          spendId: existingItem.spendId,
          userId: assignedUserId,
          reason: "User kept on spend after last item deleted",
          shareAmount: 0,
        });
      }
    }

    // Delete item
    await tx.spendItem.delete({
      where: { id: itemId },
    });

    // Log item deletion
    await logEvent("SpendItem", itemId, EventType.SPEND_ITEM_DELETED, userId, {
      spendId: existingItem.spendId,
      name: existingItem.name,
      cost: existingItem.cost.toString(),
      assignedUserId: existingItem.assignedUserId,
    });
  });
}

/**
 * Gets all items for a spend with optional assignment details.
 *
 * @param spendId - Spend ID
 * @returns List of items with full details
 */
export async function getSpendItems(spendId: string) {
  return prisma.spendItem.findMany({
    where: { spendId },
    include: {
      assignedUser: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Gets a single item by ID with full details.
 *
 * @param itemId - Item ID
 * @returns Item with full details or null if not found
 */
export async function getSpendItemById(itemId: string) {
  return prisma.spendItem.findUnique({
    where: { id: itemId },
    include: {
      assignedUser: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
      spend: {
        select: {
          id: true,
          tripId: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
    },
  });
}

/**
 * Gets items and assignments for a spend with summary calculations.
 *
 * @param spendId - Spend ID
 * @returns Items, assignments, and summary metrics
 */
export async function getSpendItemsWithSummary(spendId: string) {
  try {
    console.log('[getSpendItemsWithSummary] Starting for spendId:', spendId);
    console.log('[getSpendItemsWithSummary] prisma object:', typeof prisma, !!prisma);
    console.log('[getSpendItemsWithSummary] prisma.spendAssignment:', typeof prisma?.spendAssignment);

    const [items, assignments, spend] = await Promise.all([
      getSpendItems(spendId),
      prisma.spendAssignment.findMany({
        where: { spendId },
      }),
      prisma.spend.findUnique({
        where: { id: spendId },
        select: { amount: true },
      }),
    ]);

    console.log('[getSpendItemsWithSummary] Success - items:', items.length, 'assignments:', assignments.length);

    return {
      items,
      assignments,
      spendAmount: spend?.amount || 0,
    };
  } catch (error) {
    console.error('[getSpendItemsWithSummary] Error:', error);
    throw error;
  }
}

/**
 * Recalculates and updates the spend total based on the sum of all item costs.
 * Also updates the normalized amount using the existing FX rate.
 *
 * @param spendId - Spend ID
 * @param userId - User performing the action (for event logging)
 * @returns Updated spend object
 */
export async function recalculateSpendFromItems(spendId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // Get all items for this spend
    const items = await tx.spendItem.findMany({
      where: { spendId },
      select: { cost: true },
    });

    // Calculate total from items
    const itemsTotal = items.reduce(
      (sum, item) => sum.add(item.cost),
      new Decimal(0)
    );

    // Get current spend to access fxRate
    const currentSpend = await tx.spend.findUnique({
      where: { id: spendId },
      select: { fxRate: true, amount: true },
    });

    if (!currentSpend) {
      throw new Error("Spend not found");
    }

    // Calculate normalized amount
    const normalizedAmount = itemsTotal.mul(currentSpend.fxRate);

    // Update spend with new total
    const updatedSpend = await tx.spend.update({
      where: { id: spendId },
      data: {
        amount: itemsTotal,
        normalizedAmount,
      },
      include: {
        paidBy: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log the recalculation
    await logEvent("Spend", spendId, EventType.SPEND_UPDATED, userId, {
      action: "recalculated_from_items",
      oldAmount: currentSpend.amount.toString(),
      newAmount: itemsTotal.toString(),
      itemCount: items.length,
    });

    return updatedSpend;
  });
}
