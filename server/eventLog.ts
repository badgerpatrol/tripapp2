import { prisma } from "@/lib/prisma";
import { EventType } from "@/lib/generated/prisma";

// ============================================================================
// Event Logging
// ============================================================================

/**
 * Logs an event to the EventLog table.
 * All state transitions must write an EventLog row per CLAUDE.md rule #5.
 *
 * @param entity - The entity type (e.g., "User", "Trip", "Spend")
 * @param entityId - The ID of the entity
 * @param eventType - The type of event (from EventType enum)
 * @param byUser - The Firebase UID of the user who triggered the event
 * @param payload - Optional JSON payload with event details
 */
export async function logEvent(
  entity: string,
  entityId: string,
  eventType: EventType,
  byUser: string,
  payload?: Record<string, unknown>
) {
  try {
    await prisma.eventLog.create({
      data: {
        entity,
        entityId,
        eventType,
        byUser,
        payload: payload as any,
      },
    });
  } catch (error) {
    console.error("Failed to log event:", {
      entity,
      entityId,
      eventType,
      byUser,
      error,
    });
    // Don't throw - event logging should not break the main operation
  }
}

/**
 * Gets event logs for a specific entity.
 */
export async function getEventLogs(entity: string, entityId: string) {
  return prisma.eventLog.findMany({
    where: {
      entity,
      entityId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Gets event logs for a user's actions.
 */
export async function getUserEventLogs(userId: string, limit = 100) {
  return prisma.eventLog.findMany({
    where: {
      byUser: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
