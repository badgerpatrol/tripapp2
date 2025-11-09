/**
 * API Route: /api/choices/:choiceId/items
 * A4. Add Menu Items to a Choice (POST)
 * Get all items for a choice (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { CreateChoiceItemSchema } from "@/types/schemas";
import { createChoiceItem } from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

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
 * GET /api/choices/:choiceId/items
 * Get all items for a choice
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ choiceId: string }> }
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

    const { choiceId } = await params;

    // Get choice to verify trip membership
    const choice = await prisma.choice.findUnique({
      where: { id: choiceId },
      select: { tripId: true },
    });

    if (!choice) {
      return NextResponse.json(
        { error: "Choice not found" },
        { status: 404 }
      );
    }

    // Verify user is a trip member
    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: choice.tripId,
          userId: auth.uid,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this trip" },
        { status: 403 }
      );
    }

    const items = await prisma.choiceItem.findMany({
      where: { choiceId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(items, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/choices/:choiceId/items error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/choices/:choiceId/items
 * Create a new item for a choice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ choiceId: string }> }
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

    const { choiceId } = await params;

    // Check permission
    const canManage = await canManageChoice(auth.uid, choiceId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden: Only organisers or choice creator can add items" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = CreateChoiceItemSchema.parse(body);

    const item = await createChoiceItem(choiceId, auth.uid, data);

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/choices/:choiceId/items error:", error);

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
      { error: error.message || "Failed to create item" },
      { status: 500 }
    );
  }
}
