/**
 * API Route: /api/choices/:choiceId/respondents
 * B5. Get who has/hasn't responded (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { getChoiceRespondents } from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/choices/:choiceId/respondents
 * Get list of users who have and haven't responded
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

    const respondents = await getChoiceRespondents(choiceId, choice.tripId);

    return NextResponse.json(respondents, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/choices/:choiceId/respondents error:", error);

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
      { error: error.message || "Failed to fetch respondents" },
      { status: 500 }
    );
  }
}
