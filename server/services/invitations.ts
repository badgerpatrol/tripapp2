import { prisma } from "@/lib/prisma";
import { RsvpStatus, TripMemberRole, EventType, NotificationType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import { createBatchNotifications } from "./notifications";

/**
 * Invites users to a trip by email.
 * Creates TripMember rows with RSVP=PENDING and sends in-app notifications.
 *
 * @param tripId - The ID of the trip
 * @param emails - Array of email addresses to invite
 * @param invitedById - The user ID of the person sending the invitations
 * @returns Object containing invited users, already members, and not found emails
 */
export async function inviteUsersToTrip(
  tripId: string,
  emails: string[],
  invitedById: string
) {
  // Normalize emails to lowercase for consistent lookups
  const normalizedEmails = emails.map(e => e.toLowerCase().trim());

  // Look up users by email
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: normalizedEmails,
      },
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      photoURL: true,
    },
  });

  // Create a map of email -> user
  const usersByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));

  // Find existing members
  const existingMembers = await prisma.tripMember.findMany({
    where: {
      tripId,
      userId: {
        in: users.map(u => u.id),
      },
      deletedAt: null,
    },
    select: {
      userId: true,
    },
  });

  const existingMemberIds = new Set(existingMembers.map(m => m.userId));

  // Get trip details for notifications
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      name: true,
      createdBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // Categorize results
  const invited: Array<{ email: string; userId: string; status: "invited" }> = [];
  const alreadyMembers: Array<{ email: string; userId: string; status: "already_member" }> = [];
  const notFound: Array<{ email: string; status: "not_found" }> = [];

  // Determine which users to invite
  const usersToInvite = users.filter(user => {
    if (existingMemberIds.has(user.id)) {
      alreadyMembers.push({
        email: user.email,
        userId: user.id,
        status: "already_member",
      });
      return false;
    }
    return true;
  });

  // Find emails that don't have registered users
  for (const email of normalizedEmails) {
    if (!usersByEmail.has(email)) {
      notFound.push({ email, status: "not_found" });
    }
  }

  // Create TripMember records and notifications in a transaction
  if (usersToInvite.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Create TripMember records with PENDING status
      await tx.tripMember.createMany({
        data: usersToInvite.map(user => ({
          tripId,
          userId: user.id,
          role: TripMemberRole.MEMBER,
          rsvpStatus: RsvpStatus.PENDING,
          invitedById,
        })),
      });

      // Create notifications for each invited user
      const notifications = usersToInvite.map(user => ({
        recipientId: user.id,
        senderId: invitedById,
        tripId,
        type: NotificationType.TRIP_INVITE,
        title: `Invitation to ${trip.name}`,
        message: `${trip.createdBy.displayName || trip.createdBy.email} invited you to join "${trip.name}"`,
        actionUrl: `/trips/${tripId}`,
        metadata: {
          tripId,
          tripName: trip.name,
          invitedBy: invitedById,
          invitedByName: trip.createdBy.displayName || trip.createdBy.email,
        },
      }));

      await createBatchNotifications(notifications);
    });

    // Log events for each invitation (outside transaction for idempotency)
    for (const user of usersToInvite) {
      invited.push({
        email: user.email,
        userId: user.id,
        status: "invited",
      });

      // Log the invitation event
      await logEvent(
        "TripMember",
        tripId,
        EventType.TRIP_UPDATED, // Using TRIP_UPDATED as generic event, could add MEMBER_INVITED if needed
        invitedById,
        {
          action: "member_invited",
          invitedUserId: user.id,
          invitedUserEmail: user.email,
        }
      );
    }
  }

  return {
    invited,
    alreadyMembers,
    notFound,
  };
}

/**
 * Updates a user's RSVP status for a trip.
 *
 * @param tripId - The ID of the trip
 * @param userId - The user ID responding to the invitation
 * @param status - The RSVP status (ACCEPTED or DECLINED)
 */
export async function updateRsvpStatus(
  tripId: string,
  userId: string,
  status: RsvpStatus.ACCEPTED | RsvpStatus.DECLINED
) {
  const member = await prisma.tripMember.findUnique({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
    include: {
      trip: {
        select: {
          name: true,
          createdById: true,
        },
      },
      user: {
        select: {
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!member) {
    throw new Error("Trip membership not found");
  }

  if (member.deletedAt) {
    throw new Error("This invitation has been cancelled");
  }

  // Update the RSVP status
  const updatedMember = await prisma.tripMember.update({
    where: {
      tripId_userId: {
        tripId,
        userId,
      },
    },
    data: {
      rsvpStatus: status,
    },
  });

  // Notify the trip organizer about the RSVP
  await createBatchNotifications([
    {
      recipientId: member.trip.createdById,
      senderId: userId,
      tripId,
      type: NotificationType.TRIP_INVITE,
      title: `RSVP Update: ${member.trip.name}`,
      message: `${member.user.displayName || member.user.email} ${status === RsvpStatus.ACCEPTED ? 'accepted' : 'declined'} your invitation to "${member.trip.name}"`,
      actionUrl: `/trips/${tripId}`,
      metadata: {
        tripId,
        tripName: member.trip.name,
        respondedUserId: userId,
        rsvpStatus: status,
      },
    },
  ]);

  // Log the RSVP event
  await logEvent(
    "TripMember",
    tripId,
    EventType.TRIP_UPDATED,
    userId,
    {
      action: "rsvp_updated",
      rsvpStatus: status,
    }
  );

  return updatedMember;
}

/**
 * Removes a member from a trip (for organizers to cancel invitations or remove members).
 *
 * @param tripId - The ID of the trip
 * @param userIdToRemove - The user ID to remove from the trip
 * @param removedById - The user ID performing the removal (must be OWNER or ADMIN)
 */
export async function removeTripMember(
  tripId: string,
  userIdToRemove: string,
  removedById: string
) {
  // Soft delete the member
  const deletedMember = await prisma.tripMember.update({
    where: {
      tripId_userId: {
        tripId,
        userId: userIdToRemove,
      },
    },
    data: {
      deletedAt: new Date(),
    },
  });

  // Log the removal event
  await logEvent(
    "TripMember",
    tripId,
    EventType.TRIP_UPDATED,
    removedById,
    {
      action: "member_removed",
      removedUserId: userIdToRemove,
    }
  );

  return deletedMember;
}
