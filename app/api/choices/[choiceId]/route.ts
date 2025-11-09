/**
 * API Routes: /api/choices/:choiceId
 * B1. Get Choice Detail (GET)
 * A2. Update a Choice (PATCH)
 * A3. Archive a Choice (DELETE)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { TripMemberRole } from "@/lib/generated/prisma";
import { UpdateChoiceSchema } from "@/types/schemas";
import {
  getChoiceDetail,
  updateChoice,
  deleteChoice,
} from "@/server/services/choices";
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
 * GET /api/choices/:choiceId
 * Get choice details with items and user's selections
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
    await requireTripMember(auth.uid, choice.tripId);

    const detail = await getChoiceDetail(choiceId, auth.uid);

    return NextResponse.json(detail, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/choices/:choiceId error:", error);

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
      { error: error.message || "Failed to fetch choice" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/choices/:choiceId
 * Update choice details
 */
export async function PATCH(
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
        { error: "Forbidden: Only organisers or choice creator can update" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = UpdateChoiceSchema.parse(body);

    const updated = await updateChoice(choiceId, auth.uid, data);

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/choices/:choiceId error:", error);

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
      { error: error.message || "Failed to update choice" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/choices/:choiceId
 * Delete a choice and all associated items and selections
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

    // Check permission
    const canManage = await canManageChoice(auth.uid, choiceId);
    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden: Only organisers or choice creator can delete" },
        { status: 403 }
      );
    }

    await deleteChoice(choiceId, auth.uid);

    return NextResponse.json({}, { status: 204 });
  } catch (error: any) {
    console.error("DELETE /api/choices/:choiceId error:", error);

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
      { error: error.message || "Failed to delete choice" },
      { status: 500 }
    );
  }
}
