/**
 * API Route: /api/choices/:choiceId/my-note
 * B6. Update user's overall note for their selection (PUT)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { UpdateSelectionNoteSchema } from "@/types/schemas";
import { updateSelectionNote } from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/choices/:choiceId/my-note
 * Update user's overall note for their selection
 */
export async function PUT(
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
    const data = UpdateSelectionNoteSchema.parse(body);

    const result = await updateSelectionNote(choiceId, auth.uid, data.note);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("PUT /api/choices/:choiceId/my-note error:", error);

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
      { error: error.message || "Failed to update note" },
      { status: 500 }
    );
  }
}
