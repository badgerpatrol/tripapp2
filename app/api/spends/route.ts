import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { createSpend, getTripSpends } from "@/server/services/spends";
import { CreateSpendSchema, GetSpendsQuerySchema } from "@/types/schemas";

/**
 * GET /api/spends - Get all spends for a trip with filtering and sorting
 *
 * Authorization: User must be authenticated and a member of the trip
 *
 * Query parameters:
 * - tripId: string (UUID, required)
 * - status: "OPEN" | "CLOSED" (optional)
 * - paidById: string (UUID, optional)
 * - sortBy: "date" | "amount" | "description" (optional, default: "date")
 * - sortOrder: "asc" | "desc" (optional, default: "desc")
 */
export async function GET(request: NextRequest) {
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

    // 2. Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      tripId: searchParams.get("tripId"),
      status: searchParams.get("status") || undefined,
      paidById: searchParams.get("paidById") || undefined,
      sortBy: searchParams.get("sortBy") || "date",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    const validationResult = GetSpendsQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const query = validationResult.data;

    // 3. Authorize - verify user is a member of the trip
    await requireTripMember(auth.uid, query.tripId);

    // 4. Get spends
    const spends = await getTripSpends(query.tripId, query);

    // 5. Return spends with calculated assignment percentage
    const spendsWithPercentage = spends.map((spend) => {
      const totalAssigned = spend.assignments.reduce(
        (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
        0
      );
      const spendAmount = Number(spend.normalizedAmount);
      const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

      return {
        id: spend.id,
        tripId: spend.tripId,
        description: spend.description,
        amount: Number(spend.amount),
        currency: spend.currency,
        normalizedAmount: Number(spend.normalizedAmount),
        date: spend.date,
        status: spend.status,
        paidBy: spend.paidBy,
        category: spend.category,
        assignments: spend.assignments.map((a) => ({
          id: a.id,
          userId: a.userId,
          shareAmount: Number(a.shareAmount),
          normalizedShareAmount: Number(a.normalizedShareAmount),
          splitType: a.splitType,
          user: a.user,
        })),
        assignedPercentage: Math.round(assignedPercentage * 10) / 10, // Round to 1 decimal
      };
    });

    return NextResponse.json(
      {
        success: true,
        spends: spendsWithPercentage,
        count: spendsWithPercentage.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching spends:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("not a member")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch spends" },
      { status: 500 }
    );
  }
}

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
          status: spend.status,
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
