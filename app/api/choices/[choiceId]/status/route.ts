/**
 * API Route: /api/choices/:choiceId/status
 * B4. Update Choice Status (Open/Close) (PATCH)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { UpdateChoiceStatusSchema } from "@/types/schemas";
import { updateChoiceStatus } from "@/server/services/choices";
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
 * PATCH /api/choices/:choiceId/status
 * Update choice status (open/close) and optionally set deadline
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
        { error: "Forbidden: Only organisers or choice creator can change status" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = UpdateChoiceStatusSchema.parse(body);

    const updated = await updateChoiceStatus(
      choiceId,
      auth.uid,
      data.status,
      data.deadline
    );

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/choices/:choiceId/status error:", error);

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
      { error: error.message || "Failed to update choice status" },
      { status: 500 }
    );
  }
}
