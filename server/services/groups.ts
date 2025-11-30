import { prisma } from "@/lib/prisma";
import { EventType, GroupMemberRole } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import type { GroupCreate, GroupUpdate, GroupMemberCreate } from "@/types/schemas";

// ============================================================================
// Group CRUD Operations
// ============================================================================

/**
 * Creates a new group and adds the creator as an admin member.
 */
export async function createGroup(userId: string, data: GroupCreate) {
  const group = await prisma.group.create({
    data: {
      name: data.name,
      description: data.description,
      ownerId: userId,
    },
  });

  // Add creator as an admin member
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: userId,
      role: GroupMemberRole.ADMIN,
    },
  });

  // Log event
  await logEvent("Group", group.id, EventType.GROUP_CREATED, userId, {
    name: group.name,
    description: group.description,
  });

  return group;
}

/**
 * Gets a single group by ID with optional member details.
 */
export async function getGroup(groupId: string, includeMembers = false) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: includeMembers
      ? {
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
        }
      : undefined,
  });

  if (!group) {
    throw new Error("Group not found");
  }

  return group;
}

/**
 * Lists all groups where the user is either the owner or a member.
 */
export async function listUserGroups(userId: string) {
  const groups = await prisma.group.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: { members: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Map to include memberCount
  return groups.map((group) => ({
    ...group,
    memberCount: group._count.members,
  }));
}

/**
 * Updates a group's name and/or description.
 * Requires admin rights.
 */
export async function updateGroup(
  groupId: string,
  userId: string,
  data: GroupUpdate
) {
  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  // Log event
  await logEvent("Group", group.id, EventType.GROUP_UPDATED, userId, {
    name: group.name,
    description: group.description,
  });

  return group;
}

/**
 * Deletes a group and all its members.
 * Requires owner rights (only owner can delete).
 */
export async function deleteGroup(groupId: string, userId: string) {
  // Verify ownership
  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  if (group.ownerId !== userId) {
    throw new Error("Only the group owner can delete the group");
  }

  // Delete the group (members will cascade)
  await prisma.group.delete({
    where: { id: groupId },
  });

  // Log event
  await logEvent("Group", groupId, EventType.GROUP_DELETED, userId, {
    name: group.name,
  });

  return { success: true };
}

// ============================================================================
// Group Member Operations
// ============================================================================

/**
 * Lists all members of a group with user details.
 */
export async function listGroupMembers(groupId: string) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
    },
    orderBy: [
      { role: "desc" }, // Admins first
      { joinedAt: "asc" },
    ],
  });

  return members;
}

/**
 * Adds a member to a group.
 * Prevents duplicate memberships.
 * Requires admin rights.
 */
export async function addGroupMember(
  groupId: string,
  adminUserId: string,
  data: GroupMemberCreate
) {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: data.userId,
      },
    },
  });

  if (existing) {
    throw new Error("User is already a member of this group");
  }

  // Add member
  const member = await prisma.groupMember.create({
    data: {
      groupId,
      userId: data.userId,
      role: data.role || GroupMemberRole.MEMBER,
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
  });

  // Log event
  await logEvent("Group", groupId, EventType.GROUP_MEMBER_ADDED, adminUserId, {
    userId: data.userId,
    userEmail: user.email,
    role: member.role,
  });

  return member;
}

/**
 * Removes a member from a group.
 * Requires admin rights.
 * Cannot remove the group owner.
 */
export async function removeGroupMember(
  groupId: string,
  userId: string,
  adminUserId: string
) {
  // Verify group exists and get owner
  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  // Cannot remove the owner
  if (group.ownerId === userId) {
    throw new Error("Cannot remove the group owner");
  }

  // Check if member exists
  const member = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!member) {
    throw new Error("User is not a member of this group");
  }

  // Remove member
  await prisma.groupMember.delete({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
  });

  // Log event
  await logEvent("Group", groupId, EventType.GROUP_MEMBER_REMOVED, adminUserId, {
    userId,
    userName: member.user.displayName,
  });

  return { success: true };
}

// ============================================================================
// Discoverable Users - For Invite Flow
// ============================================================================

/**
 * Returns the union of members from selected groups that the caller belongs to.
 * Optionally excludes existing trip members.
 * De-duplicates users across groups.
 */
export async function getDiscoverableUsers(
  userId: string,
  groupIds: string[],
  tripId?: string
) {
  if (groupIds.length === 0) {
    return [];
  }

  // Verify caller belongs to all requested groups
  for (const groupId of groupIds) {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error(`You are not a member of group ${groupId}`);
    }
  }

  // Get all members from selected groups
  const members = await prisma.groupMember.findMany({
    where: {
      groupId: {
        in: groupIds,
      },
    },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          displayName: true,
          photoURL: true,
        },
      },
    },
  });

  // De-duplicate by userId
  const userMap = new Map();
  for (const member of members) {
    if (!userMap.has(member.userId)) {
      userMap.set(member.userId, member.user);
    }
  }

  let users = Array.from(userMap.values());

  // Exclude existing trip members if tripId provided
  if (tripId) {
    const tripMembers = await prisma.tripMember.findMany({
      where: { tripId },
      select: { userId: true },
    });

    const tripMemberIds = new Set(tripMembers.map((m) => m.userId));
    users = users.filter((user) => !tripMemberIds.has(user.id));
  }

  return users;
}
