/**
 * API Route: /api/choices/:choiceId/selections
 * B2. Create or Update Selections (POST/PUT)
 * B3. Delete My Selection (DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { CreateSelectionSchema } from "@/types/schemas";
import {
  createOrUpdateSelection,
  deleteSelection,
} from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/choices/:choiceId/selections
 * Create or update user's selections for a choice
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

    const body = await request.json();
    const data = CreateSelectionSchema.parse(body);

    const result = await createOrUpdateSelection(choiceId, auth.uid, data);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/choices/:choiceId/selections error:", error);

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

    if (error.message?.includes("closed") || error.message?.includes("archived") || error.message?.includes("deadline")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message?.includes("exceeds") || error.message?.includes("limit")) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create/update selections" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/choices/:choiceId/selections
 * Full replace of user's selections (same as POST for this implementation)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ choiceId: string }> }
) {
  return POST(request, { params });
}

/**
 * DELETE /api/choices/:choiceId/selections
 * Delete user's selection entirely
 */
export async function DELETE(
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

    await deleteSelection(choiceId, auth.uid);

    return NextResponse.json({}, { status: 204 });
  } catch (error: any) {
    console.error("DELETE /api/choices/:choiceId/selections error:", error);

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

    if (error.message?.includes("closed")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete selection" },
      { status: 500 }
    );
  }
}
