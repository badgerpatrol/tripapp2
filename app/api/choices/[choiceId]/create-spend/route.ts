/**
 * API Route: /api/choices/:choiceId/create-spend
 * F1. Create Spend from Choice (POST)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { TripMemberRole } from "@/lib/generated/prisma";
import { CreateSpendFromChoiceSchema } from "@/types/schemas";
import { createSpendFromChoice } from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/choices/:choiceId/create-spend
 * Generate a spend pre-filled from the final report
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

    // Verify user is at least ADMIN (organisers can create spends)
    await requireTripMember(auth.uid, choice.tripId, TripMemberRole.ADMIN);

    const body = await request.json();
    const data = CreateSpendFromChoiceSchema.parse(body);

    const result = await createSpendFromChoice(choiceId, auth.uid, data.mode);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/choices/:choiceId/create-spend error:", error);

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

    if (error.message?.includes("zero total")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create spend" },
      { status: 500 }
    );
  }
}
