import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { getSpendById } from "@/server/services/spends";
import { reopenSpend } from "@/server/services/spends";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/spends/[id]/reopen - Reopen a closed spend
 *
 * Authorization: User must be either the spender (paidBy) or a trip organizer (OWNER/ADMIN)
 *
 * This endpoint allows reopening a closed spend, making it editable again.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Authenticate
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    // 2. Get the spend to verify trip membership
    const existingSpend = await getSpendById(id);

    if (!existingSpend) {
      return NextResponse.json(
        { error: "Spend not found" },
        { status: 404 }
      );
    }

    // 3. Authorize - verify user is a member of the trip
    await requireTripMembershipOnly(auth.uid, existingSpend.tripId);

    // 4. Additional authorization - verify user is either the spender or a trip organizer
    const isSpender = existingSpend.paidBy.id === auth.uid;

    // Check if user is a trip organizer (OWNER or ADMIN)
    const tripMember = await prisma.tripMember.findFirst({
      where: {
        tripId: existingSpend.tripId,
        userId: auth.uid,
      },
    });

    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isSpender && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the spender or trip organizer can reopen this spend" },
        { status: 403 }
      );
    }

    // 5. Reopen the spend
    const spend = await reopenSpend(id, auth.uid);

    // 6. Calculate assignment percentage
    const totalAssigned = spend.assignments.reduce(
      (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
      0
    );
    const spendAmount = Number(spend.normalizedAmount);
    const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

    // 7. Return reopened spend
    return NextResponse.json(
      {
        success: true,
        spend: {
          id: spend.id,
          tripId: spend.tripId,
          description: spend.description,
          amount: Number(spend.amount),
          currency: spend.currency,
          fxRate: Number(spend.fxRate),
          normalizedAmount: Number(spend.normalizedAmount),
          date: spend.date,
          status: spend.status,
          notes: spend.notes,
          receiptUrl: spend.receiptUrl,
          paidBy: spend.paidBy,
          category: spend.category,
          assignments: spend.assignments.map((a) => ({
            id: a.id,
            userId: a.userId,
            shareAmount: Number(a.shareAmount),
            normalizedShareAmount: Number(a.normalizedShareAmount),
            splitType: a.splitType,
            splitValue: a.splitValue ? Number(a.splitValue) : null,
            user: a.user,
          })),
          assignedPercentage: Math.round(assignedPercentage * 10) / 10,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error reopening spend:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot reopen") || error.message.includes("not closed")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes("not found") || error.message.includes("not a member")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to reopen spend" },
      { status: 500 }
    );
  }
}
