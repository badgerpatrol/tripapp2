import { prisma } from "@/lib/prisma";
import { EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import type { TagCreate } from "@/types/tag";

/**
 * Normalizes a tag name to a slug for uniqueness.
 * Converts to lowercase, replaces spaces and special chars with hyphens,
 * removes consecutive hyphens, and trims.
 *
 * @param name - Tag name to normalize
 * @returns Normalized slug
 */
export function normalizeToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/[\s_]+/g, '-')   // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')       // Replace consecutive hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing hyphens
}

/**
 * Lists all tags in the system.
 *
 * @returns Array of all tags, sorted by usage count (descending) then name
 */
export async function listAllTags() {
  return prisma.tag.findMany({
    orderBy: [
      { usageCount: 'desc' },
      { name: 'asc' },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      usageCount: true,
    },
  });
}

/**
 * Creates a new tag.
 * Returns existing tag if slug already exists (409 conflict handled by caller).
 *
 * @param name - Tag name (display version, preserves case)
 * @param byUser - Firebase UID of the user creating the tag
 * @returns Created tag object
 */
export async function createTag(name: string, byUser: string) {
  const slug = normalizeToSlug(name);

  // Check if tag with this slug already exists
  const existing = await prisma.tag.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      usageCount: true,
    },
  });

  if (existing) {
    // Return existing tag instead of throwing error
    // Caller can determine if this is a 409 or just use the existing tag
    return existing;
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim(),
      slug,
      createdBy: byUser,
      usageCount: 0,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      usageCount: true,
    },
  });

  // Log the event
  await logEvent("Tag", tag.id, EventType.TAG_CREATED, byUser, {
    name: tag.name,
    slug: tag.slug,
  });

  return tag;
}

/**
 * Finds a tag by slug, or creates it if it doesn't exist.
 *
 * @param name - Tag name
 * @param byUser - Firebase UID of the user
 * @returns Tag object
 */
export async function findOrCreateTag(name: string, byUser: string) {
  const slug = normalizeToSlug(name);

  const existing = await prisma.tag.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      usageCount: true,
    },
  });

  if (existing) {
    return existing;
  }

  return createTag(name, byUser);
}

/**
 * Gets a tag by ID.
 *
 * @param tagId - Tag ID
 * @returns Tag object or null
 */
export async function getTagById(tagId: string) {
  return prisma.tag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      name: true,
      slug: true,
      usageCount: true,
    },
  });
}

/**
 * Increments the usage count for a tag.
 * Called when a tag is linked to an entity.
 *
 * @param tagId - Tag ID
 */
export async function incrementTagUsage(tagId: string) {
  await prisma.tag.update({
    where: { id: tagId },
    data: {
      usageCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Decrements the usage count for a tag.
 * Called when a tag is unlinked from an entity.
 *
 * @param tagId - Tag ID
 */
export async function decrementTagUsage(tagId: string) {
  await prisma.tag.update({
    where: { id: tagId },
    data: {
      usageCount: {
        decrement: 1,
      },
    },
  });
}
