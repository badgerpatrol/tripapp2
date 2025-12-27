import { prisma } from "@/lib/prisma";
import { ListType, EventType } from "@/lib/generated/prisma";
import { logEvent } from "@/server/eventLog";
import { requireTripMember } from "@/server/authz";
import { getHandler } from "./listHandlers/registry";
import { canViewTemplate, canEditTemplate } from "@/types/schemas";
import type {
  ListTemplateCreateInput,
  ListTemplateUpdateInput,
  PublishTemplateInput,
  ForkTemplateInput,
  CopyToTripInput,
  CreateAdHocListInput,
  BrowsePublicTemplatesQuery,
  ListTripInstancesQuery,
} from "@/types/schemas";

// ============================================================================
// Template Management
// ============================================================================

/**
 * Create a new list template
 */
export async function createTemplate(
  ownerId: string,
  payload: ListTemplateCreateInput
) {
  const template = await prisma.listTemplate.create({
    data: {
      ownerId,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      visibility: payload.visibility ?? "PRIVATE",
      tags: payload.tags ?? [],
      isTripTemplate: payload.isTripTemplate ?? false,
      inventory: payload.inventory ?? false,
    },
  });

  // Add items based on type
  if (payload.type === "TODO" && payload.todoItems) {
    await prisma.todoItemTemplate.createMany({
      data: payload.todoItems.map((item, idx) => ({
        templateId: template.id,
        label: item.label,
        notes: item.notes,
        actionType: item.actionType,
        actionData: item.actionData,
        parameters: item.parameters,
        orderIndex: item.orderIndex ?? idx,
      })),
    });
  } else if (payload.type === "KIT" && payload.kitItems) {
    await prisma.kitItemTemplate.createMany({
      data: payload.kitItems.map((item, idx) => ({
        templateId: template.id,
        label: item.label,
        notes: item.notes,
        quantity: item.quantity ?? 1,
        perPerson: item.perPerson ?? false,
        required: item.required ?? true,
        weightGrams: item.weightGrams,
        category: item.category,
        cost: item.cost,
        url: item.url,
        orderIndex: item.orderIndex ?? idx,
        // Inventory fields
        date: item.date,
        needsRepair: item.needsRepair ?? false,
        conditionNotes: item.conditionNotes,
        lost: item.lost ?? false,
        lastSeenText: item.lastSeenText,
        lastSeenDate: item.lastSeenDate,
      })),
    });
  }

  await logEvent(
    "ListTemplate",
    template.id,
    EventType.LIST_TEMPLATE_CREATED,
    ownerId,
    { type: payload.type, title: payload.title }
  );

  return template;
}

export interface ListMyTemplatesQuery {
  createdInTrip?: boolean; // Filter by createdInTrip flag (true = only trip-created, false = only directly created, undefined = all)
}

/**
 * List my templates (private + my public), excluding inventory lists and trip copies
 */
export async function listMyTemplates(ownerId: string, query?: ListMyTemplatesQuery) {
  const where: any = {
    ownerId,
    inventory: false,
    tripId: null, // Exclude trip-specific copies
  };

  // Apply createdInTrip filter if specified
  if (query?.createdInTrip !== undefined) {
    where.createdInTrip = query.createdInTrip;
  }

  const templates = await prisma.listTemplate.findMany({
    where,
    include: {
      todoItems: true,
      kitItems: true,
      owner: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // For templates created in trips, find the associated trip name
  // Trip copies reference the master template via sourceTemplateId
  const createdInTripTemplateIds = templates
    .filter((t) => t.createdInTrip)
    .map((t) => t.id);

  if (createdInTripTemplateIds.length > 0) {
    // Find trip copies that reference these templates
    const tripCopies = await prisma.listTemplate.findMany({
      where: {
        sourceTemplateId: { in: createdInTripTemplateIds },
        tripId: { not: null },
      },
      select: {
        sourceTemplateId: true,
        tripId: true,
      },
    });

    // Get unique trip IDs
    const tripIds = [...new Set(tripCopies.map((c) => c.tripId).filter((id): id is string => id !== null))];

    // Fetch trip names
    const trips = tripIds.length > 0
      ? await prisma.trip.findMany({
          where: { id: { in: tripIds } },
          select: { id: true, name: true },
        })
      : [];

    const tripMap = new Map(trips.map((t) => [t.id, t.name]));

    // Map sourceTemplateId to trip name (use first trip if multiple)
    const templateToTripName = new Map<string, string>();
    for (const copy of tripCopies) {
      if (copy.sourceTemplateId && copy.tripId && !templateToTripName.has(copy.sourceTemplateId)) {
        const tripName = tripMap.get(copy.tripId);
        if (tripName) {
          templateToTripName.set(copy.sourceTemplateId, tripName);
        }
      }
    }

    // Add tripName to templates
    return templates.map((t) => ({
      ...t,
      createdInTripName: t.createdInTrip ? templateToTripName.get(t.id) ?? null : null,
    }));
  }

  // No createdInTrip templates, return as-is with null tripName
  return templates.map((t) => ({
    ...t,
    createdInTripName: null,
  }));
}

/**
 * Get all templates in the system (admin only).
 * Used when admin mode is enabled.
 */
export async function getAllTemplates() {
  const templates = await prisma.listTemplate.findMany({
    where: {
      tripId: null, // Exclude trip-specific copies
    },
    include: {
      todoItems: true,
      kitItems: true,
      owner: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return templates;
}

/**
 * Browse public templates (gallery), excluding inventory lists and trip copies
 */
export async function browsePublicTemplates(query: BrowsePublicTemplatesQuery) {
  const where: any = {
    visibility: "PUBLIC",
    inventory: false,
    tripId: null, // Exclude trip-specific copies
  };

  if (query.type) {
    where.type = query.type;
  }

  if (query.query) {
    where.OR = [
      { title: { contains: query.query, mode: "insensitive" } },
      { description: { contains: query.query, mode: "insensitive" } },
    ];
  }

  if (query.tags && query.tags.length > 0) {
    where.tags = { hasSome: query.tags };
  }

  const templates = await prisma.listTemplate.findMany({
    where,
    include: {
      todoItems: true,
      kitItems: true,
      owner: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  return templates;
}

/**
 * Browse trip templates (templates with "Tripplan" tag)
 * Note: Returns templates regardless of visibility if they have the Tripplan tag
 */
export async function browseTripTemplates() {
  const templates = await prisma.listTemplate.findMany({
    where: {
      tags: {
        has: "Tripplan",
      },
      tripId: null, // Exclude trip-specific copies
    },
    include: {
      todoItems: {
        orderBy: { orderIndex: "asc" },
      },
      kitItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return templates;
}

/**
 * Get a single template by ID
 */
export async function getTemplate(actorId: string, templateId: string) {
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
    include: {
      todoItems: {
        orderBy: { orderIndex: "asc" },
      },
      kitItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!canViewTemplate(actorId, template)) {
    throw new Error("Forbidden: Cannot view this template");
  }

  return template;
}

/**
 * Update a template (owner only)
 */
export async function updateTemplate(
  actorId: string,
  templateId: string,
  payload: ListTemplateUpdateInput
) {
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!canEditTemplate(actorId, template)) {
    throw new Error("Forbidden: Cannot edit this template");
  }

  // Use a transaction to update template and items atomically
  const updated = await prisma.$transaction(async (tx) => {
    // Update the template metadata
    const updatedTemplate = await tx.listTemplate.update({
      where: { id: templateId },
      data: {
        title: payload.title,
        description: payload.description,
        visibility: payload.visibility,
        tags: payload.tags,
        isTripTemplate: payload.isTripTemplate,
        inventory: payload.inventory,
      },
    });

    // If items are provided, replace all items
    if (payload.todoItems && template.type === "TODO") {
      // Delete all existing items
      await tx.todoItemTemplate.deleteMany({
        where: { templateId },
      });

      // Create new items
      if (payload.todoItems.length > 0) {
        await tx.todoItemTemplate.createMany({
          data: payload.todoItems.map((item, idx) => ({
            templateId,
            label: item.label,
            notes: item.notes,
            perPerson: item.perPerson ?? false,
            actionType: item.actionType,
            actionData: item.actionData as any,
            parameters: item.parameters as any,
            orderIndex: item.orderIndex ?? idx,
          })),
        });
      }
    } else if (payload.kitItems && template.type === "KIT") {
      // Delete all existing items
      await tx.kitItemTemplate.deleteMany({
        where: { templateId },
      });

      // Create new items
      if (payload.kitItems.length > 0) {
        await tx.kitItemTemplate.createMany({
          data: payload.kitItems.map((item, idx) => ({
            templateId,
            label: item.label,
            notes: item.notes,
            quantity: item.quantity ?? 1,
            perPerson: item.perPerson ?? false,
            required: item.required ?? true,
            weightGrams: item.weightGrams,
            category: item.category,
            cost: item.cost,
            url: item.url,
            orderIndex: item.orderIndex ?? idx,
            // Inventory fields
            date: item.date,
            needsRepair: item.needsRepair ?? false,
            conditionNotes: item.conditionNotes,
            lost: item.lost ?? false,
            lastSeenText: item.lastSeenText,
            lastSeenDate: item.lastSeenDate,
          })),
        });
      }
    }

    return updatedTemplate;
  });

  await logEvent(
    "ListTemplate",
    templateId,
    EventType.LIST_TEMPLATE_UPDATED,
    actorId
  );

  return updated;
}

/**
 * Publish or unpublish a template
 */
export async function publishTemplate(
  actorId: string,
  templateId: string,
  payload: PublishTemplateInput
) {
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!canEditTemplate(actorId, template)) {
    throw new Error("Forbidden: Cannot edit this template");
  }

  const updated = await prisma.listTemplate.update({
    where: { id: templateId },
    data: {
      visibility: payload.visibility,
      tags: payload.tags ?? template.tags,
      publishedAt:
        payload.visibility === "PUBLIC" ? new Date() : template.publishedAt,
    },
  });

  await logEvent(
    "ListTemplate",
    templateId,
    payload.visibility === "PUBLIC"
      ? EventType.LIST_TEMPLATE_PUBLISHED
      : EventType.LIST_TEMPLATE_UNPUBLISHED,
    actorId
  );

  return updated;
}

/**
 * Fork a public template
 */
export async function forkPublicTemplate(
  actorId: string,
  templateId: string,
  payload: ForkTemplateInput
) {
  const sourceTemplate = await prisma.listTemplate.findUnique({
    where: { id: templateId },
    include: {
      todoItems: true,
      kitItems: true,
    },
  });

  if (!sourceTemplate) {
    throw new Error("Template not found");
  }

  if (!canViewTemplate(actorId, sourceTemplate)) {
    throw new Error("Forbidden: Cannot view this template");
  }

  // Create the forked template
  const forkedTemplate = await prisma.listTemplate.create({
    data: {
      ownerId: actorId,
      title: payload.newTitle ?? `${sourceTemplate.title} (Copy)`,
      description: sourceTemplate.description,
      type: sourceTemplate.type,
      visibility: "PRIVATE",
      forkedFromTemplateId: templateId,
      tags: [],
    },
  });

  // Copy items based on type
  if (sourceTemplate.type === "TODO") {
    await prisma.todoItemTemplate.createMany({
      data: sourceTemplate.todoItems.map((item) => ({
        templateId: forkedTemplate.id,
        label: item.label,
        notes: item.notes,
        actionType: item.actionType,
        actionData: item.actionData as any,
        orderIndex: item.orderIndex,
      })),
    });
  } else if (sourceTemplate.type === "KIT") {
    await prisma.kitItemTemplate.createMany({
      data: sourceTemplate.kitItems.map((item) => ({
        templateId: forkedTemplate.id,
        label: item.label,
        notes: item.notes,
        quantity: item.quantity,
        perPerson: item.perPerson,
        required: item.required,
        weightGrams: item.weightGrams,
        category: item.category,
        cost: item.cost,
        url: item.url,
        orderIndex: item.orderIndex,
      })),
    });
  }

  await logEvent(
    "ListTemplate",
    forkedTemplate.id,
    EventType.LIST_TEMPLATE_FORKED,
    actorId,
    { sourceTemplateId: templateId }
  );

  return forkedTemplate;
}

/**
 * Delete a template (owner only)
 */
export async function deleteTemplate(actorId: string, templateId: string) {
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!canEditTemplate(actorId, template)) {
    throw new Error("Forbidden: Cannot delete this template");
  }

  await prisma.listTemplate.delete({
    where: { id: templateId },
  });

  await logEvent(
    "ListTemplate",
    templateId,
    EventType.LIST_TEMPLATE_DELETED,
    actorId
  );
}

/**
 * Update a single kit item in a template
 */
export async function updateKitItem(
  actorId: string,
  templateId: string,
  itemId: string,
  payload: import("@/types/schemas").KitItemUpdateInput
) {
  // Verify template exists and user has permission
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!canEditTemplate(actorId, template)) {
    throw new Error("Forbidden: Cannot edit this template");
  }

  // Verify item exists and belongs to this template
  const item = await prisma.kitItemTemplate.findUnique({
    where: { id: itemId },
  });

  if (!item || item.templateId !== templateId) {
    throw new Error("Item not found");
  }

  // Build the update data object
  const updateData: Record<string, any> = {};

  if (payload.label !== undefined) updateData.label = payload.label;
  if (payload.notes !== undefined) updateData.notes = payload.notes || null;
  if (payload.quantity !== undefined) updateData.quantity = payload.quantity;
  if (payload.perPerson !== undefined) updateData.perPerson = payload.perPerson;
  if (payload.required !== undefined) updateData.required = payload.required;
  if (payload.weightGrams !== undefined) updateData.weightGrams = payload.weightGrams || null;
  if (payload.category !== undefined) updateData.category = payload.category || null;
  if (payload.cost !== undefined) updateData.cost = payload.cost ?? null;
  if (payload.url !== undefined) updateData.url = payload.url || null;
  if (payload.orderIndex !== undefined) updateData.orderIndex = payload.orderIndex;
  if (payload.date !== undefined) updateData.date = payload.date;
  if (payload.needsRepair !== undefined) updateData.needsRepair = payload.needsRepair;
  if (payload.conditionNotes !== undefined) updateData.conditionNotes = payload.conditionNotes || null;
  if (payload.lost !== undefined) updateData.lost = payload.lost;
  if (payload.lastSeenText !== undefined) updateData.lastSeenText = payload.lastSeenText || null;
  if (payload.lastSeenDate !== undefined) updateData.lastSeenDate = payload.lastSeenDate;

  // Update the item
  const updatedItem = await prisma.kitItemTemplate.update({
    where: { id: itemId },
    data: updateData,
  });

  return updatedItem;
}

/**
 * Update a single todo item in a template
 */
export async function updateTodoItem(
  actorId: string,
  templateId: string,
  itemId: string,
  payload: import("@/types/schemas").TodoItemUpdateInput
) {
  // Verify template exists and user has permission
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (!canEditTemplate(actorId, template)) {
    throw new Error("Forbidden: Cannot edit this template");
  }

  // Verify item exists and belongs to this template
  const item = await prisma.todoItemTemplate.findUnique({
    where: { id: itemId },
  });

  if (!item || item.templateId !== templateId) {
    throw new Error("Item not found");
  }

  // Build the update data object
  const updateData: Record<string, unknown> = {};

  if (payload.label !== undefined) updateData.label = payload.label;
  if (payload.notes !== undefined) updateData.notes = payload.notes || null;
  if (payload.perPerson !== undefined) updateData.perPerson = payload.perPerson;
  if (payload.orderIndex !== undefined) updateData.orderIndex = payload.orderIndex;

  // Update the item
  const updatedItem = await prisma.todoItemTemplate.update({
    where: { id: itemId },
    data: updateData,
  });

  return updatedItem;
}

// ============================================================================
// Trip List Management (Lists added to trips)
// ============================================================================

/**
 * Copy a template to a trip
 * Creates a new ListTemplate with tripId set, copying all items
 * Handles REPLACE, MERGE, and NEW_INSTANCE modes
 */
export async function copyTemplateToTrip(
  actorId: string,
  templateId: string,
  payload: CopyToTripInput
) {
  const { tripId, mode } = payload;

  // Verify trip membership
  await requireTripMember(actorId, tripId);

  // Get the template
  const template = await getTemplate(actorId, templateId);

  // Check if a list with the same title and type exists in this trip
  const existingTripList = await prisma.listTemplate.findFirst({
    where: {
      tripId,
      type: template.type,
      title: template.title,
    },
  });

  let tripList: any;

  if (existingTripList && mode === "REPLACE") {
    // Delete the existing trip list
    await prisma.listTemplate.delete({
      where: { id: existingTripList.id },
    });

    await logEvent(
      "ListTemplate",
      existingTripList.id,
      EventType.LIST_INSTANCE_REPLACED,
      actorId,
      { templateId }
    );

    // Create a fresh trip list
    tripList = await createTripListFromTemplate(
      actorId,
      tripId,
      templateId,
      template
    );
  } else if (
    existingTripList &&
    (mode === "MERGE_ADD" || mode === "MERGE_ADD_ALLOW_DUPES")
  ) {
    // Merge into existing trip list
    const handler = getHandler(template.type);
    const result = await handler.mergeTemplateItems({
      prisma,
      sourceTemplateId: templateId,
      targetTemplateId: existingTripList.id,
      mode,
    });

    await logEvent(
      "ListTemplate",
      existingTripList.id,
      EventType.LIST_INSTANCE_MERGED,
      actorId,
      { templateId, added: result.added, skipped: result.skipped }
    );

    tripList = existingTripList;
  } else {
    // Create new trip list (possibly with suffix if title collision)
    let title = template.title;
    if (existingTripList && mode === "NEW_INSTANCE") {
      // Find a unique title by adding (2), (3), etc.
      let counter = 2;
      while (
        await prisma.listTemplate.findFirst({
          where: { tripId, type: template.type, title },
        })
      ) {
        title = `${template.title} (${counter})`;
        counter++;
      }
    }

    tripList = await createTripListFromTemplate(
      actorId,
      tripId,
      templateId,
      template,
      title
    );
  }

  return tripList;
}

/**
 * Helper: Create a new trip list from a template
 */
async function createTripListFromTemplate(
  actorId: string,
  tripId: string,
  sourceTemplateId: string,
  template: any,
  title?: string
) {
  // Create the trip-specific list (a ListTemplate with tripId set)
  const tripList = await prisma.listTemplate.create({
    data: {
      ownerId: template.ownerId, // Keep original owner
      tripId,
      type: template.type,
      sourceTemplateId,
      sourceTemplateUpdatedAt: template.updatedAt,
      title: title ?? template.title,
      description: template.description,
      visibility: "PRIVATE", // Trip lists are always private
      createdBy: actorId,
    },
  });

  // Use handler to copy items
  const handler = getHandler(template.type);
  await handler.copyTemplateItems({
    prisma,
    sourceTemplateId,
    targetTemplateId: tripList.id,
  });

  await logEvent(
    "ListTemplate",
    tripList.id,
    EventType.LIST_INSTANCE_CREATED,
    actorId,
    { tripId, type: template.type, sourceTemplateId }
  );

  return tripList;
}

/**
 * Create an ad-hoc list in a trip (without a source template)
 * Also creates a master template in the user's list collection with createdInTrip=true
 */
export async function createTripListAdHoc(
  actorId: string,
  payload: CreateAdHocListInput
) {
  const { tripId, type, title, description, inventory, todoItems, kitItems } = payload;

  // Verify trip membership
  await requireTripMember(actorId, tripId);

  // Use a transaction to create both the master template and the trip list
  const result = await prisma.$transaction(async (tx) => {
    // First, create the master template (user's reusable list)
    const masterTemplate = await tx.listTemplate.create({
      data: {
        ownerId: actorId,
        type,
        title,
        description,
        inventory: inventory ?? false,
        visibility: "PRIVATE",
        createdInTrip: true, // Mark as created in a trip
      },
    });

    // Add items to master template based on type
    if (type === "TODO" && todoItems) {
      await tx.todoItemTemplate.createMany({
        data: todoItems.map((item, idx) => ({
          templateId: masterTemplate.id,
          label: item.label,
          notes: item.notes,
          perPerson: item.perPerson ?? false,
          actionType: item.actionType,
          actionData: item.actionData,
          parameters: item.parameters,
          orderIndex: item.orderIndex ?? idx,
        })),
      });
    } else if (type === "KIT" && kitItems) {
      await tx.kitItemTemplate.createMany({
        data: kitItems.map((item, idx) => ({
          templateId: masterTemplate.id,
          label: item.label,
          notes: item.notes,
          quantity: item.quantity ?? 1,
          perPerson: item.perPerson ?? false,
          required: item.required ?? true,
          weightGrams: item.weightGrams,
          category: item.category,
          cost: item.cost,
          url: item.url,
          orderIndex: item.orderIndex ?? idx,
          // Inventory fields
          date: item.date,
          needsRepair: item.needsRepair ?? false,
          conditionNotes: item.conditionNotes,
          lost: item.lost ?? false,
          lastSeenText: item.lastSeenText,
          lastSeenDate: item.lastSeenDate,
        })),
      });
    }

    // Now create the trip-specific list that references the master template
    const tripList = await tx.listTemplate.create({
      data: {
        ownerId: actorId,
        tripId,
        type,
        title,
        description,
        inventory: inventory ?? false,
        visibility: "PRIVATE",
        createdBy: actorId,
        createdInTrip: true,
        sourceTemplateId: masterTemplate.id, // Link to the master template
        sourceTemplateUpdatedAt: masterTemplate.updatedAt,
      },
    });

    // Copy items to trip list
    if (type === "TODO" && todoItems) {
      await tx.todoItemTemplate.createMany({
        data: todoItems.map((item, idx) => ({
          templateId: tripList.id,
          label: item.label,
          notes: item.notes,
          perPerson: item.perPerson ?? false,
          actionType: item.actionType,
          actionData: item.actionData,
          parameters: item.parameters,
          orderIndex: item.orderIndex ?? idx,
        })),
      });
    } else if (type === "KIT" && kitItems) {
      await tx.kitItemTemplate.createMany({
        data: kitItems.map((item, idx) => ({
          templateId: tripList.id,
          label: item.label,
          notes: item.notes,
          quantity: item.quantity ?? 1,
          perPerson: item.perPerson ?? false,
          required: item.required ?? true,
          weightGrams: item.weightGrams,
          category: item.category,
          cost: item.cost,
          url: item.url,
          orderIndex: item.orderIndex ?? idx,
          // Inventory fields
          date: item.date,
          needsRepair: item.needsRepair ?? false,
          conditionNotes: item.conditionNotes,
          lost: item.lost ?? false,
          lastSeenText: item.lastSeenText,
          lastSeenDate: item.lastSeenDate,
        })),
      });
    }

    return { masterTemplate, tripList };
  });

  await logEvent(
    "ListTemplate",
    result.masterTemplate.id,
    EventType.LIST_TEMPLATE_CREATED,
    actorId,
    { type, title, createdInTrip: true }
  );

  await logEvent(
    "ListTemplate",
    result.tripList.id,
    EventType.LIST_INSTANCE_CREATED,
    actorId,
    { tripId, type, adHoc: true, masterTemplateId: result.masterTemplate.id }
  );

  return result.tripList;
}

/**
 * List all lists for a trip (ListTemplates with tripId set)
 */
export async function listTripLists(
  actorId: string,
  tripId: string,
  query: ListTripInstancesQuery
) {
  // Verify trip membership
  await requireTripMember(actorId, tripId);

  const where: any = { tripId };

  if (query.type) {
    where.type = query.type;
  }

  const tripLists = await prisma.listTemplate.findMany({
    where,
    include: {
      todoItems: {
        orderBy: { orderIndex: "asc" },
        include: {
          ticks: {
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
      },
      kitItems: {
        orderBy: { orderIndex: "asc" },
        include: {
          ticks: {
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
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch source templates for trip lists that have one
  const templateIds = tripLists
    .map((l) => l.sourceTemplateId)
    .filter((id): id is string => id !== null);

  const templates = templateIds.length > 0
    ? await prisma.listTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, updatedAt: true },
      })
    : [];

  const templateMap = new Map(templates.map((t) => [t.id, t]));

  // Add hasTemplateUpdated flag to each trip list
  const listsWithUpdateFlag = tripLists.map((list) => {
    let hasTemplateUpdated = false;

    if (list.sourceTemplateId && list.sourceTemplateUpdatedAt) {
      const sourceTemplate = templateMap.get(list.sourceTemplateId);
      if (sourceTemplate) {
        // Compare timestamps - template has been updated if its updatedAt is newer
        hasTemplateUpdated = sourceTemplate.updatedAt > list.sourceTemplateUpdatedAt;
      }
    }

    return {
      ...list,
      hasTemplateUpdated,
    };
  });

  // Filter by completion status if specified
  if (query.completionStatus && query.completionStatus !== "all") {
    return listsWithUpdateFlag.filter((list) => {
      const items = list.type === "TODO" ? list.todoItems : list.kitItems;

      // If no items, consider it as "done"
      if (items.length === 0) {
        return query.completionStatus === "done";
      }

      // Check if all items are completed (have at least one tick)
      const allCompleted = items.every((item) => item.ticks && item.ticks.length > 0);

      // Return based on filter
      if (query.completionStatus === "done") {
        return allCompleted;
      } else { // "open"
        return !allCompleted;
      }
    });
  }

  return listsWithUpdateFlag;
}

/**
 * Get a single trip list by ID
 */
export async function getTripList(actorId: string, listId: string) {
  const tripList = await prisma.listTemplate.findUnique({
    where: { id: listId },
    include: {
      todoItems: {
        orderBy: { orderIndex: "asc" },
      },
      kitItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tripList) {
    throw new Error("List not found");
  }

  // Only trip lists have tripId set
  if (!tripList.tripId) {
    throw new Error("This is not a trip list");
  }

  // Verify trip membership
  await requireTripMember(actorId, tripList.tripId);

  return tripList;
}

/**
 * Delete a trip list
 */
export async function deleteTripList(actorId: string, listId: string) {
  const tripList = await prisma.listTemplate.findUnique({
    where: { id: listId },
  });

  if (!tripList) {
    throw new Error("List not found");
  }

  // Only trip lists have tripId set
  if (!tripList.tripId) {
    throw new Error("This is not a trip list");
  }

  // Verify trip membership
  await requireTripMember(actorId, tripList.tripId);

  await prisma.listTemplate.delete({
    where: { id: listId },
  });

  await logEvent(
    "ListTemplate",
    listId,
    EventType.LIST_INSTANCE_DELETED,
    actorId,
    { tripId: tripList.tripId }
  );
}

// ============================================================================
// Item Operations
// ============================================================================

/**
 * Toggle the state of an item (done/packed)
 */
export async function toggleItemState(
  actorId: string,
  type: ListType,
  itemId: string,
  state: boolean
) {
  // Get the template to verify trip membership
  let template: any;

  if (type === "TODO") {
    const item = await prisma.todoItemTemplate.findUnique({
      where: { id: itemId },
      include: { template: true },
    });
    if (!item) throw new Error("Item not found");
    template = item.template;
  } else if (type === "KIT") {
    const item = await prisma.kitItemTemplate.findUnique({
      where: { id: itemId },
      include: { template: true },
    });
    if (!item) throw new Error("Item not found");
    template = item.template;
  }

  if (!template) {
    throw new Error("Item not found");
  }

  // Only allow toggling on trip lists
  if (!template.tripId) {
    throw new Error("Can only toggle items on trip lists");
  }

  // Verify trip membership
  await requireTripMember(actorId, template.tripId);

  // Use handler to toggle
  const handler = getHandler(type);
  await handler.toggleItemState({
    prisma,
    itemId,
    state,
    actorId,
  });

  await logEvent(
    "ListItem",
    itemId,
    EventType.LIST_ITEM_TOGGLED,
    actorId,
    { listId: template.id, type, state }
  );
}

/**
 * Launch an action associated with a TODO item
 */
export async function launchItemAction(
  actorId: string,
  itemId: string
) {
  const item = await prisma.todoItemTemplate.findUnique({
    where: { id: itemId },
    include: { template: true },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  // Only allow launching on trip lists
  if (!item.template.tripId) {
    throw new Error("Can only launch actions on trip lists");
  }

  // Verify trip membership
  await requireTripMember(actorId, item.template.tripId);

  const handler = getHandler("TODO");
  if (!handler.launchItemAction) {
    throw new Error("This handler does not support actions");
  }

  const deepLink = await handler.launchItemAction({
    prisma,
    itemId,
    tripId: item.template.tripId,
  });

  await logEvent(
    "ListItem",
    itemId,
    EventType.LIST_ITEM_ACTION_LAUNCHED,
    actorId,
    { tripId: item.template.tripId, deepLink }
  );

  return deepLink;
}

/**
 * Add a single todo item to a template/trip list
 */
export async function addTodoItem(
  actorId: string,
  templateId: string,
  payload: { label: string; notes?: string; orderIndex?: number; perPerson?: boolean }
) {
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  // For trip lists, verify trip membership
  if (template.tripId) {
    await requireTripMember(actorId, template.tripId);
  } else {
    // For regular templates, verify ownership
    if (!canEditTemplate(actorId, template)) {
      throw new Error("Forbidden: Cannot edit this template");
    }
  }

  // Determine orderIndex
  let orderIndex = payload.orderIndex;
  if (orderIndex === undefined) {
    // Add to end if not specified
    const maxItem = await prisma.todoItemTemplate.findFirst({
      where: { templateId },
      orderBy: { orderIndex: "desc" },
    });
    orderIndex = maxItem ? maxItem.orderIndex + 1 : 0;
  } else {
    // Shift existing items down to make room at the specified position
    await prisma.todoItemTemplate.updateMany({
      where: {
        templateId,
        orderIndex: { gte: orderIndex },
      },
      data: {
        orderIndex: { increment: 1 },
      },
    });
  }

  const item = await prisma.todoItemTemplate.create({
    data: {
      templateId,
      label: payload.label,
      notes: payload.notes || null,
      orderIndex,
      perPerson: payload.perPerson ?? false,
    },
  });

  return item;
}

/**
 * Add a single kit item to a template/trip list
 */
export async function addKitItem(
  actorId: string,
  templateId: string,
  payload: { label: string; notes?: string; quantity?: number; orderIndex?: number; perPerson?: boolean; required?: boolean }
) {
  const template = await prisma.listTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  // For trip lists, verify trip membership
  if (template.tripId) {
    await requireTripMember(actorId, template.tripId);
  } else {
    // For regular templates, verify ownership
    if (!canEditTemplate(actorId, template)) {
      throw new Error("Forbidden: Cannot edit this template");
    }
  }

  // Determine orderIndex
  let orderIndex = payload.orderIndex;
  if (orderIndex === undefined) {
    // Add to end if not specified
    const maxItem = await prisma.kitItemTemplate.findFirst({
      where: { templateId },
      orderBy: { orderIndex: "desc" },
    });
    orderIndex = maxItem ? maxItem.orderIndex + 1 : 0;
  } else {
    // Shift existing items down to make room at the specified position
    await prisma.kitItemTemplate.updateMany({
      where: {
        templateId,
        orderIndex: { gte: orderIndex },
      },
      data: {
        orderIndex: { increment: 1 },
      },
    });
  }

  const item = await prisma.kitItemTemplate.create({
    data: {
      templateId,
      label: payload.label,
      notes: payload.notes || null,
      quantity: payload.quantity ?? 1,
      orderIndex,
      perPerson: payload.perPerson ?? false,
      required: payload.required ?? true,
    },
  });

  return item;
}

/**
 * Delete a kit item from a trip list
 * For per-person items: Only deletes the current user's tick
 * For shared items: Only works if no one has ticked it
 */
export async function deleteKitItem(actorId: string, itemId: string) {
  const item = await prisma.kitItemTemplate.findUnique({
    where: { id: itemId },
    include: {
      template: true,
      ticks: true,
    },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  // Only allow deleting items on trip lists
  if (!item.template.tripId) {
    throw new Error("Forbidden: Can only delete items from trip lists");
  }

  // Verify trip membership
  await requireTripMember(actorId, item.template.tripId);

  if (item.perPerson) {
    // For per-person items, just delete the user's tick
    await prisma.itemTick.deleteMany({
      where: {
        kitItemId: itemId,
        userId: actorId,
      },
    });

    return { deleted: "tick" };
  } else {
    // For shared items, can only delete if no one has ticked it
    if (item.ticks && item.ticks.length > 0) {
      throw new Error("Cannot delete shared item that has been ticked");
    }

    await prisma.kitItemTemplate.delete({
      where: { id: itemId },
    });

    await logEvent(
      "ListItem",
      itemId,
      EventType.LIST_ITEM_REMOVED,
      actorId,
      { listId: item.template.id, type: "KIT" }
    );

    return { deleted: "item" };
  }
}
