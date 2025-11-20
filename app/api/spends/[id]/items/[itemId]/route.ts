import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireTripMember } from "@/server/authz";
import {
  updateSpendItem,
  deleteSpendItem,
  getSpendItemById,
  recalculateSpendFromItems,
} from "@/server/services/spendItems";
import { prisma } from "@/lib/prisma";
import {
  UpdateSpendItemSchema,
  type UpdateSpendItemResponse,
} from "@/types/schemas";
import { decimalToNumber } from "@/lib/assignmentMath";

/**
 * PUT /api/spends/:id/items/:itemId
 * Updates an existing spend item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spendId, itemId } = await params;

    // Get item to verify it exists and belongs to the spend
    const existingItem = await getSpendItemById(itemId);
    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.spendId !== spendId) {
      return NextResponse.json({ error: "Item does not belong to this spend" }, { status: 400 });
    }

    // Verify user is trip member
    await requireTripMember(auth.uid, existingItem.spend.tripId);

    // Check if user is spend owner or trip organizer
    const tripMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: existingItem.spend.tripId,
          userId: auth.uid,
        },
      },
    });

    const isSpendOwner = existingItem.spend.id === spendId; // Already verified spend ownership via item.spend
    const spend = await prisma.spend.findUnique({
      where: { id: spendId },
      select: { paidById: true },
    });

    const isOwner = spend && spend.paidById === auth.uid;
    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isOwner && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the spend creator or trip organizer can edit items" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = UpdateSpendItemSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || "Invalid request data" },
        { status: 400 }
      );
    }

    const itemData = validationResult.data;

    // If userId is provided (including null), verify it's valid
    if (itemData.userId !== undefined && itemData.userId !== null) {
      await requireTripMember(itemData.userId, existingItem.spend.tripId);
    }

    // Update item
    const item = await updateSpendItem(itemId, auth.uid, itemData);

    // Recalculate spend total from items
    await recalculateSpendFromItems(spendId, auth.uid);

    // Transform to response format
    const itemResponse = {
      id: item.id,
      spendId: item.spendId,
      name: item.name,
      description: item.description,
      cost: decimalToNumber(item.cost),
      assignedUserId: item.assignedUserId,
      assignedUser: item.assignedUser || null,
      source: item.source,
      photoId: item.photoId,
      createdById: item.createdById,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    const response: UpdateSpendItemResponse = {
      success: true,
      item: itemResponse,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error updating spend item:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.message.includes("not found")
            ? 404
            : error.message.includes("closed") || error.message.includes("permission")
            ? 403
            : 400,
        }
      );
    }

    return NextResponse.json({ error: "Failed to update spend item" }, { status: 500 });
  }
}

/**
 * DELETE /api/spends/:id/items/:itemId
 * Deletes a spend item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spendId, itemId } = await params;

    // Get item to verify it exists and belongs to the spend
    const existingItem = await getSpendItemById(itemId);
    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.spendId !== spendId) {
      return NextResponse.json({ error: "Item does not belong to this spend" }, { status: 400 });
    }

    // Verify user is trip member
    await requireTripMember(auth.uid, existingItem.spend.tripId);

    // Check if user is spend owner or trip organizer
    const tripMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: existingItem.spend.tripId,
          userId: auth.uid,
        },
      },
    });

    const spend = await prisma.spend.findUnique({
      where: { id: spendId },
      select: { paidById: true },
    });

    const isOwner = spend && spend.paidById === auth.uid;
    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isOwner && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the spend creator or trip organizer can delete items" },
        { status: 403 }
      );
    }

    // Delete item
    await deleteSpendItem(itemId, auth.uid);

    // Recalculate spend total from items
    await recalculateSpendFromItems(spendId, auth.uid);

    return NextResponse.json(
      { success: true, message: "Item deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting spend item:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.message.includes("not found")
            ? 404
            : error.message.includes("closed") || error.message.includes("permission")
            ? 403
            : 400,
        }
      );
    }

    return NextResponse.json({ error: "Failed to delete spend item" }, { status: 500 });
  }
}
