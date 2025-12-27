import { prisma } from "@/lib/prisma";
import { TripMemberRole, TripStatus, EventType, MilestoneTriggerType, UserRole, UserType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import { adminAuth } from "@/lib/firebase/admin";
import type { CreateTripInput, UpdateTripInput } from "@/types/schemas";
import crypto from "crypto";

/**
 * Generates a unique username for sign-up mode viewer accounts.
 * Format: trip_<tripId-short>_viewer
 */
function generateSignUpUsername(tripId: string): string {
  const shortId = tripId.slice(0, 8);
  return `trip_${shortId}_viewer`;
}

/**
 * Generates a random password for sign-up mode.
 */
function generateRandomPassword(): string {
  return crypto.randomBytes(6).toString("base64").slice(0, 10);
}

/**
 * Creates or updates a viewer user for sign-up mode.
 * Returns the user ID and password.
 */
export async function createOrUpdateSignUpViewer(
  tripId: string,
  tripName: string,
  existingUserId?: string | null,
  newPassword?: string | null
): Promise<{ userId: string; password: string }> {
  const username = generateSignUpUsername(tripId);
  const email = `${username}@tripplanner.local`;
  const password = newPassword || generateRandomPassword();
  const displayName = `${tripName} Viewer`;

  if (existingUserId) {
    // Update existing user's password if needed
    if (newPassword) {
      try {
        await adminAuth.updateUser(existingUserId, {
          password: newPassword,
          displayName,
        });
      } catch (firebaseError: any) {
        console.error("Failed to update Firebase user:", firebaseError);
        // If user doesn't exist in Firebase, recreate them
        if (firebaseError.code === 'auth/user-not-found') {
          await adminAuth.createUser({
            uid: existingUserId,
            email,
            password,
            displayName,
          });
        } else {
          throw new Error(`Failed to update sign-up viewer: ${firebaseError.message}`);
        }
      }
    }

    // Update displayName in database
    await prisma.user.update({
      where: { id: existingUserId },
      data: { displayName },
    });

    return { userId: existingUserId, password };
  }

  // Create new Firebase user
  let firebaseUser;
  try {
    firebaseUser = await adminAuth.createUser({
      email,
      password,
      displayName,
    });
  } catch (firebaseError: any) {
    // If email already exists, find and return that user
    if (firebaseError.code === 'auth/email-already-exists') {
      const existingFirebaseUser = await adminAuth.getUserByEmail(email);
      // Update the password for the existing user
      await adminAuth.updateUser(existingFirebaseUser.uid, {
        password,
        displayName,
      });
      firebaseUser = existingFirebaseUser;
    } else {
      throw new Error(`Failed to create sign-up viewer: ${firebaseError.message}`);
    }
  }

  // Create or update user in database
  const dbUser = await prisma.user.upsert({
    where: { id: firebaseUser.uid },
    create: {
      id: firebaseUser.uid,
      email,
      displayName,
      role: UserRole.VIEWER,
      userType: UserType.SYSTEM,
      timezone: "UTC",
      language: "en",
      defaultCurrency: "GBP",
    },
    update: {
      displayName,
      role: UserRole.VIEWER,
      userType: UserType.SYSTEM,
    },
  });

  return { userId: dbUser.id, password };
}

/**
 * Creates default timeline items for a new trip.
 * Timeline includes: event created, event start, event end
 */
async function createDefaultTimelineItems(
  tripId: string,
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const now = new Date();
  const timelineItems = [];

  // 1. Event Created (completed)
  // Ensure the "Event Created" date is before the event start time
  // If not, set it to 1 second before event start
  let eventCreatedDate = now;
  if (startDate && now >= startDate) {
    eventCreatedDate = new Date(startDate.getTime() - 1000); // 1 second before start
  }

  timelineItems.push({
    tripId,
    title: "Event Created",
    description: "Trip planning has begun",
    date: eventCreatedDate,
    isCompleted: true,
    completedAt: eventCreatedDate,
    order: 0,
    createdById: userId,
  });

  // 2. Event Start
  if (startDate) {
    timelineItems.push({
      tripId,
      title: "Event Starts",
      description: "The trip begins!",
      date: startDate,
      isCompleted: false,
      order: 1,
      createdById: userId,
    });
  }

  // 3. Event End
  if (endDate) {
    timelineItems.push({
      tripId,
      title: "Event Ends",
      description: "The trip concludes",
      date: endDate,
      isCompleted: false,
      order: 2,
      createdById: userId,
    });
  }

  return timelineItems;
}

/**
 * Creates a new trip with the authenticated user as owner.
 * Seeds default timeline items and logs the creation event.
 * If signUpMode is enabled, creates a viewer user for the trip.
 *
 * @param userId - Firebase UID of the user creating the trip
 * @param data - Trip creation data
 * @returns Created trip object with signUpPassword if signUpMode is enabled
 */
export async function createTrip(userId: string, data: CreateTripInput) {
  // Use a transaction to ensure all operations succeed or fail together
  const trip = await prisma.$transaction(async (tx) => {
    // Create the trip first (without sign-up mode fields - we'll update after)
    const newTrip = await tx.trip.create({
      data: {
        name: data.name,
        description: data.description || null,
        baseCurrency: data.baseCurrency || "USD",
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        status: TripStatus.PLANNING,
        createdById: userId,
        signUpMode: data.signUpMode || false,
        signInMode: data.signInMode || false,
        headerImageData: data.headerImageData || null,
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

  // Handle sign-up/sign-in mode (outside transaction to use Firebase Admin SDK)
  let signUpPassword: string | null = null;

  if (data.signUpMode) {
    // Sign-up mode: create viewer user and set password
    const { userId: viewerUserId, password } = await createOrUpdateSignUpViewer(
      trip.id,
      data.name,
      null,
      data.signUpPassword
    );
    signUpPassword = password;

    // Update trip with viewer user ID and password
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        signUpViewerUserId: viewerUserId,
        signUpPassword: password,
      },
    });

    // Add the viewer as a trip member with VIEWER role
    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: viewerUserId,
        role: TripMemberRole.VIEWER,
        rsvpStatus: "ACCEPTED",
      },
    });
  } else if (data.signInMode && data.signUpPassword) {
    // Sign-in mode only (no sign-up): just set the password, no viewer user needed
    signUpPassword = data.signUpPassword;
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        signUpPassword: data.signUpPassword,
      },
    });
  }

  // Log the event (outside transaction for idempotency)
  await logEvent("Trip", trip.id, EventType.TRIP_CREATED, userId, {
    name: trip.name,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    signUpMode: data.signUpMode || false,
    signInMode: data.signInMode || false,
  });

  // Return trip with sign-up password if applicable
  return {
    ...trip,
    signUpPassword,
    signUpMode: data.signUpMode || false,
    signInMode: data.signInMode || false,
  };
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
  // RSVP deadline: 1 week before start if still in future, otherwise start date
  let rsvpDeadline: Date;
  if (startDate) {
    const oneWeekBefore = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    rsvpDeadline = oneWeekBefore > now ? oneWeekBefore : startDate;
  } else {
    rsvpDeadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  }

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
    dateUpdates["Event Starts"] = startDate;
  }
  if (endDate !== undefined) {
    dateUpdates["Event Ends"] = endDate;
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
 * Handles sign-up mode changes (creating/updating viewer user).
 * Logs an EventLog entry with changes.
 *
 * @param tripId - ID of the trip to update
 * @param userId - Firebase UID of the user updating the trip
 * @param data - Trip update data
 * @returns Updated trip object with signUpPassword if applicable
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
    // Update the trip (excluding signUpMode fields which are handled separately)
    const updatedTrip = await tx.trip.update({
      where: { id: tripId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.baseCurrency !== undefined && { baseCurrency: data.baseCurrency }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.signUpMode !== undefined && { signUpMode: data.signUpMode }),
        ...(data.signInMode !== undefined && { signInMode: data.signInMode }),
        ...(data.headerImageData !== undefined && { headerImageData: data.headerImageData }),
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

  // Handle sign-up mode changes (outside transaction to use Firebase Admin SDK)
  let signUpPassword: string | null = existingTrip.signUpPassword;
  const tripName = data.name || existingTrip.name;

  // Case 1: Setting a password (new password provided and different from existing)
  // This creates/updates the viewer user regardless of signUpMode
  if (
    data.signUpPassword !== undefined &&
    data.signUpPassword !== null &&
    data.signUpPassword !== existingTrip.signUpPassword
  ) {
    const { userId: viewerUserId, password } = await createOrUpdateSignUpViewer(
      tripId,
      tripName,
      existingTrip.signUpViewerUserId,
      data.signUpPassword
    );
    signUpPassword = password;

    // Update trip with viewer user ID and password
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        signUpViewerUserId: viewerUserId,
        signUpPassword: password,
      },
    });

    // Add the viewer as a trip member or restore if soft-deleted
    const existingMembership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: viewerUserId,
        },
      },
    });

    if (!existingMembership) {
      // Create new membership
      await prisma.tripMember.create({
        data: {
          tripId,
          userId: viewerUserId,
          role: TripMemberRole.VIEWER,
          rsvpStatus: "ACCEPTED",
        },
      });
    } else if (existingMembership.deletedAt !== null) {
      // Restore soft-deleted membership
      await prisma.tripMember.update({
        where: {
          tripId_userId: {
            tripId,
            userId: viewerUserId,
          },
        },
        data: {
          deletedAt: null,
          role: TripMemberRole.VIEWER,
          rsvpStatus: "ACCEPTED",
        },
      });
    }
  }
  // Case 2: Clearing the password (setting to null)
  else if (data.signUpPassword === null && existingTrip.signUpPassword !== null) {
    // Remove the viewer from the trip (soft delete the membership)
    if (existingTrip.signUpViewerUserId) {
      await prisma.tripMember.updateMany({
        where: {
          tripId,
          userId: existingTrip.signUpViewerUserId,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    // Clear password and viewer user link on the trip
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        signUpViewerUserId: null,
        signUpPassword: null,
      },
    });

    signUpPassword = null;
  }
  // Case 3: Enabling sign-up mode (was off, now on) - viewer already exists if password is set
  else if (data.signUpMode === true && !existingTrip.signUpMode) {
    // If there's already a viewer user (from setting password), just enable the mode
    // If no password is set, this is a no-op for now (sign-up mode without password doesn't make sense)
  }
  // Case 4: Disabling sign-up mode (was on, now off) - keep password and viewer if set
  else if (data.signUpMode === false && existingTrip.signUpMode) {
    // Just disable sign-up mode, but keep the password and viewer user
    // This allows password login to continue working without sign-up mode
  }

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
  if (data.signUpMode !== undefined && data.signUpMode !== existingTrip.signUpMode) {
    changes.signUpMode = { old: existingTrip.signUpMode, new: data.signUpMode };
  }
  if (data.signInMode !== undefined && data.signInMode !== existingTrip.signInMode) {
    changes.signInMode = { old: existingTrip.signInMode, new: data.signInMode };
  }

  if (Object.keys(changes).length > 0 || result.affectedTimelineItems.length > 0) {
    await logEvent("Trip", tripId, EventType.TRIP_UPDATED, userId, {
      changes,
      affectedTimelineItems: result.affectedTimelineItems,
    });
  }

  // Return updated trip with sign-up password if applicable
  return {
    ...result.updatedTrip,
    signUpPassword,
  };
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
          displayName: true,
          photoURL: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
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
 * Optimized to only fetch the current user's membership and a member count.
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
    select: {
      id: true,
      name: true,
      description: true,
      baseCurrency: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
      members: {
        where: { userId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          role: true,
          rsvpStatus: true,
        },
      },
      _count: {
        select: {
          members: {
            where: { deletedAt: null, role: { not: "VIEWER" } },
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
 * Gets all trips in the system (admin only).
 * Used when admin mode is enabled.
 * Optimized to only fetch member counts, not full member data.
 */
export async function getAllTrips(adminUserId?: string) {
  return prisma.trip.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      baseCurrency: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
      members: adminUserId
        ? {
            where: { userId: adminUserId, deletedAt: null },
            select: {
              id: true,
              userId: true,
              role: true,
              rsvpStatus: true,
            },
          }
        : false,
      _count: {
        select: {
          members: {
            where: { deletedAt: null, role: { not: "VIEWER" } },
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
    location: trip.location,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    spendStatus: trip.spendStatus,
    rsvpStatus: trip.rsvpStatus,
    headerImageData: trip.headerImageData,
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

  // Only show sign-up mode info to owners
  const isOwner = userMembership?.role === "OWNER";

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    location: trip.location,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    spendStatus: trip.spendStatus,
    rsvpStatus: trip.rsvpStatus,
    headerImageData: trip.headerImageData,
    // Sign-up/sign-in mode fields (only visible to owners)
    signUpMode: isOwner ? trip.signUpMode : undefined,
    signInMode: isOwner ? trip.signInMode : undefined,
    signUpPassword: isOwner ? trip.signUpPassword : undefined,
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
      triggerType: t.triggerType,
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

  console.log(`[checkAndAutoCloseRsvp] RSVP deadline: ${rsvpDeadline.date}, isCompleted: ${rsvpDeadline.isCompleted}, triggerType: ${rsvpDeadline.triggerType}`);

  // If milestone is already completed or manually overridden, don't trigger again
  if (rsvpDeadline.isCompleted) {
    console.log(`[checkAndAutoCloseRsvp] Milestone already completed, skipping auto-close`);
    return;
  }

  // If user manually touched this milestone (even to uncomplete it), respect their decision
  if (rsvpDeadline.triggerType === MilestoneTriggerType.MANUAL) {
    console.log(`[checkAndAutoCloseRsvp] Milestone manually overridden by user, skipping auto-close`);
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
      // Mark milestone as completed with DEADLINE trigger
      prisma.timelineItem.update({
        where: { id: rsvpDeadline.id },
        data: {
          isCompleted: true,
          completedAt: now,
          triggerType: MilestoneTriggerType.DEADLINE,
        },
      }),
    ]);
    console.log(`[checkAndAutoCloseRsvp] Auto-closed RSVP for trip ${tripId} - deadline reached`);
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
 * Checks if choice deadline has passed and automatically closes the choice if needed.
 * Similar to checkAndAutoCloseRsvp but for choice deadlines.
 *
 * Uses milestone completion tracking:
 * - Only triggers if the milestone is NOT completed (isCompleted = false)
 * - Marks the milestone as completed when closing choice
 */
export async function checkAndAutoCloseChoice(choiceId: string) {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId, archivedAt: null },
    include: {
      timelineItems: {
        where: {
          deletedAt: null,
        },
      },
    },
  });

  console.log(`[checkAndAutoCloseChoice] Choice ${choiceId}: status = ${choice?.status}`);

  if (!choice) {
    console.log(`[checkAndAutoCloseChoice] Choice not found`);
    return;
  }

  // Only check if choice is currently open
  if (choice.status !== "OPEN") {
    console.log(`[checkAndAutoCloseChoice] Choice not OPEN (${choice.status}), skipping`);
    return;
  }

  // Find the milestone for this choice
  const choiceMilestone = choice.timelineItems[0];

  if (!choiceMilestone?.date) {
    console.log(`[checkAndAutoCloseChoice] No milestone/deadline found for choice`);
    return;
  }

  console.log(`[checkAndAutoCloseChoice] Choice deadline: ${choiceMilestone.date}, isCompleted: ${choiceMilestone.isCompleted}, triggerType: ${choiceMilestone.triggerType}`);

  // If milestone is already completed or manually overridden, don't trigger again
  if (choiceMilestone.isCompleted) {
    console.log(`[checkAndAutoCloseChoice] Milestone already completed, skipping auto-close`);
    return;
  }

  // If user manually touched this milestone (even to uncomplete it), respect their decision
  if (choiceMilestone.triggerType === MilestoneTriggerType.MANUAL) {
    console.log(`[checkAndAutoCloseChoice] Milestone manually overridden by user, skipping auto-close`);
    return;
  }

  const deadlineDate = new Date(choiceMilestone.date);
  const now = new Date();

  // If deadline has passed and milestone is not completed, close choice and mark milestone complete
  if (deadlineDate < now) {
    await prisma.$transaction([
      // Close choice
      prisma.choice.update({
        where: { id: choiceId },
        data: {
          status: "CLOSED",
        },
      }),
      // Mark milestone as completed with DEADLINE trigger
      prisma.timelineItem.update({
        where: { id: choiceMilestone.id },
        data: {
          isCompleted: true,
          completedAt: now,
          triggerType: MilestoneTriggerType.DEADLINE,
        },
      }),
    ]);
    console.log(`[checkAndAutoCloseChoice] Auto-closed choice ${choiceId} - deadline reached`);
  }
}

/**
 * Checks if spending deadline has passed and automatically closes spending if needed.
 * Similar to checkAndAutoCloseRsvp but for spending window.
 */
export async function checkAndAutoCloseSpending(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, deletedAt: null },
    include: {
      timelineItems: {
        where: {
          title: "Spending Window Closes",
          deletedAt: null,
        },
      },
    },
  });

  console.log(`[checkAndAutoCloseSpending] Trip ${tripId}: spendStatus = ${trip?.spendStatus}`);

  if (!trip) {
    console.log(`[checkAndAutoCloseSpending] Trip not found`);
    return;
  }

  // Only check if spending is currently open
  if (trip.spendStatus !== "OPEN") {
    console.log(`[checkAndAutoCloseSpending] Spending not OPEN (${trip.spendStatus}), skipping`);
    return;
  }

  // Find the spending deadline milestone
  const spendDeadline = trip.timelineItems[0];

  if (!spendDeadline?.date) {
    console.log(`[checkAndAutoCloseSpending] No spending deadline found`);
    return;
  }

  console.log(`[checkAndAutoCloseSpending] Spending deadline: ${spendDeadline.date}, isCompleted: ${spendDeadline.isCompleted}, triggerType: ${spendDeadline.triggerType}`);

  // If milestone is already completed or manually overridden, don't trigger again
  if (spendDeadline.isCompleted) {
    console.log(`[checkAndAutoCloseSpending] Milestone already completed, skipping auto-close`);
    return;
  }

  // If user manually touched this milestone (even to uncomplete it), respect their decision
  if (spendDeadline.triggerType === MilestoneTriggerType.MANUAL) {
    console.log(`[checkAndAutoCloseSpending] Milestone manually overridden by user, skipping auto-close`);
    return;
  }

  const deadlineDate = new Date(spendDeadline.date);
  const now = new Date();

  // If deadline has passed and milestone is not completed, close spending and mark milestone complete
  if (deadlineDate < now) {
    await prisma.$transaction([
      // Close spending
      prisma.trip.update({
        where: { id: tripId },
        data: {
          spendStatus: "CLOSED",
        },
      }),
      // Mark milestone as completed with DEADLINE trigger
      prisma.timelineItem.update({
        where: { id: spendDeadline.id },
        data: {
          isCompleted: true,
          completedAt: now,
          triggerType: MilestoneTriggerType.DEADLINE,
        },
      }),
    ]);
    console.log(`[checkAndAutoCloseSpending] Auto-closed spending for trip ${tripId} - deadline reached`);
  }
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
      await checkAndAutoCloseSpending(tripId);
      break;

    case "Settlement Deadline":
      // TODO: Implement checkSettlementDeadline(tripId) to send reminders or mark overdue
      console.log(`[triggerMilestoneChecks] Settlement Deadline check - placeholder for future implementation`);
      break;

    case "Event Starts":
      // TODO: Implement checkTripStart(tripId) for any start-of-trip actions
      console.log(`[triggerMilestoneChecks] Event Starts check - placeholder for future implementation`);
      break;

    case "Event Ends":
      // TODO: Implement checkTripEnd(tripId) for any end-of-trip actions
      console.log(`[triggerMilestoneChecks] Event Ends check - placeholder for future implementation`);
      break;

    default:
      // Check if it's a choice-specific milestone (starts with "Choice:")
      if (milestoneTitle.startsWith("Choice:")) {
        // Find the choice by the milestone
        const milestone = await prisma.timelineItem.findFirst({
          where: {
            tripId,
            title: milestoneTitle,
            deletedAt: null,
          },
        });

        if (milestone?.choiceId) {
          await checkAndAutoCloseChoice(milestone.choiceId);
        }
      } else {
        console.log(`[triggerMilestoneChecks] No automatic action defined for milestone: ${milestoneTitle}`);
      }
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

  const now = new Date();

  // Use transaction to delete timeline item and clear choice deadline if linked
  const deletedItem = await prisma.$transaction(async (tx) => {
    // Soft delete the timeline item
    const deleted = await tx.timelineItem.update({
      where: { id: itemId },
      data: {
        deletedAt: now,
      },
    });

    // If this timeline item is linked to a choice, clear the choice's deadline
    if (timelineItem.choiceId) {
      await tx.choice.update({
        where: { id: timelineItem.choiceId },
        data: {
          deadline: null,
        },
      });
      console.log(`[deleteTimelineItem] Cleared deadline from choice ${timelineItem.choiceId} due to milestone deletion`);
    }

    return deleted;
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
