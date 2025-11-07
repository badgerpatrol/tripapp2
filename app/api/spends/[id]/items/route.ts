import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireTripMember } from "@/server/authz";
import {
  createSpendItem,
  getSpendItems,
  recalculateSpendFromItems,
} from "@/server/services/spendItems";
import { getSpendById } from "@/server/services/spends";
import { prisma } from "@/lib/prisma";
import {
  CreateSpendItemSchema,
  type GetSpendItemsResponse,
  type CreateSpendItemResponse,
} from "@/types/schemas";
import { calculateSpendSummary, decimalToNumber } from "@/lib/assignmentMath";

/**
 * GET /api/spends/:id/items
 * Lists all items for a spend with totals and summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spendId } = await params;

    // Get spend to verify it exists and get tripId
    const spend = await getSpendById(spendId);
    if (!spend) {
      return NextResponse.json({ error: "Spend not found" }, { status: 404 });
    }

    // Verify user is trip member
    await requireTripMember(auth.uid, spend.tripId);

    // Get items - assignments are already included in spend from getSpendById
    const items = await getSpendItems(spendId);
    const assignments = spend.assignments || [];

    // Calculate summary
    const summary = calculateSpendSummary(spend.amount, items, assignments);

    // Transform items to response format
    const itemsResponse = items.map((item) => ({
      id: item.id,
      spendId: item.spendId,
      name: item.name,
      description: item.description,
      cost: decimalToNumber(item.cost),
      assignedUserId: item.assignedUserId,
      assignedUser: item.assignedUser || null,
      createdById: item.createdById,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const response: GetSpendItemsResponse = {
      success: true,
      items: itemsResponse,
      total: summary.itemsTotal,
      spendTotal: summary.spendTotal,
      difference: summary.difference,
      percentAssigned: summary.percentAssigned,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching spend items:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.message.includes("not found")
            ? 404
            : error.message.includes("Unauthorized") || error.message.includes("permission")
            ? 403
            : 400,
        }
      );
    }

    return NextResponse.json({ error: "Failed to fetch spend items" }, { status: 500 });
  }
}

/**
 * POST /api/spends/:id/items
 * Creates a new item for a spend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spendId } = await params;

    // Get spend to verify it exists and get tripId
    const spend = await getSpendById(spendId);
    if (!spend) {
      return NextResponse.json({ error: "Spend not found" }, { status: 404 });
    }

    // Verify user is trip member
    await requireTripMember(auth.uid, spend.tripId);

    // Check if user is spend owner or trip organizer
    const tripMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: spend.tripId,
          userId: auth.uid,
        },
      },
    });

    const isSpendOwner = spend.paidById === auth.uid;
    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isSpendOwner && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the spend creator or trip organizer can add items" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateSpendItemSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || "Invalid request data" },
        { status: 400 }
      );
    }

    const itemData = validationResult.data;

    // If userId is provided, verify they are a trip member
    if (itemData.userId) {
      await requireTripMember(itemData.userId, spend.tripId);
    }

    // Create item
    const item = await createSpendItem(spendId, auth.uid, itemData);

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
      createdById: item.createdById,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    const response: CreateSpendItemResponse = {
      success: true,
      item: itemResponse,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating spend item:", error);

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

    return NextResponse.json({ error: "Failed to create spend item" }, { status: 500 });
  }
}
