import { prisma } from "@/lib/prisma";
import { EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import type { CreateSpendInput } from "@/types/schemas";
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
 * Gets all spends for a trip.
 */
export async function getTripSpends(tripId: string) {
  return prisma.spend.findMany({
    where: {
      tripId,
      deletedAt: null,
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
    orderBy: {
      date: "desc",
    },
  });
}

/**
 * Soft deletes a spend (sets deletedAt timestamp).
 */
export async function deleteSpend(spendId: string, userId: string) {
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
