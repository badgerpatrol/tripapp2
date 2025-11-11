import { prisma } from "@/lib/prisma";
import { TripMemberRole, TripStatus, EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import type { CreateTripInput, UpdateTripInput } from "@/types/schemas";

/**
 * Creates default timeline items for a new trip.
 * Timeline includes: trip created, RSVP deadline, spending window, trip dates, settlement complete
 */
async function createDefaultTimelineItems(
  tripId: string,
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const now = new Date();
  const timelineItems = [];

  // 1. Trip Created (completed)
  timelineItems.push({
    tripId,
    title: "Trip Created",
    description: "Trip planning has begun",
    date: now,
    isCompleted: true,
    completedAt: now,
    order: 0,
    createdById: userId,
  });

  // Calculate dates based on trip dates if provided
  const rsvpDeadline = startDate
    ? new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000) // 2 weeks before start
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  const spendingWindowStart = startDate
    ? new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 1 week before start
    : new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000); // 37 days from now

  const spendingWindowEnd = endDate
    ? new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days after end
    : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now

  const settlementDeadline = endDate
    ? new Date(endDate.getTime() + 14 * 24 * 60 * 60 * 1000) // 2 weeks after end
    : new Date(now.getTime() + 74 * 24 * 60 * 60 * 1000); // 74 days from now

  // 2. RSVP Deadline
  timelineItems.push({
    tripId,
    title: "RSVP Deadline",
    description: "All invitees should confirm attendance",
    date: rsvpDeadline,
    isCompleted: false,
    order: 1,
    createdById: userId,
  });


  // 4. Trip Start
  if (startDate) {
    timelineItems.push({
      tripId,
      title: "Trip Starts",
      description: "The trip begins!",
      date: startDate,
      isCompleted: false,
      order: 3,
      createdById: userId,
    });
  }

  // 5. Trip End
  if (endDate) {
    timelineItems.push({
      tripId,
      title: "Trip Ends",
      description: "The trip concludes",
      date: endDate,
      isCompleted: false,
      order: 4,
      createdById: userId,
    });
  }

  // 6. Spending Window End
  timelineItems.push({
    tripId,
    title: "Spending Window Closes",
    description: "Finalize all expenses",
    date: spendingWindowEnd,
    isCompleted: false,
    order: 5,
    createdById: userId,
  });

  // 7. Settlement Deadline
  timelineItems.push({
    tripId,
    title: "Settlement Deadline",
    description: "All payments should be completed",
    date: settlementDeadline,
    isCompleted: false,
    order: 6,
    createdById: userId,
  });

  return timelineItems;
}

/**
 * Creates a new trip with the authenticated user as owner.
 * Seeds default timeline items and logs the creation event.
 *
 * @param userId - Firebase UID of the user creating the trip
 * @param data - Trip creation data
 * @returns Created trip object
 */
export async function createTrip(userId: string, data: CreateTripInput) {
  // Use a transaction to ensure all operations succeed or fail together
  const trip = await prisma.$transaction(async (tx) => {
    // Create the trip
    const newTrip = await tx.trip.create({
      data: {
        name: data.name,
        description: data.description || null,
        baseCurrency: data.baseCurrency || "USD",
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        status: TripStatus.PLANNING,
        createdById: userId,
      },
    });

    // Add the creator as an OWNER member
    await tx.tripMember.create({
      data: {
        tripId: newTrip.id,
        userId,
        role: TripMemberRole.OWNER,
        rsvpStatus: "ACCEPTED", // Creator auto-accepts
      },
    });

    // Create default timeline items
    const timelineItems = await createDefaultTimelineItems(
      newTrip.id,
      userId,
      data.startDate,
      data.endDate
    );

    await tx.timelineItem.createMany({
      data: timelineItems,
    });

    return newTrip;
  });

  // Log the event (outside transaction for idempotency)
  await logEvent("Trip", trip.id, EventType.TRIP_CREATED, userId, {
    name: trip.name,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
  });

  return trip;
}

/**
 * Updates timeline item dates based on new trip dates.
 * Only updates items that haven't been manually completed.
 */
async function updateDependentTimelineItems(
  tx: any,
  tripId: string,
  startDate?: Date | null,
  endDate?: Date | null
) {
  const now = new Date();
  const updates = [];

  // Calculate new dates
  const rsvpDeadline = startDate
    ? new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const spendingWindowStart = startDate
    ? new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000);

  const spendingWindowEnd = endDate
    ? new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const settlementDeadline = endDate
    ? new Date(endDate.getTime() + 14 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 74 * 24 * 60 * 60 * 1000);

  // Map of timeline item titles to their new dates
  const dateUpdates: Record<string, Date | null> = {
    "RSVP Deadline": rsvpDeadline,
    "Spending Window Closes": spendingWindowEnd,
    "Settlement Deadline": settlementDeadline,
  };

  // Add trip start/end dates if provided
  if (startDate !== undefined) {
    dateUpdates["Trip Starts"] = startDate;
  }
  if (endDate !== undefined) {
    dateUpdates["Trip Ends"] = endDate;
  }

  // Update each matching timeline item
  for (const [title, newDate] of Object.entries(dateUpdates)) {
    const item = await tx.timelineItem.findFirst({
      where: {
        tripId,
        title,
        deletedAt: null,
      },
    });

    if (item) {
      await tx.timelineItem.update({
        where: { id: item.id },
        data: { date: newDate },
      });
      updates.push(item.id);
    }
  }

  return updates;
}

/**
 * Updates a trip's basic details and recalculates dependent timeline items.
 * Logs an EventLog entry with changes.
 *
 * @param tripId - ID of the trip to update
 * @param userId - Firebase UID of the user updating the trip
 * @param data - Trip update data
 * @returns Updated trip object
 */
export async function updateTrip(
  tripId: string,
  userId: string,
  data: UpdateTripInput
) {
  // First, get the current trip state for logging
  const existingTrip = await prisma.trip.findUnique({
    where: { id: tripId, deletedAt: null },
  });

  if (!existingTrip) {
    throw new Error("Trip not found");
  }

  // Use a transaction to ensure all operations succeed or fail together
  const result = await prisma.$transaction(async (tx) => {
    // Update the trip
    const updatedTrip = await tx.trip.update({
      where: { id: tripId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.baseCurrency !== undefined && { baseCurrency: data.baseCurrency }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        // Note: location field not in Trip schema yet - will need migration to add
      },
    });

    // Update dependent timeline items if dates changed
    let affectedTimelineItems: string[] = [];
    if (data.startDate !== undefined || data.endDate !== undefined) {
      affectedTimelineItems = await updateDependentTimelineItems(
        tx,
        tripId,
        data.startDate !== undefined ? data.startDate : updatedTrip.startDate,
        data.endDate !== undefined ? data.endDate : updatedTrip.endDate
      );
    }

    return { updatedTrip, affectedTimelineItems };
  });

  // Log the event (outside transaction for idempotency)
  const changes: Record<string, any> = {};
  if (data.name !== undefined && data.name !== existingTrip.name) {
    changes.name = { old: existingTrip.name, new: data.name };
  }
  if (data.description !== undefined && data.description !== existingTrip.description) {
    changes.description = { old: existingTrip.description, new: data.description };
  }
  if (data.baseCurrency !== undefined && data.baseCurrency !== existingTrip.baseCurrency) {
    changes.baseCurrency = { old: existingTrip.baseCurrency, new: data.baseCurrency };
  }
  if (data.startDate !== undefined && data.startDate?.getTime() !== existingTrip.startDate?.getTime()) {
    changes.startDate = { old: existingTrip.startDate, new: data.startDate };
  }
  if (data.endDate !== undefined && data.endDate?.getTime() !== existingTrip.endDate?.getTime()) {
    changes.endDate = { old: existingTrip.endDate, new: data.endDate };
  }

  if (Object.keys(changes).length > 0 || result.affectedTimelineItems.length > 0) {
    await logEvent("Trip", tripId, EventType.TRIP_UPDATED, userId, {
      changes,
      affectedTimelineItems: result.affectedTimelineItems,
    });
  }

  return result.updatedTrip;
}

/**
 * Gets a trip by ID with creator information.
 */
export async function getTripById(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
      members: {
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
      timelineItems: {
        orderBy: { order: "asc" },
      },
    },
  });
}

/**
 * Gets all trips for a user (where they are a member).
 */
export async function getUserTrips(userId: string) {
  return prisma.trip.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
      deletedAt: null,
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
      members: {
        where: { deletedAt: null },
        select: {
          id: true,
          userId: true,
          role: true,
          rsvpStatus: true,
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
      createdAt: "desc",
    },
  });
}

/**
 * Calculates settlement balances for a user in a trip.
 * Returns how much the user owes and is owed.
 */
async function calculateUserBalance(tripId: string, userId: string) {
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

/**
 * Gets trip overview for an invitee (minimal info).
 * Shows basic trip info and participant list only.
 */
export async function getTripOverviewForInvitee(
  tripId: string,
  userId: string
) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, deletedAt: null },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
      members: {
        where: { deletedAt: null },
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
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!trip) {
    return null;
  }

  // Find user's membership status
  const userMembership = trip.members.find((m) => m.user.id === userId);

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    spendStatus: trip.spendStatus,
    rsvpStatus: trip.rsvpStatus,
    createdAt: trip.createdAt,
    organizer: trip.createdBy,
    participants: trip.members.map((m) => ({
      id: m.id,
      role: m.role,
      rsvpStatus: m.rsvpStatus,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
    userRole: userMembership?.role || null,
    userRsvpStatus: userMembership?.rsvpStatus || null,
  };
}

/**
 * Gets trip overview for an accepted member (full info).
 * Includes spends, assignments, timeline, and settlement balances.
 */
export async function getTripOverviewForMember(
  tripId: string,
  userId: string
) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, deletedAt: null },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
      members: {
        where: { deletedAt: null },
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
        orderBy: { joinedAt: "asc" },
      },
      timelineItems: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
      },
      spends: {
        where: { deletedAt: null },
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
        orderBy: { date: "desc" },
      },
    },
  });

  if (!trip) {
    return null;
  }

  // Find user's membership status
  const userMembership = trip.members.find((m) => m.user.id === userId);

  // Calculate total spent and user balances
  const totalSpent = trip.spends.reduce(
    (sum, spend) => sum + Number(spend.normalizedAmount),
    0
  );

  const { userOwes, userIsOwed } = await calculateUserBalance(tripId, userId);

  // Get all user's assignments across all spends
  const userAssignments = await prisma.spendAssignment.findMany({
    where: {
      userId,
      spend: {
        tripId,
        deletedAt: null,
      },
    },
  });

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    spendStatus: trip.spendStatus,
    rsvpStatus: trip.rsvpStatus,
    createdAt: trip.createdAt,
    organizer: trip.createdBy,
    participants: trip.members.map((m) => ({
      id: m.id,
      role: m.role,
      rsvpStatus: m.rsvpStatus,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
    userRole: userMembership?.role || null,
    userRsvpStatus: userMembership?.rsvpStatus || null,
    timeline: trip.timelineItems.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      date: t.date,
      isCompleted: t.isCompleted,
      completedAt: t.completedAt,
      order: t.order,
    })),
    spends: trip.spends.map((s) => {
      // Calculate assignment percentage for this spend
      const totalAssigned = s.assignments.reduce(
        (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
        0
      );
      const spendAmount = Number(s.normalizedAmount);
      const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

      return {
        id: s.id,
        description: s.description,
        amount: Number(s.amount),
        currency: s.currency,
        fxRate: Number(s.fxRate),
        normalizedAmount: Number(s.normalizedAmount),
        date: s.date,
        status: s.status,
        notes: s.notes,
        paidBy: s.paidBy,
        category: s.category,
        assignedPercentage: Math.round(assignedPercentage * 10) / 10,
        assignments: s.assignments.map((a) => ({
          id: a.id,
          userId: a.userId,
          shareAmount: Number(a.shareAmount),
          normalizedShareAmount: Number(a.normalizedShareAmount),
          user: a.user,
        })),
      };
    }),
    userAssignments: userAssignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      shareAmount: Number(a.shareAmount),
      normalizedShareAmount: Number(a.normalizedShareAmount),
      splitType: a.splitType,
    })),
    totalSpent,
    userOwes,
    userIsOwed,
  };
}

/**
 * Checks if RSVP deadline has passed and automatically closes RSVP if needed.
 * Should be called when fetching trip data.
 *
 * Uses milestone completion tracking:
 * - Only triggers if the milestone is NOT completed (isCompleted = false)
 * - Marks the milestone as completed when closing RSVP
 * - This allows organizers to manually reopen RSVP without it auto-closing again
 */
export async function checkAndAutoCloseRsvp(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, deletedAt: null },
    include: {
      timelineItems: {
        where: {
          title: "RSVP Deadline",
          deletedAt: null,
        },
      },
    },
  });

  console.log(`[checkAndAutoCloseRsvp] Trip ${tripId}: rsvpStatus = ${trip?.rsvpStatus}`);

  if (!trip) {
    console.log(`[checkAndAutoCloseRsvp] Trip not found`);
    return;
  }

  // Only check if RSVP is currently open
  if (trip.rsvpStatus !== "OPEN") {
    console.log(`[checkAndAutoCloseRsvp] RSVP not OPEN (${trip.rsvpStatus}), skipping`);
    return;
  }

  // Find the RSVP deadline timeline item
  const rsvpDeadline = trip.timelineItems[0];

  if (!rsvpDeadline?.date) {
    console.log(`[checkAndAutoCloseRsvp] No RSVP deadline found`);
    return;
  }

  console.log(`[checkAndAutoCloseRsvp] RSVP deadline: ${rsvpDeadline.date}, isCompleted: ${rsvpDeadline.isCompleted}`);

  // If milestone is already completed, don't trigger again
  if (rsvpDeadline.isCompleted) {
    console.log(`[checkAndAutoCloseRsvp] Milestone already completed, skipping auto-close`);
    return;
  }

  const deadlineDate = new Date(rsvpDeadline.date);
  const now = new Date();

  // If deadline has passed and milestone is not completed, close RSVP and mark milestone complete
  if (deadlineDate < now) {
    await prisma.$transaction([
      // Close RSVP
      prisma.trip.update({
        where: { id: tripId },
        data: {
          rsvpStatus: "CLOSED",
        },
      }),
      // Mark milestone as completed
      prisma.timelineItem.update({
        where: { id: rsvpDeadline.id },
        data: {
          isCompleted: true,
          completedAt: now,
        },
      }),
    ]);
  }
}

/**
 * Creates a new timeline item.
 * Only OWNER and ADMIN can create timeline items.
 */
export async function createTimelineItem(
  tripId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    date?: Date | null;
  }
) {
  // Verify user is a member of the trip
  const membership = await prisma.tripMember.findFirst({
    where: {
      tripId,
      userId,
      deletedAt: null,
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this trip");
  }

  // Only OWNER and ADMIN can create timeline items
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only trip organizers can create timeline items");
  }

  // Get the highest order number for existing timeline items
  const lastItem = await prisma.timelineItem.findFirst({
    where: {
      tripId,
      deletedAt: null,
    },
    orderBy: {
      order: "desc",
    },
  });

  const nextOrder = lastItem ? lastItem.order + 1 : 0;

  // Create the timeline item
  const timelineItem = await prisma.timelineItem.create({
    data: {
      tripId,
      title: data.title,
      description: data.description,
      date: data.date,
      order: nextOrder,
      createdById: userId,
      isCompleted: false,
    },
  });

  await logEvent(
    "TimelineItem",
    timelineItem.id,
    EventType.MILESTONE_CREATED,
    userId,
    { tripId, title: data.title }
  );

  return timelineItem;
}

export async function updateTimelineItemDate(
  tripId: string,
  itemId: string,
  userId: string,
  newDate: Date | null
) {
  // Verify user is a member of the trip
  const membership = await prisma.tripMember.findFirst({
    where: {
      tripId,
      userId,
      deletedAt: null,
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this trip");
  }

  // Only OWNER and ADMIN can edit timeline items
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only trip organizers can edit timeline items");
  }

  // Get the timeline item to verify it belongs to this trip
  const timelineItem = await prisma.timelineItem.findFirst({
    where: {
      id: itemId,
      tripId,
      deletedAt: null,
    },
  });

  if (!timelineItem) {
    throw new Error("Timeline item not found");
  }

  // Determine if we need to reset the completion status
  const now = new Date();
  const isFutureDate = newDate && newDate > now;
  const wasCompleted = timelineItem.isCompleted;

  // Prepare update data
  const updateData: any = {
    date: newDate,
  };

  // If milestone was completed but new date is in the future, reset completion status
  if (wasCompleted && isFutureDate) {
    updateData.isCompleted = false;
    updateData.completedAt = null;
    console.log(`[updateTimelineItemDate] Resetting completion status for ${timelineItem.title} - moved to future date`);
  }

  // Update the timeline item
  const updatedItem = await prisma.timelineItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // After updating the date, trigger milestone checks based on the milestone type
  // This ensures that if a deadline is changed to a past date, it triggers immediately
  await triggerMilestoneChecks(tripId, timelineItem.title);

  return updatedItem;
}

/**
 * Triggers milestone checks after a timeline item date is updated
 * This allows the system to automatically take actions if a deadline has passed
 */
async function triggerMilestoneChecks(tripId: string, milestoneTitle: string) {
  console.log(`[triggerMilestoneChecks] Checking milestone: ${milestoneTitle} for trip ${tripId}`);

  switch (milestoneTitle) {
    case "RSVP Deadline":
      await checkAndAutoCloseRsvp(tripId);
      break;

    case "Spending Window Closes":
      // TODO: Implement checkAndAutoCloseSpending(tripId) when spending auto-close is needed
      console.log(`[triggerMilestoneChecks] Spending Window Closes check - placeholder for future implementation`);
      break;

    case "Settlement Deadline":
      // TODO: Implement checkSettlementDeadline(tripId) to send reminders or mark overdue
      console.log(`[triggerMilestoneChecks] Settlement Deadline check - placeholder for future implementation`);
      break;

    case "Trip Starts":
      // TODO: Implement checkTripStart(tripId) for any start-of-trip actions
      console.log(`[triggerMilestoneChecks] Trip Starts check - placeholder for future implementation`);
      break;

    case "Trip Ends":
      // TODO: Implement checkTripEnd(tripId) for any end-of-trip actions
      console.log(`[triggerMilestoneChecks] Trip Ends check - placeholder for future implementation`);
      break;

    default:
      console.log(`[triggerMilestoneChecks] No automatic action defined for milestone: ${milestoneTitle}`);
  }
}

/**
 * Deletes a timeline item (soft delete).
 * Only OWNER and ADMIN can delete timeline items.
 */
export async function deleteTimelineItem(
  tripId: string,
  itemId: string,
  userId: string
) {
  // Verify user is a member of the trip
  const membership = await prisma.tripMember.findFirst({
    where: {
      tripId,
      userId,
      deletedAt: null,
    },
  });

  if (!membership) {
    throw new Error("You are not a member of this trip");
  }

  // Only OWNER and ADMIN can delete timeline items
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Only trip organizers can delete timeline items");
  }

  // Get the timeline item to verify it belongs to this trip
  const timelineItem = await prisma.timelineItem.findFirst({
    where: {
      id: itemId,
      tripId,
      deletedAt: null,
    },
  });

  if (!timelineItem) {
    throw new Error("Timeline item not found");
  }

  // Soft delete the timeline item
  const deletedItem = await prisma.timelineItem.update({
    where: { id: itemId },
    data: {
      deletedAt: new Date(),
    },
  });

  // Log the deletion event
  await logEvent(
    "TimelineItem",
    itemId,
    EventType.MILESTONE_CREATED, // Note: There's no MILESTONE_DELETED event type, using closest match
    userId,
    {
      tripId,
      title: timelineItem.title,
      action: "deleted",
    }
  );

  return deletedItem;
}

/**
 * Deletes a trip and all associated data.
 * This will cascade delete related records like members, spends, timeline items, etc.
 * Logs the deletion as an event.
 */
export async function deleteTrip(tripId: string, userId: string) {
  // Verify the trip exists
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // Log the deletion event before deleting
  await logEvent("Trip", tripId, EventType.TRIP_DELETED, userId, {
    tripName: trip.name,
  });

  // Delete the trip (cascade will handle related records)
  await prisma.trip.delete({
    where: { id: tripId },
  });

  return { success: true };
}
