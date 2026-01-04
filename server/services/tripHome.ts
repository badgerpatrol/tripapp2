/**
 * Trip Home Service
 * Provides aggregated data for the trip home dashboard
 */

import { prisma } from "@/lib/prisma";
import { requireTripMembershipOnly } from "@/server/authz";
import { calculateTripBalances } from "./settlements";
import { EventType, RsvpStatus, ChoiceStatus } from "@/lib/generated/prisma";

// ============================================================================
// Types
// ============================================================================

export interface TripHomeSummary {
  // Basic trip info
  trip: {
    id: string;
    name: string;
    description: string | null;
    location: string | null;
    startDate: Date | null;
    endDate: Date | null;
    baseCurrency: string;
    headerImageData: string | null;
  };

  // People summary
  people: {
    total: number;
    accepted: number;
    pending: number;
    declined: number;
    maybe: number;
    participants: Array<{
      id: string;
      displayName: string | null;
      photoURL: string | null;
      rsvpStatus: string;
      role: string;
      isCurrentUser: boolean;
    }>;
  };

  // Money summary
  money: {
    userBalance: number; // Positive = owed to user, negative = user owes
    transfersNeeded: number;
    topTransfer: {
      amount: number;
      toUserName: string;
    } | null;
    baseCurrency: string;
  };

  // Decisions summary
  decisions: {
    openCount: number;
    waitingForYou: number;
    topDecision: {
      id: string;
      name: string;
      place: string | null;
      deadline: Date | null;
      chosenCount: number;
      totalParticipants: number;
      userHasChosen: boolean;
    } | null;
  };

  // Tasks summary (timeline items)
  tasks: {
    openCount: number;
    completedCount: number;
    topTasks: string[];
  };

  // Kit summary
  kit: {
    totalItems: number;
    completedItems: number;
    topIncomplete: string[];
  };

  // Trip health
  health: {
    status: "on_track" | "needs_attention" | "blocked";
    issues: string[];
  };

  // Current user info
  currentUser: {
    role: string;
    rsvpStatus: string;
  };
}

export interface ActivityItem {
  id: string;
  eventType: EventType;
  action: string; // Human-readable action
  actorId: string;
  actorName: string | null;
  actorPhotoURL: string | null;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Home Summary
// ============================================================================

/**
 * Get aggregated dashboard data for trip home
 */
export async function getTripHomeSummary(
  tripId: string,
  userId: string
): Promise<TripHomeSummary> {
  // Verify membership
  await requireTripMembershipOnly(userId, tripId);

  // Fetch all data in parallel
  const [trip, balances, choices, kitData, tasksData] = await Promise.all([
    // Get trip with members
    prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      include: {
        members: {
          where: { deletedAt: null, role: { not: "VIEWER" } },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                photoURL: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
    // Get balance summary
    calculateTripBalances(tripId),
    // Get open choices with selections
    prisma.choice.findMany({
      where: {
        tripId,
        status: ChoiceStatus.OPEN,
        archivedAt: null,
      },
      include: {
        selections: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    }),
    // Get kit items
    getKitSummary(tripId),
    // Get TODO checklist items
    getTasksSummary(tripId),
  ]);

  if (!trip) {
    throw new Error("Trip not found");
  }

  // Find current user's membership
  const userMembership = trip.members.find((m) => m.user.id === userId);
  if (!userMembership) {
    throw new Error("User is not a member of this trip");
  }

  // Calculate people stats
  const peopleStats = {
    total: trip.members.length,
    accepted: trip.members.filter((m) => m.rsvpStatus === RsvpStatus.ACCEPTED).length,
    pending: trip.members.filter((m) => m.rsvpStatus === RsvpStatus.PENDING).length,
    declined: trip.members.filter((m) => m.rsvpStatus === RsvpStatus.DECLINED).length,
    maybe: trip.members.filter((m) => m.rsvpStatus === RsvpStatus.MAYBE).length,
    participants: trip.members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      photoURL: m.user.photoURL,
      rsvpStatus: m.rsvpStatus,
      role: m.role,
      isCurrentUser: m.user.id === userId,
    })),
  };

  // Calculate money stats for current user
  const userBalanceData = balances.balances.find((b) => b.userId === userId);
  const userNetBalance = userBalanceData?.netBalance ?? 0;
  const transfersForUser = balances.settlements.filter(
    (s) => s.fromUserId === userId || s.toUserId === userId
  );
  const topTransferForUser = balances.settlements.find(
    (s) => s.fromUserId === userId
  );

  const moneyStats = {
    userBalance: userNetBalance,
    transfersNeeded: transfersForUser.length,
    topTransfer: topTransferForUser
      ? {
          amount: topTransferForUser.amount,
          toUserName: topTransferForUser.toUserName,
        }
      : null,
    baseCurrency: trip.baseCurrency,
  };

  // Calculate decisions stats
  const acceptedMemberCount = peopleStats.accepted;
  const userChosenChoiceIds = new Set(
    choices
      .filter((c) => c.selections.some((s) => s.userId === userId))
      .map((c) => c.id)
  );
  const waitingForYou = choices.filter((c) => !userChosenChoiceIds.has(c.id)).length;

  const topChoice = choices[0];
  const decisionsStats = {
    openCount: choices.length,
    waitingForYou,
    topDecision: topChoice
      ? {
          id: topChoice.id,
          name: topChoice.name,
          place: topChoice.place,
          deadline: topChoice.deadline,
          chosenCount: topChoice.selections.length,
          totalParticipants: acceptedMemberCount,
          userHasChosen: userChosenChoiceIds.has(topChoice.id),
        }
      : null,
  };

  // Tasks stats from TODO lists
  const tasksStats = {
    openCount: tasksData.totalItems - tasksData.completedItems,
    completedCount: tasksData.completedItems,
    topTasks: tasksData.topIncomplete,
  };

  // Calculate trip health
  const healthIssues: string[] = [];

  if (peopleStats.pending > 0) {
    healthIssues.push(`${peopleStats.pending} people haven't responded`);
  }

  if (waitingForYou > 0) {
    healthIssues.push(`${waitingForYou} decisions waiting for your choice`);
  }

  if (moneyStats.topTransfer) {
    healthIssues.push(`You owe ${trip.baseCurrency}${moneyStats.topTransfer.amount.toFixed(2)}`);
  }

  if (kitData.totalItems - kitData.completedItems > 0) {
    healthIssues.push(`${kitData.totalItems - kitData.completedItems} kit items not packed`);
  }

  const healthStatus: "on_track" | "needs_attention" | "blocked" =
    healthIssues.length === 0
      ? "on_track"
      : healthIssues.length <= 2
      ? "needs_attention"
      : "blocked";

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      description: trip.description,
      location: trip.location,
      startDate: trip.startDate,
      endDate: trip.endDate,
      baseCurrency: trip.baseCurrency,
      headerImageData: trip.headerImageData,
    },
    people: peopleStats,
    money: moneyStats,
    decisions: decisionsStats,
    tasks: tasksStats,
    kit: kitData,
    health: {
      status: healthStatus,
      issues: healthIssues,
    },
    currentUser: {
      role: userMembership.role,
      rsvpStatus: userMembership.rsvpStatus,
    },
  };
}

// ============================================================================
// Kit Summary
// ============================================================================

interface KitSummary {
  totalItems: number;
  completedItems: number;
  topIncomplete: string[];
}

/**
 * Get aggregated kit stats for a trip
 */
async function getKitSummary(tripId: string): Promise<KitSummary> {
  // Get all kit lists for this trip
  const kitLists = await prisma.listTemplate.findMany({
    where: {
      tripId,
      type: "KIT",
    },
    include: {
      kitItems: {
        include: {
          ticks: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  // Flatten all kit items
  const allKitItems = kitLists.flatMap((list) => list.kitItems);

  // Count items with at least one tick as "completed"
  const completedItems = allKitItems.filter((item) => item.ticks.length > 0);
  const incompleteItems = allKitItems.filter((item) => item.ticks.length === 0);

  return {
    totalItems: allKitItems.length,
    completedItems: completedItems.length,
    topIncomplete: incompleteItems.slice(0, 3).map((item) => item.label),
  };
}

// ============================================================================
// Tasks Summary (TODO Lists)
// ============================================================================

interface TasksSummary {
  totalItems: number;
  completedItems: number;
  topIncomplete: string[];
}

/**
 * Get aggregated tasks stats for a trip (from TODO lists)
 */
async function getTasksSummary(tripId: string): Promise<TasksSummary> {
  // Get all TODO lists for this trip
  const todoLists = await prisma.listTemplate.findMany({
    where: {
      tripId,
      type: "TODO",
    },
    include: {
      todoItems: {
        include: {
          ticks: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  // Flatten all todo items
  const allTodoItems = todoLists.flatMap((list) => list.todoItems);

  // Count items with at least one tick as "completed"
  const completedItems = allTodoItems.filter((item) => item.ticks.length > 0);
  const incompleteItems = allTodoItems.filter((item) => item.ticks.length === 0);

  return {
    totalItems: allTodoItems.length,
    completedItems: completedItems.length,
    topIncomplete: incompleteItems.slice(0, 3).map((item) => item.label),
  };
}

// ============================================================================
// Activity Feed
// ============================================================================

/**
 * Event type to human-readable action mapping
 */
const eventTypeToAction: Partial<Record<EventType, string>> = {
  [EventType.SPEND_CREATED]: "added a spend",
  [EventType.SPEND_UPDATED]: "updated a spend",
  [EventType.SPEND_CLOSED]: "closed a spend",
  [EventType.SPEND_DELETED]: "deleted a spend",
  [EventType.TRIP_MEMBER_ADDED]: "joined the trip",
  [EventType.TRIP_UPDATED]: "updated trip details",
  [EventType.CHOICE_CREATED]: "created a decision",
  [EventType.CHOICE_UPDATED]: "updated a decision",
  [EventType.CHOICE_CLOSED]: "closed a decision",
  [EventType.CHOICE_SELECTION_CREATED]: "made a choice",
  [EventType.CHOICE_SELECTION_UPDATED]: "updated their choice",
  [EventType.SETTLEMENT_CREATED]: "created a settlement",
  [EventType.PAYMENT_RECORDED]: "recorded a payment",
  [EventType.LIST_TEMPLATE_COPIED_TO_TRIP]: "added a list",
  [EventType.LIST_ITEM_TOGGLED]: "updated kit item",
};

/**
 * Get recent activity for a trip
 */
export async function getTripActivity(
  tripId: string,
  userId: string,
  limit: number = 10
): Promise<ActivityItem[]> {
  // Verify membership
  await requireTripMembershipOnly(userId, tripId);

  // Fetch recent events for this trip
  const events = await prisma.eventLog.findMany({
    where: {
      tripId,
      // Filter to interesting event types
      eventType: {
        in: [
          EventType.SPEND_CREATED,
          EventType.SPEND_CLOSED,
          EventType.TRIP_MEMBER_ADDED,
          EventType.CHOICE_CREATED,
          EventType.CHOICE_CLOSED,
          EventType.CHOICE_SELECTION_CREATED,
          EventType.SETTLEMENT_CREATED,
          EventType.PAYMENT_RECORDED,
          EventType.LIST_TEMPLATE_COPIED_TO_TRIP,
          EventType.LIST_ITEM_TOGGLED,
        ],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    action: eventTypeToAction[event.eventType] || event.eventType,
    actorId: event.user.id,
    actorName: event.user.displayName,
    actorPhotoURL: event.user.photoURL,
    description: buildActivityDescription(event),
    timestamp: event.createdAt,
    metadata: event.payload as Record<string, unknown> | undefined,
  }));
}

/**
 * Build human-readable description for an event
 */
function buildActivityDescription(event: {
  eventType: EventType;
  user: { displayName: string | null };
  payload: unknown;
}): string {
  const actorName = event.user.displayName || "Someone";
  const action = eventTypeToAction[event.eventType] || "did something";
  const payload = event.payload as Record<string, unknown> | null;

  // Add context from payload if available
  let context = "";
  if (payload) {
    if (payload.description && typeof payload.description === "string") {
      context = `: ${payload.description}`;
    } else if (payload.amount && typeof payload.amount === "number") {
      context = `: ${payload.currency || ""}${payload.amount}`;
    } else if (payload.name && typeof payload.name === "string") {
      context = `: ${payload.name}`;
    }
  }

  return `${actorName} ${action}${context}`;
}

/**
 * Get action prompts for the current user
 * These are things the user should do to keep the trip moving
 */
export async function getUserActionPrompts(
  tripId: string,
  userId: string
): Promise<Array<{ type: string; message: string; actionUrl?: string }>> {
  // Verify membership
  await requireTripMembershipOnly(userId, tripId);

  const prompts: Array<{ type: string; message: string; actionUrl?: string }> = [];

  // Check for pending choices
  const pendingChoices = await prisma.choice.findMany({
    where: {
      tripId,
      status: ChoiceStatus.OPEN,
      archivedAt: null,
      selections: {
        none: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    take: 1,
  });

  if (pendingChoices.length > 0) {
    prompts.push({
      type: "choice",
      message: `Choose: ${pendingChoices[0].name}`,
      actionUrl: `/trips/${tripId}/choices/${pendingChoices[0].id}`,
    });
  }

  // Check for money owed
  const balances = await calculateTripBalances(tripId);
  const userTransfer = balances.settlements.find((s) => s.fromUserId === userId);

  if (userTransfer) {
    prompts.push({
      type: "payment",
      message: `Pay ${balances.baseCurrency}${userTransfer.amount.toFixed(2)} to ${userTransfer.toUserName}`,
      actionUrl: `/trips/${tripId}/settle`,
    });
  }

  return prompts;
}
