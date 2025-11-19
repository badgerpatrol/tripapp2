import { prisma } from "@/lib/prisma";
import { EventType, TagEntityType, UserRole } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import { requireTripMember, isAdmin } from "@/server/authz";
import { incrementTagUsage, decrementTagUsage } from "./tags";

/**
 * Resolves an entity (spend, checklist_item, kit_item) to its trip ID.
 * Throws an error if the entity doesn't exist.
 *
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 * @returns Trip ID
 */
async function resolveTripIdForEntity(
  entityType: TagEntityType,
  entityId: string
): Promise<string> {
  switch (entityType) {
    case TagEntityType.spend: {
      const spend = await prisma.spend.findUnique({
        where: { id: entityId, deletedAt: null },
        select: { tripId: true },
      });
      if (!spend) {
        throw new Error("Spend not found");
      }
      return spend.tripId;
    }
    case TagEntityType.checklist_item: {
      const item = await prisma.checklistItem.findUnique({
        where: { id: entityId, deletedAt: null },
        select: {
          checklist: {
            select: { tripId: true },
          },
        },
      });
      if (!item) {
        throw new Error("Checklist item not found");
      }
      return item.checklist.tripId;
    }
    case TagEntityType.kit_item: {
      const item = await prisma.kitItemInstance.findUnique({
        where: { id: entityId },
        select: {
          list: {
            select: { tripId: true },
          },
        },
      });
      if (!item) {
        throw new Error("Kit item not found");
      }
      return item.list.tripId;
    }
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Requires that a user is a member of the trip that owns the entity,
 * or is a global admin.
 *
 * @param userId - Firebase UID
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 */
export async function requireTripMemberForEntity(
  userId: string,
  entityType: TagEntityType,
  entityId: string
) {
  // Allow global admins
  if (await isAdmin(userId)) {
    return;
  }

  const tripId = await resolveTripIdForEntity(entityType, entityId);
  await requireTripMember(userId, tripId);
}

/**
 * Lists all tags linked to a specific entity.
 *
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 * @returns Array of tags
 */
export async function listTagsForEntity(
  entityType: TagEntityType,
  entityId: string
) {
  const links = await prisma.tagLink.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          usageCount: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return links.map((link) => link.tag);
}

/**
 * Creates a link between a tag and an entity.
 * Returns existing link if it already exists (idempotent).
 *
 * @param tagId - Tag ID
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 * @param byUser - Firebase UID of the user creating the link
 * @returns TagLink object
 */
export async function linkTag(
  tagId: string,
  entityType: TagEntityType,
  entityId: string,
  byUser: string
) {
  // Verify tag exists
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  // Check if link already exists
  const existing = await prisma.tagLink.findUnique({
    where: {
      tagId_entityType_entityId: {
        tagId,
        entityType,
        entityId,
      },
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          usageCount: true,
        },
      },
    },
  });

  if (existing) {
    // Return existing link (idempotent)
    return existing;
  }

  // Create the link within a transaction
  const link = await prisma.$transaction(async (tx) => {
    const newLink = await tx.tagLink.create({
      data: {
        tagId,
        entityType,
        entityId,
        createdBy: byUser,
      },
      include: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
            usageCount: true,
          },
        },
      },
    });

    // Increment usage count
    await incrementTagUsage(tagId);

    return newLink;
  });

  // Log the event
  const tripId = await resolveTripIdForEntity(entityType, entityId);
  await logEvent(
    "TagLink",
    link.id,
    EventType.TAG_ADDED,
    byUser,
    {
      tagId: link.tagId,
      tagName: tag.name,
      entityType: link.entityType,
      entityId: link.entityId,
      tripId,
    }
  );

  return link;
}

/**
 * Removes a link between a tag and an entity.
 *
 * @param tagId - Tag ID
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 * @param byUser - Firebase UID of the user removing the link
 */
export async function unlinkTag(
  tagId: string,
  entityType: TagEntityType,
  entityId: string,
  byUser: string
) {
  // Find the link
  const link = await prisma.tagLink.findUnique({
    where: {
      tagId_entityType_entityId: {
        tagId,
        entityType,
        entityId,
      },
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!link) {
    // Already unlinked, return success (idempotent)
    return;
  }

  // Delete the link within a transaction
  await prisma.$transaction(async (tx) => {
    await tx.tagLink.delete({
      where: {
        tagId_entityType_entityId: {
          tagId,
          entityType,
          entityId,
        },
      },
    });

    // Decrement usage count
    await decrementTagUsage(tagId);
  });

  // Log the event
  const tripId = await resolveTripIdForEntity(entityType, entityId);
  await logEvent(
    "TagLink",
    link.id,
    EventType.TAG_REMOVED,
    byUser,
    {
      tagId: link.tagId,
      tagName: link.tag.name,
      entityType: link.entityType,
      entityId: link.entityId,
      tripId,
    }
  );
}

/**
 * Gets a specific tag link.
 *
 * @param tagId - Tag ID
 * @param entityType - Type of entity
 * @param entityId - ID of the entity
 * @returns TagLink object or null
 */
export async function getTagLink(
  tagId: string,
  entityType: TagEntityType,
  entityId: string
) {
  return prisma.tagLink.findUnique({
    where: {
      tagId_entityType_entityId: {
        tagId,
        entityType,
        entityId,
      },
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          usageCount: true,
        },
      },
    },
  });
}
