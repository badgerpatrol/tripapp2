import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { getSpendById, closeSpend } from "@/server/services/spends";
import { CloseSpendSchema } from "@/types/schemas";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/spends/[id]/finalize - Close a spend
 *
 * Authorization: User must be either the spender (paidBy) or a trip organizer (OWNER/ADMIN)
 *
 * Request body:
 * - force: boolean (optional, default: false) - Force close even if assignments don't equal 100%
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
        { error: "Only the spender or trip organizer can close this spend" },
        { status: 403 }
      );
    }

    // 5. Parse and validate request body
    const body = await request.json().catch(() => ({})); // Default to empty object if no body
    const validationResult = CloseSpendSchema.safeParse(body);

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

    // 6. Close the spend
    const spend = await closeSpend(id, auth.uid, force);

    // 7. Calculate assignment percentage
    const totalAssigned = spend.assignments.reduce(
      (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
      0
    );
    const spendAmount = Number(spend.normalizedAmount);
    const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

    // 8. Return closed spend
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
    console.error("Error closing spend:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      if (error.message.includes("Cannot close") || error.message.includes("already closed")) {
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
      {
        error: "Failed to close spend",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
