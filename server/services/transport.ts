/**
 * Transport Service
 * Handles business logic for lift-share / transport coordination
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";

// ============================================================================
// Types
// ============================================================================

export interface CreateTransportOfferData {
  fromLocation: string;
  toLocation: string;
  departureTime?: Date;
  maxPeople?: number;
  maxGearDescription?: string;
  notes?: string;
}

export interface UpdateTransportOfferData {
  fromLocation?: string;
  toLocation?: string;
  departureTime?: Date | null;
  maxPeople?: number | null;
  maxGearDescription?: string | null;
  notes?: string | null;
}

export interface CreateTransportRequirementData {
  fromLocation: string;
  toLocation: string;
  earliestTime?: Date;
  latestTime?: Date;
  peopleCount?: number;
  gearDescription?: string;
  notes?: string;
}

export interface UpdateTransportRequirementData {
  fromLocation?: string;
  toLocation?: string;
  earliestTime?: Date | null;
  latestTime?: Date | null;
  peopleCount?: number;
  gearDescription?: string | null;
  notes?: string | null;
}

// ============================================================================
// Transport Offer Management
// ============================================================================

const userSelect = {
  id: true,
  displayName: true,
  photoURL: true,
};

/**
 * Create a transport offer
 */
export async function createTransportOffer(
  userId: string,
  tripId: string,
  data: CreateTransportOfferData
) {
  const offer = await prisma.transportOffer.create({
    data: {
      tripId,
      createdById: userId,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      departureTime: data.departureTime,
      maxPeople: data.maxPeople,
      maxGearDescription: data.maxGearDescription,
      notes: data.notes,
    },
    include: {
      createdBy: {
        select: userSelect,
      },
    },
  });

  return offer;
}

/**
 * Update a transport offer
 */
export async function updateTransportOffer(
  offerId: string,
  userId: string,
  data: UpdateTransportOfferData
) {
  // Check ownership
  const existing = await prisma.transportOffer.findUnique({
    where: { id: offerId },
  });

  if (!existing) {
    throw new Error("Transport offer not found");
  }

  if (existing.createdById !== userId) {
    throw new Error("You can only edit your own transport offers");
  }

  const updateData: Prisma.TransportOfferUpdateInput = {};
  if (data.fromLocation !== undefined) updateData.fromLocation = data.fromLocation;
  if (data.toLocation !== undefined) updateData.toLocation = data.toLocation;
  if (data.departureTime !== undefined) updateData.departureTime = data.departureTime;
  if (data.maxPeople !== undefined) updateData.maxPeople = data.maxPeople;
  if (data.maxGearDescription !== undefined) updateData.maxGearDescription = data.maxGearDescription;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const updated = await prisma.transportOffer.update({
    where: { id: offerId },
    data: updateData,
    include: {
      createdBy: {
        select: userSelect,
      },
    },
  });

  return updated;
}

/**
 * Delete a transport offer
 */
export async function deleteTransportOffer(offerId: string, userId: string) {
  const existing = await prisma.transportOffer.findUnique({
    where: { id: offerId },
  });

  if (!existing) {
    throw new Error("Transport offer not found");
  }

  if (existing.createdById !== userId) {
    throw new Error("You can only delete your own transport offers");
  }

  await prisma.transportOffer.delete({
    where: { id: offerId },
  });

  return { success: true };
}

/**
 * Get all transport offers for a trip
 */
export async function getTripTransportOffers(tripId: string) {
  const offers = await prisma.transportOffer.findMany({
    where: { tripId },
    include: {
      createdBy: {
        select: userSelect,
      },
    },
    orderBy: [
      { departureTime: "asc" },
      { createdAt: "desc" },
    ],
  });

  return offers;
}

/**
 * Get a single transport offer
 */
export async function getTransportOffer(offerId: string) {
  const offer = await prisma.transportOffer.findUnique({
    where: { id: offerId },
    include: {
      createdBy: {
        select: userSelect,
      },
    },
  });

  if (!offer) {
    throw new Error("Transport offer not found");
  }

  return offer;
}

// ============================================================================
// Transport Requirement Management
// ============================================================================

/**
 * Create a transport requirement
 */
export async function createTransportRequirement(
  userId: string,
  tripId: string,
  data: CreateTransportRequirementData
) {
  const requirement = await prisma.transportRequirement.create({
    data: {
      tripId,
      createdById: userId,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      earliestTime: data.earliestTime,
      latestTime: data.latestTime,
      peopleCount: data.peopleCount ?? 1,
      gearDescription: data.gearDescription,
      notes: data.notes,
    },
    include: {
      createdBy: {
        select: userSelect,
      },
    },
  });

  return requirement;
}

/**
 * Update a transport requirement
 */
export async function updateTransportRequirement(
  requirementId: string,
  userId: string,
  data: UpdateTransportRequirementData
) {
  // Check ownership
  const existing = await prisma.transportRequirement.findUnique({
    where: { id: requirementId },
  });

  if (!existing) {
    throw new Error("Transport requirement not found");
  }

  if (existing.createdById !== userId) {
    throw new Error("You can only edit your own transport requirements");
  }

  const updateData: Prisma.TransportRequirementUpdateInput = {};
  if (data.fromLocation !== undefined) updateData.fromLocation = data.fromLocation;
  if (data.toLocation !== undefined) updateData.toLocation = data.toLocation;
  if (data.earliestTime !== undefined) updateData.earliestTime = data.earliestTime;
  if (data.latestTime !== undefined) updateData.latestTime = data.latestTime;
  if (data.peopleCount !== undefined) updateData.peopleCount = data.peopleCount;
  if (data.gearDescription !== undefined) updateData.gearDescription = data.gearDescription;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const updated = await prisma.transportRequirement.update({
    where: { id: requirementId },
    data: updateData,
    include: {
      createdBy: {
        select: userSelect,
      },
    },
  });

  return updated;
}

/**
 * Delete a transport requirement
 */
export async function deleteTransportRequirement(requirementId: string, userId: string) {
  const existing = await prisma.transportRequirement.findUnique({
    where: { id: requirementId },
  });

  if (!existing) {
    throw new Error("Transport requirement not found");
  }

  if (existing.createdById !== userId) {
    throw new Error("You can only delete your own transport requirements");
  }

  await prisma.transportRequirement.delete({
    where: { id: requirementId },
  });

  return { success: true };
}

/**
 * Get all transport requirements for a trip
 */
export async function getTripTransportRequirements(tripId: string) {
  const requirements = await prisma.transportRequirement.findMany({
    where: { tripId },
    include: {
      createdBy: {
        select: userSelect,
      },
    },
    orderBy: [
      { earliestTime: "asc" },
      { createdAt: "desc" },
    ],
  });

  return requirements;
}

/**
 * Get a single transport requirement
 */
export async function getTransportRequirement(requirementId: string) {
  const requirement = await prisma.transportRequirement.findUnique({
    where: { id: requirementId },
    include: {
      createdBy: {
        select: userSelect,
      },
    },
  });

  if (!requirement) {
    throw new Error("Transport requirement not found");
  }

  return requirement;
}

// ============================================================================
// Combined Transport Data
// ============================================================================

/**
 * Get all transport data for a trip (offers and requirements)
 */
export async function getTripTransport(tripId: string) {
  const [offers, requirements] = await Promise.all([
    getTripTransportOffers(tripId),
    getTripTransportRequirements(tripId),
  ]);

  return {
    offers,
    requirements,
  };
}
