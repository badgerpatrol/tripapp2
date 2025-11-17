import { prisma } from "@/lib/prisma";
import { LogSeverity } from "@/lib/generated/prisma";

// Configuration for log rotation
const MAX_LOG_COUNT = 5000;
const LOGS_TO_DELETE = 500;

/**
 * Creates a system log entry
 *
 * Automatically manages log rotation: when the log count reaches MAX_LOG_COUNT (5000),
 * it deletes the oldest LOGS_TO_DELETE (500) entries to prevent unbounded growth.
 *
 * @param severity - Log severity level (ERROR, WARNING, INFO, DEBUG)
 * @param feature - Feature area (e.g., "auth", "spend", "trip", "kit list scan")
 * @param eventName - Event name (e.g., "user_login", "scan results")
 * @param eventText - Detailed log message
 * @param metadata - Optional additional structured data
 */
export async function createSystemLog(
  severity: LogSeverity,
  feature: string,
  eventName: string,
  eventText: string,
  metadata?: Record<string, any>
) {
  try {
    // Create the new log entry
    await prisma.systemLog.create({
      data: {
        severity,
        feature,
        eventName,
        eventText,
        metadata: metadata || null,
      },
    });

    // Check if we need to perform log rotation
    const logCount = await prisma.systemLog.count();

    if (logCount >= MAX_LOG_COUNT) {
      // Find the IDs of the oldest 500 logs
      const oldestLogs = await prisma.systemLog.findMany({
        select: { id: true },
        orderBy: { datetime: 'asc' },
        take: LOGS_TO_DELETE,
      });

      const idsToDelete = oldestLogs.map(log => log.id);

      // Delete the oldest logs
      if (idsToDelete.length > 0) {
        await prisma.systemLog.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });

        console.log(`Log rotation: Deleted ${idsToDelete.length} oldest log entries (total was ${logCount})`);
      }
    }
  } catch (error) {
    // Log to console but don't throw - we don't want logging failures to break the app
    console.error("Failed to create system log:", error);
  }
}
