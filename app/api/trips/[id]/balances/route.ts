import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { calculateTripBalances } from "@/server/services/settlements";
import { TripBalanceSummarySchema } from "@/types/schemas";

/**
 * GET /api/trips/:id/balances
 * Calculates and returns per-person balances and minimal settlement plan for a trip.
 *
 * Only trip members can view balances.
 *
 * Returns:
 * - Per-person totals (paid, owed, net balance)
 * - Minimal settlement plan (who owes whom)
 * - Debt age information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    const { id: tripId } = await params;

    // 2. Check if user is a trip member
    await requireTripMembershipOnly(auth.uid, tripId);

    // 3. Calculate balances and settlement plan
    const balanceSummary = await calculateTripBalances(tripId);

    // 4. Validate response with Zod schema
    const validatedSummary = TripBalanceSummarySchema.parse({
      ...balanceSummary,
      calculatedAt: balanceSummary.calculatedAt.toISOString(),
      settlements: balanceSummary.settlements.map((s) => ({
        ...s,
        oldestDebtDate: s.oldestDebtDate?.toISOString() || null,
      })),
    });

    return NextResponse.json(
      {
        success: true,
        balances: validatedSummary,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error calculating trip balances:", error);

    // Handle specific errors
    if (error.message === "Trip not found") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (error.message === "Not a member of this trip") {
      return NextResponse.json(
        { error: "You do not have access to this trip" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to calculate balances. Please try again." },
      { status: 500 }
    );
  }
}
