/**
 * API Route: /api/choices/:choiceId/restore
 * A3. Restore an archived Choice (POST)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { restoreChoice } from "@/server/services/choices";
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
 * POST /api/choices/:choiceId/restore
 * Restore an archived choice
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
        { error: "Forbidden: Only organisers or choice creator can restore" },
        { status: 403 }
      );
    }

    const restored = await restoreChoice(choiceId, auth.uid);

    return NextResponse.json(restored, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/choices/:choiceId/restore error:", error);

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
      { error: error.message || "Failed to restore choice" },
      { status: 500 }
    );
  }
}
