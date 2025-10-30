import { prisma } from "@/lib/prisma";
import { EventType, SpendStatus } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import type { CreateSpendInput, UpdateSpendInput, GetSpendsQuery } from "@/types/schemas";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Creates a new spend for a trip.
 * Defaults: created_by = current user, date = now(), fxRate = 1.0
 *
 * @param userId - Firebase UID of the user creating the spend
 * @param data - Spend creation data
 * @returns Created spend object
 */
export async function createSpend(userId: string, data: CreateSpendInput) {
  // Check if trip spend is closed
  const trip = await prisma.trip.findUnique({
    where: { id: data.tripId, deletedAt: null },
    select: { spendStatus: true },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  if (trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot add spends. The trip organizer has closed spending for this trip.");
  }

  // Calculate normalized amount (amount * fxRate)
  const normalizedAmount = data.amount * (data.fxRate || 1.0);

  const spend = await prisma.spend.create({
    data: {
      tripId: data.tripId,
      description: data.description,
      amount: new Decimal(data.amount),
      currency: data.currency,
      fxRate: new Decimal(data.fxRate || 1.0),
      normalizedAmount: new Decimal(normalizedAmount),
      paidById: userId,
      date: data.date || new Date(),
      notes: data.notes || null,
      categoryId: data.categoryId || null,
    },
    include: {
      paidBy: {
        select: {
          id: true,
          email: true,
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

  // Log the event
  await logEvent("Spend", spend.id, EventType.SPEND_CREATED, userId, {
    tripId: spend.tripId,
    description: spend.description,
    amount: spend.amount.toString(),
    currency: spend.currency,
    normalizedAmount: spend.normalizedAmount.toString(),
  });

  return spend;
}

/**
 * Gets a spend by ID with full details.
 */
export async function getSpendById(spendId: string) {
  return prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    include: {
      paidBy: {
        select: {
          id: true,
          email: true,
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
      assignments: {
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
      },
    },
  });
}

/**
 * Gets all spends for a trip with optional filtering and sorting.
 */
export async function getTripSpends(tripId: string, query?: GetSpendsQuery) {
  const where: any = {
    tripId,
    deletedAt: null,
  };

  // Apply filters
  if (query?.status) {
    where.status = query.status;
  }
  if (query?.paidById) {
    where.paidById = query.paidById;
  }

  // Determine sort field and order
  const sortBy = query?.sortBy || "date";
  const sortOrder = query?.sortOrder || "desc";

  return prisma.spend.findMany({
    where,
    include: {
      paidBy: {
        select: {
          id: true,
          email: true,
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
      assignments: {
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
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  });
}

/**
 * Updates a spend.
 * Throws error if spend is closed and trying to change amount/assignments.
 */
export async function updateSpend(spendId: string, userId: string, data: UpdateSpendInput) {
  // Get current spend to check status
  const currentSpend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    include: {
      trip: {
        select: { spendStatus: true },
      },
    },
  });

  if (!currentSpend) {
    throw new Error("Spend not found");
  }

  // Check if trip spending is closed
  if (currentSpend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot edit spends. The trip organizer has closed spending for this trip.");
  }

  // Prevent editing closed spends - completely locked
  if (currentSpend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot edit closed spend. Items and assignments are locked.");
  }

  // Build update data
  const updateData: any = {};

  if (data.description !== undefined) updateData.description = data.description;
  if (data.amount !== undefined) {
    updateData.amount = new Decimal(data.amount);
    // Recalculate normalized amount
    const fxRate = data.fxRate !== undefined ? data.fxRate : currentSpend.fxRate.toNumber();
    updateData.normalizedAmount = new Decimal(data.amount * fxRate);
  }
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.fxRate !== undefined) {
    updateData.fxRate = new Decimal(data.fxRate);
    // Recalculate normalized amount
    const amount = data.amount !== undefined ? data.amount : currentSpend.amount.toNumber();
    updateData.normalizedAmount = new Decimal(amount * data.fxRate);
  }
  if (data.date !== undefined) updateData.date = data.date;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;

  const spend = await prisma.spend.update({
    where: { id: spendId },
    data: updateData,
    include: {
      paidBy: {
        select: {
          id: true,
          email: true,
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
      assignments: {
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
      },
    },
  });

  await logEvent("Spend", spendId, EventType.SPEND_UPDATED, userId, {
    tripId: spend.tripId,
    changes: data,
  });

  return spend;
}

/**
 * Closes a spend (marks as CLOSED).
 * Validates that assignments equal 100% unless force=true.
 * Once closed, the spend and its assignments are locked from editing.
 */
export async function closeSpend(spendId: string, userId: string, force: boolean = false) {
  try {
    const spend = await prisma.spend.findUnique({
      where: { id: spendId, deletedAt: null },
      include: {
        assignments: true,
      },
    });

    if (!spend) {
      throw new Error("Spend not found");
    }

    if (spend.status === SpendStatus.CLOSED) {
      throw new Error("Spend is already closed");
    }

    // Calculate assignment percentage
    const totalAssigned = spend.assignments.reduce(
      (sum, assignment) => sum + assignment.normalizedShareAmount.toNumber(),
      0
    );
    const spendAmount = spend.normalizedAmount.toNumber();
    const assignmentPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

    // Validate assignments unless force=true
    if (!force && Math.abs(assignmentPercentage - 100) > 0.01) {
      throw new Error(
        `Cannot close: assignments total ${assignmentPercentage.toFixed(1)}%, must be 100%. Use force=true to override.`
      );
    }

    const updatedSpend = await prisma.spend.update({
      where: { id: spendId },
      data: { status: SpendStatus.CLOSED },
      include: {
        paidBy: {
          select: {
            id: true,
            email: true,
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
        assignments: {
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
        },
      },
    });

    await logEvent("Spend", spendId, EventType.SPEND_CLOSED, userId, {
      tripId: spend.tripId,
      assignmentPercentage: assignmentPercentage.toFixed(2),
      forced: force,
    });

    return updatedSpend;
  } catch (error) {
    console.error("Error in closeSpend service:", error);
    throw error;
  }
}

/**
 * Reopens a closed spend (marks as OPEN).
 * Allows a spend to become editable again.
 */
export async function reopenSpend(spendId: string, userId: string) {
  const spend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
  });

  if (!spend) {
    throw new Error("Spend not found");
  }

  if (spend.status !== SpendStatus.CLOSED) {
    throw new Error("Spend is not closed");
  }

  const updatedSpend = await prisma.spend.update({
    where: { id: spendId },
    data: { status: SpendStatus.OPEN },
    include: {
      paidBy: {
        select: {
          id: true,
          email: true,
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
      assignments: {
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
      },
    },
  });

  await logEvent("Spend", spendId, EventType.SPEND_UPDATED, userId, {
    tripId: spend.tripId,
    action: "reopened",
  });

  return updatedSpend;
}

/**
 * Calculates the assignment percentage for a spend.
 * Returns percentage (0-100+) of how much is assigned.
 */
export async function calculateAssignmentPercentage(spendId: string): Promise<number> {
  const spend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    include: {
      assignments: true,
    },
  });

  if (!spend) {
    throw new Error("Spend not found");
  }

  const totalAssigned = spend.assignments.reduce(
    (sum, assignment) => sum + assignment.normalizedShareAmount.toNumber(),
    0
  );
  const spendAmount = spend.normalizedAmount.toNumber();

  return spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;
}

/**
 * Soft deletes a spend (sets deletedAt timestamp).
 */
export async function deleteSpend(spendId: string, userId: string) {
  // Check if trip spending is closed
  const currentSpend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    include: {
      trip: {
        select: { spendStatus: true },
      },
    },
  });

  if (!currentSpend) {
    throw new Error("Spend not found");
  }

  if (currentSpend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot delete spends. The trip organizer has closed spending for this trip.");
  }

  const spend = await prisma.spend.update({
    where: { id: spendId },
    data: { deletedAt: new Date() },
  });

  await logEvent("Spend", spendId, EventType.SPEND_DELETED, userId, {
    tripId: spend.tripId,
    description: spend.description,
    amount: spend.amount.toString(),
  });

  return spend;
}
