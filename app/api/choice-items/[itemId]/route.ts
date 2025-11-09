/**
 * API Route: /api/choice-items/:itemId
 * A5. Update/Delete a Choice Item (PATCH/DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { UpdateChoiceItemSchema } from "@/types/schemas";
import {
  updateChoiceItem,
  deactivateChoiceItem,
} from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

/**
 * Check if user can manage choice (organiser or creator)
 */
async function canManageChoice(userId: string, itemId: string): Promise<boolean> {
  const item = await prisma.choiceItem.findUnique({
    where: { id: itemId },
    include: {
      choice: {
        include: {
          trip: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      },
    },
  });

  if (!item) {
    return false;
  }

  // Choice creator can always manage
  if (item.choice.createdById === userId) {
    return true;
  }

  // Check if user is organiser (ADMIN or OWNER)
  const membership = item.choice.trip.members[0];
  if (!membership) {
    return false;
  }

  return membership.role === "ADMIN" || membership.role === "OWNER";
}

/**
 * PATCH /api/choice-items/:itemId
 * Update a choice item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { itemId } = await params;

    // Check permission
    const canManage = await canManageChoice(auth.uid, itemId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden: Only organisers or choice creator can update items" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = UpdateChoiceItemSchema.parse(body);

    const updated = await updateChoiceItem(itemId, auth.uid, data);

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/choice-items/:itemId error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to update item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/choice-items/:itemId
 * Deactivate a choice item (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { itemId } = await params;

    // Check permission
    const canManage = await canManageChoice(auth.uid, itemId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden: Only organisers or choice creator can delete items" },
        { status: 403 }
      );
    }

    await deactivateChoiceItem(itemId, auth.uid);

    return NextResponse.json({}, { status: 204 });
  } catch (error: any) {
    console.error("DELETE /api/choice-items/:itemId error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete item" },
      { status: 500 }
    );
  }
}
