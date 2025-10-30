import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { getSpendById, updateSpend, deleteSpend } from "@/server/services/spends";
import { UpdateSpendSchema } from "@/types/schemas";

/**
 * GET /api/spends/[id] - Get a spend by ID
 *
 * Authorization: User must be authenticated and a member of the trip
 */
export async function GET(
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

    // 2. Get the spend
    const spend = await getSpendById(id);

    if (!spend) {
      return NextResponse.json(
        { error: "Spend not found" },
        { status: 404 }
      );
    }

    // 3. Authorize - verify user is a member of the trip
    await requireTripMember(auth.uid, spend.tripId);

    // 4. Calculate assignment percentage
    const totalAssigned = spend.assignments.reduce(
      (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
      0
    );
    const spendAmount = Number(spend.normalizedAmount);
    const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

    // 5. Return spend
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
    console.error("Error fetching spend:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("not a member")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch spend" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/spends/[id] - Update a spend
 *
 * Authorization: User must be authenticated and a member of the trip
 *
 * Request body: UpdateSpendInput (all fields optional)
 */
export async function PUT(
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
    const body = await request.json();
    const validationResult = UpdateSpendSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid update data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // 5. Update the spend
    const spend = await updateSpend(id, auth.uid, updateData);

    // 6. Calculate assignment percentage
    const totalAssigned = spend.assignments.reduce(
      (sum, assignment) => sum + Number(assignment.normalizedShareAmount),
      0
    );
    const spendAmount = Number(spend.normalizedAmount);
    const assignedPercentage = spendAmount > 0 ? (totalAssigned / spendAmount) * 100 : 0;

    // 7. Return updated spend
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
    console.error("Error updating spend:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot edit finalized")) {
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
      { error: "Failed to update spend" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spends/[id] - Soft delete a spend
 *
 * Authorization: User must be authenticated and a member of the trip
 */
export async function DELETE(
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

    // 4. Delete the spend
    await deleteSpend(id, auth.uid);

    // 5. Return success
    return NextResponse.json(
      {
        success: true,
        message: "Spend deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting spend:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("not a member")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete spend" },
      { status: 500 }
    );
  }
}
