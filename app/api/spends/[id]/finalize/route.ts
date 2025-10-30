import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { getSpendById, finalizeSpend } from "@/server/services/spends";
import { FinalizeSpendSchema } from "@/types/schemas";

/**
 * POST /api/spends/[id]/finalize - Finalize a spend
 *
 * Authorization: User must be authenticated and a member of the trip
 *
 * Request body:
 * - force: boolean (optional, default: false) - Force finalize even if assignments don't equal 100%
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
    await requireTripMember(auth.uid, existingSpend.tripId);

    // 4. Parse and validate request body
    const body = await request.json().catch(() => ({})); // Default to empty object if no body
    const validationResult = FinalizeSpendSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { force = false } = validationResult.data;

    // 5. Finalize the spend
    const spend = await finalizeSpend(id, auth.uid, force);

    // 6. Calculate assignment percentage
    const totalAssigned = spend.assignments.reduce(
      (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
      0
    );
    const spendAmount = Number(spend.normalizedAmount);
    const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

    // 7. Return finalized spend
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
    console.error("Error finalizing spend:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot finalize") || error.message.includes("already finalized")) {
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
      { error: "Failed to finalize spend" },
      { status: 500 }
    );
  }
}
