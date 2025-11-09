/**
 * API Route: /api/choices/:choiceId/linked-spend
 * Get the spend that was created from this choice (if any)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/choices/:choiceId/linked-spend
 * Returns the spend ID and existence status for a spend created from this choice
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

    // Look for a "spend_created" activity for this choice
    const spendActivity = await prisma.choiceActivity.findFirst({
      where: {
        choiceId,
        action: "spend_created",
      },
      orderBy: {
        createdAt: "desc", // Get the most recent one
      },
      select: {
        payload: true,
      },
    });

    if (!spendActivity || !spendActivity.payload) {
      return NextResponse.json(
        { hasSpend: false, spendId: null },
        { status: 200 }
      );
    }

    // Extract spendId from payload
    const payload = spendActivity.payload as any;
    const spendId = payload.spendId;

    if (!spendId) {
      return NextResponse.json(
        { hasSpend: false, spendId: null },
        { status: 200 }
      );
    }

    // Verify the spend still exists (not deleted)
    const spend = await prisma.spend.findUnique({
      where: { id: spendId },
      select: { id: true, deletedAt: true },
    });

    if (!spend || spend.deletedAt) {
      return NextResponse.json(
        { hasSpend: false, spendId: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { hasSpend: true, spendId: spend.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("GET /api/choices/:choiceId/linked-spend error:", error);

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
      { error: error.message || "Failed to fetch linked spend" },
      { status: 500 }
    );
  }
}
