import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { createSpend } from "@/server/services/spends";
import { CreateSpendSchema } from "@/types/schemas";

/**
 * POST /api/spends - Create a new spend
 *
 * Authorization: User must be authenticated and a member of the trip
 *
 * Request body:
 * - tripId: string (UUID)
 * - description: string (what was purchased)
 * - amount: number (positive)
 * - currency: string (3-letter code, e.g., USD)
 * - fxRate: number (optional, defaults to 1.0)
 * - date: Date (optional, defaults to now)
 * - notes: string (optional)
 * - categoryId: string (optional, UUID)
 */
export async function POST(request: NextRequest) {
  try {
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

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = CreateSpendSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid spend data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const spendData = validationResult.data;

    // 3. Authorize - verify user is a member of the trip
    await requireTripMember(auth.uid, spendData.tripId);

    // 4. Create the spend
    const spend = await createSpend(auth.uid, spendData);

    // 5. Return success response
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
          notes: spend.notes,
          paidById: spend.paidById,
          categoryId: spend.categoryId,
          paidBy: spend.paidBy,
          category: spend.category,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating spend:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("not a member")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create spend" },
      { status: 500 }
    );
  }
}
