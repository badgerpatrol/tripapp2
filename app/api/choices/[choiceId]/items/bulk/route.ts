/**
 * API Route: /api/choices/:choiceId/items/bulk
 * POST: Bulk create menu items for a choice (used for menu scanning)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { BulkCreateItemsRequestSchema } from "@/types/menu";
import { bulkCreateChoiceItems } from "@/server/services/choices";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Check if user can manage choice (organiser or creator)
 */
async function canManageChoice(userId: string, choiceId: string): Promise<boolean> {
  const choice = await prisma.choice.findUnique({
    where: { id: choiceId },
    include: {
      trip: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!choice) {
    return false;
  }

  // Creator can always manage
  if (choice.createdById === userId) {
    return true;
  }

  // Check if user is organiser (ADMIN or OWNER)
  const membership = choice.trip.members[0];
  if (!membership) {
    return false;
  }

  return membership.role === "ADMIN" || membership.role === "OWNER";
}

/**
 * POST /api/choices/:choiceId/items/bulk
 * Bulk create menu items for a choice
 *
 * Request body:
 * {
 *   items: Array<{
 *     name: string,
 *     description?: string,
 *     priceMinor?: number,
 *     course?: string,
 *     sortIndex?: number,
 *     tags?: string[],
 *     maxPerUser?: number,
 *     maxTotal?: number,
 *     allergens?: string[],
 *     isActive?: boolean
 *   }>
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ choiceId: string }> }
) {
  try {
    // 1. Auth check
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requireAuth(auth.uid);

    // 2. Get choiceId
    const { choiceId } = await params;

    // 3. Check permission
    const canManage = await canManageChoice(auth.uid, choiceId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden: Only organisers or choice creator can add items" },
        { status: 403 }
      );
    }

    // 4. Validate request body
    const body = await request.json();
    const validationResult = BulkCreateItemsRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { items } = validationResult.data;

    // 5. Convert priceMinor to price (Decimal) for service layer
    const itemsWithPrices = items.map((item) => {
      // Convert priceMinor (integer cents) to price (Decimal)
      const price = item.priceMinor !== undefined
        ? item.priceMinor / 100 // Convert minor units to major units
        : undefined;

      return {
        name: item.name,
        description: item.description,
        price,
        course: item.course,
        sortIndex: item.sortIndex ?? 0,
        tags: item.tags,
        maxPerUser: item.maxPerUser,
        maxTotal: item.maxTotal,
        allergens: item.allergens,
        isActive: item.isActive ?? true,
      };
    });

    // 6. Bulk create items
    const createdItems = await bulkCreateChoiceItems(
      choiceId,
      auth.uid,
      itemsWithPrices
    );

    // 7. Return created items
    return NextResponse.json(
      {
        items: createdItems,
        count: createdItems.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Bulk create items error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create items",
      },
      { status: 500 }
    );
  }
}
