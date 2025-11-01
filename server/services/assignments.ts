import { prisma } from "@/lib/prisma";
import { SpendStatus, SplitType } from "@/lib/generated/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Creates assignments for a spend.
 * Validates that the spend is not closed before creating assignments.
 *
 * @param spendId - ID of the spend to create assignments for
 * @param assignments - Array of assignment data
 * @returns Created assignments
 */
export async function createAssignments(
  spendId: string,
  assignments: Array<{
    userId: string;
    shareAmount: number;
    normalizedShareAmount: number;
    splitType: SplitType;
    splitValue?: number;
  }>
) {
  // Get the spend to check status
  const spend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    include: {
      trip: {
        select: { spendStatus: true },
      },
    },
  });

  if (!spend) {
    throw new Error("Spend not found");
  }

  // Check if trip spending is closed
  if (spend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot add assignments. The trip organizer has closed spending for this trip.");
  }

  // Prevent adding assignments to closed spends
  if (spend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot add assignments to closed spend. Spend is locked.");
  }

  // Create assignments
  const created = await prisma.$transaction(
    assignments.map((assignment) =>
      prisma.spendAssignment.create({
        data: {
          spendId,
          userId: assignment.userId,
          shareAmount: new Decimal(assignment.shareAmount),
          normalizedShareAmount: new Decimal(assignment.normalizedShareAmount),
          splitType: assignment.splitType,
          splitValue: assignment.splitValue ? new Decimal(assignment.splitValue) : null,
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
      })
    )
  );

  return created;
}

/**
 * Updates an assignment.
 * Validates that the spend is not closed before updating.
 *
 * @param assignmentId - ID of the assignment to update
 * @param data - Updated assignment data
 * @returns Updated assignment
 */
export async function updateAssignment(
  assignmentId: string,
  currentUserId: string,
  data: {
    shareAmount?: number;
    normalizedShareAmount?: number;
    splitType?: SplitType;
    splitValue?: number | null;
  }
) {
  // Get the assignment with its spend
  const assignment = await prisma.spendAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      spend: {
        include: {
          trip: {
            select: { spendStatus: true },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // Check permission: user must be the spender or the assignment owner
  const isSpender = assignment.spend.paidById === currentUserId;
  const isAssignmentOwner = assignment.userId === currentUserId;

  if (!isSpender && !isAssignmentOwner) {
    throw new Error("You do not have permission to edit this assignment");
  }

  // Check if trip spending is closed
  if (assignment.spend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot edit assignments. The trip organizer has closed spending for this trip.");
  }

  // Prevent editing assignments for closed spends
  if (assignment.spend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot edit assignment for closed spend. Spend is locked.");
  }

  // Build update data
  const updateData: any = {};
  if (data.shareAmount !== undefined) {
    updateData.shareAmount = new Decimal(data.shareAmount);
  }
  if (data.normalizedShareAmount !== undefined) {
    updateData.normalizedShareAmount = new Decimal(data.normalizedShareAmount);
  }
  if (data.splitType !== undefined) {
    updateData.splitType = data.splitType;
  }
  if (data.splitValue !== undefined) {
    updateData.splitValue = data.splitValue ? new Decimal(data.splitValue) : null;
  }

  const updated = await prisma.spendAssignment.update({
    where: { id: assignmentId },
    data: updateData,
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

  return updated;
}

/**
 * Deletes an assignment.
 * Validates that the spend is not closed before deleting.
 *
 * @param assignmentId - ID of the assignment to delete
 * @param currentUserId - ID of the user performing the deletion
 */
export async function deleteAssignment(assignmentId: string, currentUserId: string) {
  // Get the assignment with its spend
  const assignment = await prisma.spendAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      spend: {
        include: {
          trip: {
            select: { spendStatus: true },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // Check permission: user must be the spender or the assignment owner
  const isSpender = assignment.spend.paidById === currentUserId;
  const isAssignmentOwner = assignment.userId === currentUserId;

  if (!isSpender && !isAssignmentOwner) {
    throw new Error("You do not have permission to remove this user from the spend");
  }

  // Check if trip spending is closed
  if (assignment.spend.trip.spendStatus === SpendStatus.CLOSED) {
    throw new Error("Cannot delete assignments. The trip organizer has closed spending for this trip.");
  }

  // Prevent deleting assignments for closed spends
  if (assignment.spend.status === SpendStatus.CLOSED) {
    throw new Error("Cannot delete assignment for closed spend. Spend is locked.");
  }

  await prisma.spendAssignment.delete({
    where: { id: assignmentId },
  });
}

/**
 * Replaces all assignments for a spend.
 * Validates that the spend is not closed before replacing assignments.
 * Preserves existing allocations for users who remain in the spend.
 *
 * @param spendId - ID of the spend
 * @param assignments - New assignments to create
 * @returns Created assignments
 */
export async function replaceAssignments(
  spendId: string,
  assignments: Array<{
    userId: string;
    shareAmount: number;
    normalizedShareAmount: number;
    splitType: SplitType;
    splitValue?: number;
  }>
) {
  // Get the spend to check status and existing assignments
  const spend = await prisma.spend.findUnique({
    where: { id: spendId, deletedAt: null },
    include: {
      assignments: true,
    },
  });

  if (!spend) {
    throw new Error("Spend not found");
  }

  // Build a map of existing assignments by userId
  const existingAssignmentsMap = new Map(
    spend.assignments.map((a) => [a.userId, a])
  );

  // Build a set of new user IDs
  const newUserIds = new Set(assignments.map((a) => a.userId));

  // Build a set of existing user IDs
  const existingUserIds = new Set(spend.assignments.map((a) => a.userId));

  // Check if the list of people involved has changed
  const usersAdded = [...newUserIds].filter((id) => !existingUserIds.has(id));
  const usersRemoved = [...existingUserIds].filter((id) => !newUserIds.has(id));
  const peopleChanged = usersAdded.length > 0 || usersRemoved.length > 0;

  // Prevent modifying the list of people involved for closed spends
  if (spend.status === SpendStatus.CLOSED && peopleChanged) {
    throw new Error("Cannot change the people involved in a closed spend. Spend is locked.");
  }

  // Delete existing assignments and create new ones in a transaction
  const created = await prisma.$transaction(async (tx) => {
    // Delete assignments for users who are no longer in the spend
    const userIdsToDelete = spend.assignments
      .filter((a) => !newUserIds.has(a.userId))
      .map((a) => a.id);

    if (userIdsToDelete.length > 0) {
      await tx.spendAssignment.deleteMany({
        where: { id: { in: userIdsToDelete } },
      });
    }

    // Process assignments: update existing or create new
    const processedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const existing = existingAssignmentsMap.get(assignment.userId);

        if (existing) {
          // User already has an assignment - preserve their existing allocation
          // Only update if they are newly added (shouldn't happen in this path)
          return tx.spendAssignment.findUnique({
            where: { id: existing.id },
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
        } else {
          // User is newly added - create assignment with provided values (typically 0)
          return tx.spendAssignment.create({
            data: {
              spendId,
              userId: assignment.userId,
              shareAmount: new Decimal(assignment.shareAmount),
              normalizedShareAmount: new Decimal(assignment.normalizedShareAmount),
              splitType: assignment.splitType,
              splitValue: assignment.splitValue ? new Decimal(assignment.splitValue) : null,
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
        }
      })
    );

    // Filter out any null results (shouldn't happen but for type safety)
    return processedAssignments.filter((a) => a !== null);
  });

  return created;
}
