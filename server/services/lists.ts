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

/**
 * List my templates (private + my public), excluding inventory lists
 */
export async function listMyTemplates(ownerId: string) {
  const templates = await prisma.listTemplate.findMany({
    where: { ownerId, inventory: false },
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
 * Get all templates in the system (admin only).
 * Used when admin mode is enabled.
 */
export async function getAllTemplates() {
  const templates = await prisma.listTemplate.findMany({
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
 * Browse public templates (gallery), excluding inventory lists
 */
export async function browsePublicTemplates(query: BrowsePublicTemplatesQuery) {
  const where: any = {
    visibility: "PUBLIC",
    inventory: false,
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

// ============================================================================
// Instance Management (Trip Lists)
// ============================================================================

/**
 * Copy a template to a trip
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

  // Check if an instance with the same title and type exists
  const existingInstance = await prisma.listInstance.findFirst({
    where: {
      tripId,
      type: template.type,
      title: template.title,
    },
  });

  let instance: any;

  if (existingInstance && mode === "REPLACE") {
    // Delete the existing instance
    await prisma.listInstance.delete({
      where: { id: existingInstance.id },
    });

    await logEvent(
      "ListInstance",
      existingInstance.id,
      EventType.LIST_INSTANCE_REPLACED,
      actorId,
      { templateId }
    );

    // Create a fresh instance
    instance = await createInstanceFromTemplate(
      actorId,
      tripId,
      templateId,
      template
    );
  } else if (
    existingInstance &&
    (mode === "MERGE_ADD" || mode === "MERGE_ADD_ALLOW_DUPES")
  ) {
    // Merge into existing instance
    const handler = getHandler(template.type);
    const result = await handler.mergeIntoInstance({
      prisma,
      templateId,
      instanceId: existingInstance.id,
      mode,
    });

    await logEvent(
      "ListInstance",
      existingInstance.id,
      EventType.LIST_INSTANCE_MERGED,
      actorId,
      { templateId, added: result.added, skipped: result.skipped }
    );

    instance = existingInstance;
  } else {
    // Create new instance (possibly with suffix if title collision)
    let title = template.title;
    if (existingInstance && mode === "NEW_INSTANCE") {
      // Find a unique title by adding (2), (3), etc.
      let counter = 2;
      while (
        await prisma.listInstance.findFirst({
          where: { tripId, type: template.type, title },
        })
      ) {
        title = `${template.title} (${counter})`;
        counter++;
      }
    }

    instance = await createInstanceFromTemplate(
      actorId,
      tripId,
      templateId,
      template,
      title
    );
  }

  return instance;
}

/**
 * Helper: Create a new list instance from a template
 */
async function createInstanceFromTemplate(
  actorId: string,
  tripId: string,
  templateId: string,
  template: any,
  title?: string
) {
  const instance = await prisma.listInstance.create({
    data: {
      tripId,
      type: template.type,
      sourceTemplateId: templateId,
      sourceTemplateUpdatedAt: template.updatedAt, // Track when template was last updated at copy time
      title: title ?? template.title,
      description: template.description,
      createdBy: actorId,
    },
  });

  // Use handler to copy items
  const handler = getHandler(template.type);
  await handler.copyTemplateItemsToInstance({
    prisma,
    templateId,
    instanceId: instance.id,
  });

  await logEvent(
    "ListInstance",
    instance.id,
    EventType.LIST_INSTANCE_CREATED,
    actorId,
    { tripId, type: template.type, sourceTemplateId: templateId }
  );

  return instance;
}

/**
 * Create an ad-hoc list instance (without a template)
 */
export async function createInstanceAdHoc(
  actorId: string,
  payload: CreateAdHocListInput
) {
  const { tripId, type, title, description, inventory, todoItems, kitItems } = payload;

  // Verify trip membership
  await requireTripMember(actorId, tripId);

  const instance = await prisma.listInstance.create({
    data: {
      tripId,
      type,
      title,
      description,
      inventory: inventory ?? false,
      createdBy: actorId,
    },
  });

  // Add items based on type
  if (type === "TODO" && todoItems) {
    await prisma.todoItemInstance.createMany({
      data: todoItems.map((item, idx) => ({
        listId: instance.id,
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
    await prisma.kitItemInstance.createMany({
      data: kitItems.map((item, idx) => ({
        listId: instance.id,
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
    "ListInstance",
    instance.id,
    EventType.LIST_INSTANCE_CREATED,
    actorId,
    { tripId, type, adHoc: true }
  );

  return instance;
}

/**
 * List all instances for a trip
 */
export async function listTripInstances(
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

  const instances = await prisma.listInstance.findMany({
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

  // Fetch source templates for instances that have one
  const templateIds = instances
    .map((i) => i.sourceTemplateId)
    .filter((id): id is string => id !== null);

  const templates = templateIds.length > 0
    ? await prisma.listTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, updatedAt: true },
      })
    : [];

  const templateMap = new Map(templates.map((t) => [t.id, t]));

  // Add hasTemplateUpdated flag to each instance
  const instancesWithUpdateFlag = instances.map((instance) => {
    let hasTemplateUpdated = false;

    if (instance.sourceTemplateId && instance.sourceTemplateUpdatedAt) {
      const template = templateMap.get(instance.sourceTemplateId);
      if (template) {
        // Compare timestamps - template has been updated if its updatedAt is newer
        hasTemplateUpdated = template.updatedAt > instance.sourceTemplateUpdatedAt;
      }
    }

    return {
      ...instance,
      hasTemplateUpdated,
    };
  });

  // Filter by completion status if specified
  if (query.completionStatus && query.completionStatus !== "all") {
    return instancesWithUpdateFlag.filter((instance) => {
      const items = instance.type === "TODO" ? instance.todoItems : instance.kitItems;

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

  return instancesWithUpdateFlag;
}

/**
 * Get a single instance by ID
 */
export async function getInstance(actorId: string, instanceId: string) {
  const instance = await prisma.listInstance.findUnique({
    where: { id: instanceId },
    include: {
      todoItems: {
        orderBy: { orderIndex: "asc" },
      },
      kitItems: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!instance) {
    throw new Error("List instance not found");
  }

  // Verify trip membership
  await requireTripMember(actorId, instance.tripId);

  return instance;
}

/**
 * Delete a list instance
 */
export async function deleteInstance(actorId: string, instanceId: string) {
  const instance = await prisma.listInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error("List instance not found");
  }

  // Verify trip membership
  await requireTripMember(actorId, instance.tripId);

  await prisma.listInstance.delete({
    where: { id: instanceId },
  });

  await logEvent(
    "ListInstance",
    instanceId,
    EventType.LIST_INSTANCE_DELETED,
    actorId,
    { tripId: instance.tripId }
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
  // Get the instance to verify trip membership
  let instance: any;

  if (type === "TODO") {
    const item = await prisma.todoItemInstance.findUnique({
      where: { id: itemId },
      include: { list: true },
    });
    if (!item) throw new Error("Item not found");
    instance = item.list;
  } else if (type === "KIT") {
    const item = await prisma.kitItemInstance.findUnique({
      where: { id: itemId },
      include: { list: true },
    });
    if (!item) throw new Error("Item not found");
    instance = item.list;
  }

  if (!instance) {
    throw new Error("Item not found");
  }

  // Verify trip membership
  await requireTripMember(actorId, instance.tripId);

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
    { listInstanceId: instance.id, type, state }
  );
}

/**
 * Launch an action associated with a TODO item
 */
export async function launchItemAction(
  actorId: string,
  itemInstanceId: string
) {
  const item = await prisma.todoItemInstance.findUnique({
    where: { id: itemInstanceId },
    include: { list: true },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  // Verify trip membership
  await requireTripMember(actorId, item.list.tripId);

  const handler = getHandler("TODO");
  if (!handler.launchItemAction) {
    throw new Error("This handler does not support actions");
  }

  const deepLink = await handler.launchItemAction({
    prisma,
    itemInstanceId,
    tripId: item.list.tripId,
  });

  await logEvent(
    "ListItem",
    itemInstanceId,
    EventType.LIST_ITEM_ACTION_LAUNCHED,
    actorId,
    { tripId: item.list.tripId, deepLink }
  );

  return deepLink;
}
