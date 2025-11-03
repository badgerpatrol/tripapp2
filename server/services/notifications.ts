import { prisma } from "@/lib/prisma";
import { NotificationType, NotificationStatus } from "@/lib/generated/prisma";

/**
 * Creates a notification for a user.
 * Used for trip invitations, spend updates, settlement requests, etc.
 */
export async function createNotification({
  recipientId,
  senderId,
  tripId,
  type,
  title,
  message,
  actionUrl,
  metadata,
}: {
  recipientId: string;
  senderId?: string;
  tripId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  return await prisma.notification.create({
    data: {
      recipientId,
      senderId,
      tripId,
      type,
      status: NotificationStatus.UNREAD,
      title,
      message,
      actionUrl,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

/**
 * Creates multiple notifications in a batch.
 * Useful for notifying multiple users at once (e.g., all trip members).
 */
export async function createBatchNotifications(
  notifications: Array<{
    recipientId: string;
    senderId?: string;
    tripId?: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }>
) {
  return await prisma.notification.createMany({
    data: notifications.map((n) => ({
      recipientId: n.recipientId,
      senderId: n.senderId,
      tripId: n.tripId,
      type: n.type,
      status: NotificationStatus.UNREAD,
      title: n.title,
      message: n.message,
      actionUrl: n.actionUrl,
      metadata: n.metadata ? JSON.parse(JSON.stringify(n.metadata)) : undefined,
    })),
  });
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  if (notification.recipientId !== userId) {
    throw new Error("Unauthorized: You can only mark your own notifications as read");
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });
}

/**
 * Gets all notifications for a user.
 */
export async function getUserNotifications(userId: string, status?: NotificationStatus) {
  return await prisma.notification.findMany({
    where: {
      recipientId: userId,
      status: status || undefined,
    },
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      },
      trip: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Marks all notifications as read for a user.
 */
export async function markAllNotificationsAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: {
      recipientId: userId,
      status: NotificationStatus.UNREAD,
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });
}
