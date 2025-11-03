/**
 * Settlement calculation service
 * Computes per-person balances and minimal settlement plans using graph reduction
 */

import { prisma } from "@/lib/prisma";
import { logEvent } from "@/server/eventLog";
import { EventType, SettlementStatus } from "@/lib/generated/prisma";

// ============================================================================
// Types
// ============================================================================

export interface PersonBalance {
  userId: string;
  userName: string;
  userEmail: string;
  userPhotoURL: string | null;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // Positive = owed money, Negative = owes money
}

export interface SettlementTransfer {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  oldestDebtDate: Date | null; // Date of oldest spend contributing to this debt
}

export interface TripBalanceSummary {
  tripId: string;
  baseCurrency: string;
  totalSpent: number;
  balances: PersonBalance[];
  settlements: SettlementTransfer[];
  calculatedAt: Date;
}

// ============================================================================
// Balance Calculation
// ============================================================================

/**
 * Calculates per-person balances for a trip
 * Returns who paid what, who owes what, and the net balance for each person
 */
export async function calculateTripBalances(
  tripId: string
): Promise<TripBalanceSummary> {
  // Get trip info
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, deletedAt: null },
    select: {
      id: true,
      baseCurrency: true,
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // Get all spends and assignments for this trip
  const spends = await prisma.spend.findMany({
    where: {
      tripId,
      deletedAt: null,
    },
    include: {
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              photoURL: true,
            },
          },
        },
      },
      paidBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
          photoURL: true,
        },
      },
    },
    orderBy: {
      date: "asc", // Oldest first for debt age tracking
    },
  });

  // Calculate total spent
  const totalSpent = spends.reduce(
    (sum, spend) => sum + Number(spend.normalizedAmount),
    0
  );

  // Build map of user balances
  const balanceMap = new Map<
    string,
    {
      user: {
        id: string;
        displayName: string | null;
        email: string;
        photoURL: string | null;
      };
      totalPaid: number;
      totalOwed: number;
      oldestDebtDate: Date | null;
    }
  >();

  // Track oldest debt date per user pair (for debt age)
  const debtAgeMap = new Map<string, Date>(); // key: "fromUserId-toUserId"

  // Process each spend
  for (const spend of spends) {
    const paidById = spend.paidById;
    const totalPaid = Number(spend.normalizedAmount);

    // Initialize payer if not exists
    if (!balanceMap.has(paidById)) {
      balanceMap.set(paidById, {
        user: spend.paidBy,
        totalPaid: 0,
        totalOwed: 0,
        oldestDebtDate: null,
      });
    }

    // Add to payer's total paid
    const payerBalance = balanceMap.get(paidById)!;
    payerBalance.totalPaid += totalPaid;

    // Process assignments
    for (const assignment of spend.assignments) {
      const assignedUserId = assignment.userId;
      const shareAmount = Number(assignment.normalizedShareAmount);

      // Initialize assigned user if not exists
      if (!balanceMap.has(assignedUserId)) {
        balanceMap.set(assignedUserId, {
          user: assignment.user,
          totalPaid: 0,
          totalOwed: 0,
          oldestDebtDate: null,
        });
      }

      // Add to user's total owed
      const userBalance = balanceMap.get(assignedUserId)!;
      userBalance.totalOwed += shareAmount;

      // Track debt age (if user owes payer and it's not themselves)
      if (assignedUserId !== paidById && shareAmount > 0) {
        const debtKey = `${assignedUserId}-${paidById}`;
        const currentOldest = debtAgeMap.get(debtKey);
        if (!currentOldest || spend.date < currentOldest) {
          debtAgeMap.set(debtKey, spend.date);
        }
      }
    }
  }

  // Convert to PersonBalance array
  const balances: PersonBalance[] = Array.from(balanceMap.entries()).map(
    ([userId, data]) => ({
      userId,
      userName: data.user.displayName || data.user.email,
      userEmail: data.user.email,
      userPhotoURL: data.user.photoURL,
      totalPaid: data.totalPaid,
      totalOwed: data.totalOwed,
      netBalance: data.totalPaid - data.totalOwed,
    })
  );

  // Calculate minimal settlement plan
  const settlements = calculateMinimalSettlementPlan(
    balances,
    balanceMap,
    debtAgeMap
  );

  return {
    tripId,
    baseCurrency: trip.baseCurrency,
    totalSpent,
    balances,
    settlements,
    calculatedAt: new Date(),
  };
}

// ============================================================================
// Settlement Plan Algorithm
// ============================================================================

/**
 * Calculates minimal settlement plan using greedy graph reduction
 * This minimizes the number of transactions needed to settle all debts
 *
 * Algorithm:
 * 1. Create sorted lists of creditors (owed money) and debtors (owe money)
 * 2. Greedily match largest creditor with largest debtor
 * 3. Settle the smaller amount between them
 * 4. Remove settled party and reduce the other's balance
 * 5. Repeat until all debts settled
 */
function calculateMinimalSettlementPlan(
  balances: PersonBalance[],
  balanceMap: Map<
    string,
    {
      user: {
        id: string;
        displayName: string | null;
        email: string;
        photoURL: string | null;
      };
      totalPaid: number;
      totalOwed: number;
      oldestDebtDate: Date | null;
    }
  >,
  debtAgeMap: Map<string, Date>
): SettlementTransfer[] {
  const settlements: SettlementTransfer[] = [];

  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter((b) => b.netBalance > 0.01) // Small threshold for floating point
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netBalance - a.netBalance); // Largest first

  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.netBalance - b.netBalance); // Most negative first

  let i = 0; // Creditor index
  let j = 0; // Debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    // Amount to transfer is the minimum of what creditor is owed and debtor owes
    const transferAmount = Math.min(
      creditor.netBalance,
      Math.abs(debtor.netBalance)
    );

    // Round to 2 decimal places to avoid floating point issues
    const roundedAmount = Math.round(transferAmount * 100) / 100;

    if (roundedAmount > 0.01) {
      // Get oldest debt date for this pair
      const debtKey = `${debtor.userId}-${creditor.userId}`;
      const oldestDebtDate = debtAgeMap.get(debtKey) || null;

      settlements.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.userName,
        toUserId: creditor.userId,
        toUserName: creditor.userName,
        amount: roundedAmount,
        oldestDebtDate,
      });

      // Update balances
      creditor.netBalance -= roundedAmount;
      debtor.netBalance += roundedAmount;
    }

    // Move to next creditor/debtor if settled
    if (Math.abs(creditor.netBalance) < 0.01) {
      i++;
    }
    if (Math.abs(debtor.netBalance) < 0.01) {
      j++;
    }
  }

  return settlements;
}

// ============================================================================
// Individual User Balance
// ============================================================================

/**
 * Calculates balance for a specific user in a trip
 * Returns how much the user owes and is owed
 */
export async function calculateUserBalance(tripId: string, userId: string) {
  // Get all spends and assignments for this trip
  const spends = await prisma.spend.findMany({
    where: {
      tripId,
      deletedAt: null,
    },
    include: {
      assignments: true,
    },
  });

  let userOwes = 0;
  let userIsOwed = 0;

  for (const spend of spends) {
    const isPayer = spend.paidById === userId;
    const assignment = spend.assignments.find((a) => a.userId === userId);

    if (isPayer) {
      // User paid for this spend
      const totalPaid = Number(spend.normalizedAmount);
      const userShare = assignment ? Number(assignment.normalizedShareAmount) : 0;
      // User is owed the difference (what others owe them)
      userIsOwed += totalPaid - userShare;
    } else if (assignment) {
      // User owes their share
      userOwes += Number(assignment.normalizedShareAmount);
    }
  }

  return { userOwes, userIsOwed };
}

// ============================================================================
// Settlement Persistence (Future: Create Settlement records in DB)
// ============================================================================

/**
 * Creates Settlement records in the database from a calculated settlement plan
 * This allows tracking payment progress over time
 *
 * Note: This is for future implementation when trip spending is closed
 */
export async function persistSettlementPlan(
  tripId: string,
  userId: string
): Promise<void> {
  // Calculate balances
  const balanceSummary = await calculateTripBalances(tripId);

  // Delete any existing pending settlements for this trip
  await prisma.settlement.deleteMany({
    where: {
      tripId,
      status: "PENDING",
    },
  });

  // Create new settlement records
  const settlementRecords = balanceSummary.settlements.map((settlement) => ({
    tripId,
    fromUserId: settlement.fromUserId,
    toUserId: settlement.toUserId,
    amount: settlement.amount,
    status: "PENDING" as const,
    notes: settlement.oldestDebtDate
      ? `Debt since ${settlement.oldestDebtDate.toLocaleDateString()}`
      : undefined,
  }));

  await prisma.settlement.createMany({
    data: settlementRecords,
  });

  // TODO: Send notifications to users about settlements
  // TODO: Log event
}

// ============================================================================
// Payment Recording
// ============================================================================

/**
 * Records a payment towards a settlement
 * Updates settlement status based on total payments
 *
 * @param settlementId - ID of the settlement
 * @param amount - Payment amount (in trip base currency)
 * @param paidAt - Date the payment was made
 * @param recordedById - User ID of who is recording the payment
 * @param paymentMethod - Optional payment method (e.g., "Cash", "Venmo", "Bank Transfer")
 * @param paymentReference - Optional reference (e.g., transaction ID)
 * @param notes - Optional notes about the payment
 */
export async function recordPayment(
  settlementId: string,
  amount: number,
  paidAt: Date,
  recordedById: string,
  paymentMethod?: string,
  paymentReference?: string,
  notes?: string
) {
  // Use transaction to ensure atomicity
  return await prisma.$transaction(async (tx) => {
    // Get settlement with all payments
    const settlement = await tx.settlement.findUnique({
      where: { id: settlementId },
      include: {
        payments: true,
        trip: {
          select: {
            id: true,
            baseCurrency: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new Error("Settlement not found");
    }

    // Calculate total already paid
    const totalPaid = settlement.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    // Calculate new total after this payment
    const newTotalPaid = totalPaid + amount;
    const settlementAmount = Number(settlement.amount);

    // Determine new status
    let newStatus: SettlementStatus;
    if (newTotalPaid >= settlementAmount - 0.01) {
      // Fully paid (with small tolerance for floating point)
      newStatus = SettlementStatus.PAID;
    } else if (totalPaid > 0.01) {
      // Already had some payments
      newStatus = SettlementStatus.PARTIALLY_PAID;
    } else {
      // First payment
      newStatus = SettlementStatus.PARTIALLY_PAID;
    }

    // Create payment record
    const payment = await tx.payment.create({
      data: {
        settlementId,
        amount,
        paidAt,
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
        notes: notes || null,
        recordedById,
      },
    });

    // Update settlement status
    const updatedSettlement = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: newStatus },
    });

    // Log event
    await logEvent(
      "Payment",
      payment.id,
      EventType.PAYMENT_RECORDED,
      recordedById,
      {
        settlementId,
        amount,
        paidAt: paidAt.toISOString(),
        paymentMethod,
        paymentReference,
        newTotalPaid,
        remainingAmount: settlementAmount - newTotalPaid,
        settlementStatus: newStatus,
      }
    );

    return {
      payment,
      settlement: {
        id: updatedSettlement.id,
        status: updatedSettlement.status,
        amount: Number(updatedSettlement.amount),
        totalPaid: newTotalPaid,
        remainingAmount: settlementAmount - newTotalPaid,
      },
    };
  });
}
