import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { recordPayment } from "@/server/services/settlements";
import { RecordPaymentSchema } from "@/types/schemas";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/settlements/[id]/payments - Record a payment towards a settlement
 *
 * Authorization: User must be either the payment receiver (toUser) or a trip organizer (OWNER/ADMIN)
 *
 * Request body:
 * - amount: number (required) - Payment amount in trip base currency
 * - paidAt: Date (optional, defaults to now) - Date the payment was made
 * - paymentMethod: string (optional) - Payment method (e.g., "Cash", "Venmo")
 * - paymentReference: string (optional) - Payment reference/transaction ID
 * - notes: string (optional) - Additional notes about the payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: settlementId } = await params;

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

    // 2. Get the settlement to verify trip membership
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId, deletedAt: null },
      include: {
        trip: {
          select: {
            id: true,
            baseCurrency: true,
          },
        },
        fromUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    // 3. Authorize - verify user is a member of the trip
    await requireTripMembershipOnly(auth.uid, settlement.tripId);

    // 4. Additional authorization - verify user is either the receiver or a trip organizer
    const isReceiver = settlement.toUserId === auth.uid;

    // Check if user is a trip organizer (OWNER or ADMIN)
    const tripMember = await prisma.tripMember.findFirst({
      where: {
        tripId: settlement.tripId,
        userId: auth.uid,
      },
    });

    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isReceiver && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the payment receiver or trip organizer can record this payment" },
        { status: 403 }
      );
    }

    // 5. Parse and validate request body
    const body = await request.json();
    const validationResult = RecordPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { amount, paidAt, paymentMethod, paymentReference, notes } = validationResult.data;

    // 6. Record the payment
    const result = await recordPayment(
      settlementId,
      amount,
      paidAt || new Date(),
      auth.uid,
      paymentMethod,
      paymentReference,
      notes
    );

    // 7. Return payment and updated settlement info
    return NextResponse.json(
      {
        success: true,
        payment: {
          id: result.payment.id,
          settlementId: result.payment.settlementId,
          amount: Number(result.payment.amount),
          paidAt: result.payment.paidAt,
          paymentMethod: result.payment.paymentMethod,
          paymentReference: result.payment.paymentReference,
          notes: result.payment.notes,
          recordedById: result.payment.recordedById,
          createdAt: result.payment.createdAt,
        },
        settlement: {
          id: result.settlement.id,
          status: result.settlement.status,
          amount: result.settlement.amount,
          totalPaid: result.settlement.totalPaid,
          remainingAmount: result.settlement.remainingAmount,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording payment:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
      if (error.message.includes("not a member") || error.message.includes("Forbidden")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to record payment",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
