import { prisma } from "@/lib/prisma";
import { RsvpStatus, TripMemberRole, EventType, NotificationType, NotificationStatus, UserType, UserRole } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import { createBatchNotifications } from "./notifications";
import { getDiscoverableUsers } from "./groups";
import { randomUUID } from "crypto";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Invites users to a trip by email or userId.
 * When using userIds with groupIds, validates that users are in the caller's discoverable set.
 * Creates TripMember rows with RSVP=PENDING and sends in-app notifications.
 *
 * @param tripId - The ID of the trip
 * @param inviteData - Object containing emails, userIds, and optional groupIds
 * @param invitedById - The user ID of the person sending the invitations
 * @returns Object containing invited users, already members, and not found emails/users
 */
export async function inviteUsersToTrip(
  tripId: string,
  inviteData: {
    emails?: string[];
    userIds?: string[];
    groupIds?: string[];
    nonUserNames?: string[];
  },
  invitedById: string
) {
  let users: Array<{ id: string; email: string; displayName: string | null; photoURL: string | null }> = [];
  const createdUsers: Array<{ id: string; email: string; displayName: string | null; photoURL: string | null }> = [];

  // Handle invitations by userId (with group filtering)
  if (inviteData.userIds && inviteData.userIds.length > 0) {
    // If groupIds are provided, validate that all userIds are in the discoverable set
    if (inviteData.groupIds && inviteData.groupIds.length > 0) {
      const discoverableUsers = await getDiscoverableUsers(
        invitedById,
        inviteData.groupIds,
        tripId
      );
      const discoverableUserIds = new Set(discoverableUsers.map(u => u.id));

      // Validate all userIds are discoverable
      for (const userId of inviteData.userIds) {
        if (!discoverableUserIds.has(userId)) {
          throw new Error(
            `User ${userId} is not in your selected groups or is already a trip member`
          );
        }
      }
    }

    // Fetch users by ID
    const fetchedUsers = await prisma.user.findMany({
      where: {
        id: {
          in: inviteData.userIds,
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

    users = fetchedUsers;
  }
  // Handle invitations by email (legacy support)
  else if (inviteData.emails && inviteData.emails.length > 0) {
    // Normalize emails to lowercase for consistent lookups
    const normalizedEmails = inviteData.emails.map(e => e.toLowerCase().trim());

    users = await prisma.user.findMany({
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
  }

  // Handle invitations by name (create SIGNUP users with .fake emails)
  if (inviteData.nonUserNames && inviteData.nonUserNames.length > 0) {
    // Get the trip password - required to create SIGNUP users in Firebase
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { signUpPassword: true },
    });

    if (!trip?.signUpPassword) {
      throw new Error("Trip password must be set to invite people by name. Set a trip password in trip settings.");
    }

    for (const name of inviteData.nonUserNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      // Generate a unique .fake email for this user
      // Format: <name>@<uniqueId>.fake
      const uniqueId = randomUUID();
      const shortId = uniqueId.slice(0, 8);
      const cleanName = trimmedName
        .toLowerCase()
        .replace(/\s+/g, ".")
        .replace(/[^a-z0-9.]/g, "");
      const fakeEmail = `${cleanName}@${shortId}.fake`;

      // Create the user in Firebase first
      let firebaseUser;
      try {
        firebaseUser = await adminAuth.createUser({
          uid: uniqueId,
          email: fakeEmail,
          password: trip.signUpPassword,
          displayName: trimmedName,
        });
      } catch (firebaseError: any) {
        console.error("Failed to create Firebase user:", firebaseError);
        throw new Error(`Failed to create user account for ${trimmedName}`);
      }

      // Create the SIGNUP user in database
      const newUser = await prisma.user.create({
        data: {
          id: firebaseUser.uid,
          email: fakeEmail,
          displayName: trimmedName,
          userType: UserType.SIGNUP,
          role: UserRole.USER,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
        },
      });

      createdUsers.push(newUser);
    }

    // Add created users to the users array
    users = [...users, ...createdUsers];
  }

  if (users.length === 0) {
    return {
      invited: [],
      alreadyMembers: [],
      notFound: inviteData.emails?.map(email => ({ email, status: "not_found" as const })) ||
                inviteData.userIds?.map(userId => ({ userId, status: "not_found" as const })) ||
                [],
    };
  }

  // Find existing members (both active and soft-deleted)
  const existingMembers = await prisma.tripMember.findMany({
    where: {
      tripId,
      userId: {
        in: users.map(u => u.id),
      },
    },
    select: {
      userId: true,
      deletedAt: true,
    },
  });

  // Separate active members from soft-deleted ones
  const activeMemberIds = new Set(
    existingMembers
      .filter(m => m.deletedAt === null)
      .map(m => m.userId)
  );
  const softDeletedMemberIds = new Set(
    existingMembers
      .filter(m => m.deletedAt !== null)
      .map(m => m.userId)
  );

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
  const usersToReInvite: typeof users = [];

  // Determine which users to invite
  const usersToInvite = users.filter(user => {
    // User is already an active member
    if (activeMemberIds.has(user.id)) {
      alreadyMembers.push({
        email: user.email,
        userId: user.id,
        status: "already_member",
      });
      return false;
    }

    // User was previously removed (soft-deleted), needs re-invitation
    if (softDeletedMemberIds.has(user.id)) {
      usersToReInvite.push(user);
      return false;
    }

    return true;
  });

  // Find emails/userIds that don't have registered users
  if (inviteData.emails) {
    const usersByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const normalizedEmails = inviteData.emails.map(e => e.toLowerCase().trim());
    for (const email of normalizedEmails) {
      if (!usersByEmail.has(email)) {
        notFound.push({ email, status: "not_found" });
      }
    }
  } else if (inviteData.userIds) {
    const userIds = new Set(users.map(u => u.id));
    for (const userId of inviteData.userIds) {
      if (!userIds.has(userId)) {
        // Use email field for backward compatibility with return type
        notFound.push({ email: userId, status: "not_found" });
      }
    }
  }

  // Create TripMember records and notifications in a transaction
  const allUsersToProcess = [...usersToInvite, ...usersToReInvite];

  if (allUsersToProcess.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Create new TripMember records for new invites
      if (usersToInvite.length > 0) {
        await tx.tripMember.createMany({
          data: usersToInvite.map(user => ({
            tripId,
            userId: user.id,
            role: TripMemberRole.MEMBER,
            rsvpStatus: RsvpStatus.PENDING,
            invitedById,
          })),
        });
      }

      // Re-activate soft-deleted members (undelete and reset to PENDING)
      if (usersToReInvite.length > 0) {
        for (const user of usersToReInvite) {
          await tx.tripMember.update({
            where: {
              tripId_userId: {
                tripId,
                userId: user.id,
              },
            },
            data: {
              deletedAt: null,
              rsvpStatus: RsvpStatus.PENDING,
              invitedById,
            },
          });
        }
      }

      // Create notifications for all invited/re-invited users
      await tx.notification.createMany({
        data: allUsersToProcess.map(user => ({
          recipientId: user.id,
          senderId: invitedById,
          tripId,
          type: NotificationType.TRIP_INVITE,
          status: NotificationStatus.UNREAD,
          title: `Invitation to ${trip.name}`,
          message: `${trip.createdBy.displayName || trip.createdBy.email} invited you to join "${trip.name}"`,
          actionUrl: `/trips/${tripId}`,
          metadata: {
            tripId,
            tripName: trip.name,
            invitedBy: invitedById,
            invitedByName: trip.createdBy.displayName || trip.createdBy.email,
          },
        })),
      });
    });

    // Log events for each invitation (outside transaction for idempotency)
    for (const user of allUsersToProcess) {
      invited.push({
        email: user.email,
        userId: user.id,
        status: "invited",
      });

      const isReInvite = usersToReInvite.includes(user);

      // Log the invitation event
      await logEvent(
        "TripMember",
        tripId,
        EventType.TRIP_UPDATED, // Using TRIP_UPDATED as generic event, could add MEMBER_INVITED if needed
        invitedById,
        {
          action: isReInvite ? "member_re_invited" : "member_invited",
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
 * @param status - The RSVP status (ACCEPTED, DECLINED, or MAYBE)
 */
export async function updateRsvpStatus(
  tripId: string,
  userId: string,
  status: RsvpStatus
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
  const rsvpAction =
    status === RsvpStatus.ACCEPTED ? 'accepted' :
    status === RsvpStatus.DECLINED ? 'declined' :
    'responded maybe to';

  await createBatchNotifications([
    {
      recipientId: member.trip.createdById,
      senderId: userId,
      tripId,
      type: NotificationType.TRIP_INVITE,
      title: `RSVP Update: ${member.trip.name}`,
      message: `${member.user.displayName || member.user.email} ${rsvpAction} your invitation to "${member.trip.name}"`,
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

  // Delete the user's tick items for all lists in this trip
  await prisma.itemTick.deleteMany({
    where: {
      userId: userIdToRemove,
      OR: [
        {
          todoItem: {
            list: {
              tripId,
            },
          },
        },
        {
          kitItem: {
            list: {
              tripId,
            },
          },
        },
      ],
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
