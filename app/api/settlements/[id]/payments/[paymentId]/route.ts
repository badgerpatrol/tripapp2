import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { RecordPaymentSchema } from "@/types/schemas";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/settlements/[id]/payments/[paymentId] - Update a payment
 *
 * Authorization: User must be either the payment recorder, receiver (toUser), or a trip organizer (OWNER/ADMIN)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: settlementId, paymentId } = await params;

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

    // 2. Get the payment and settlement
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        settlement: {
          include: {
            trip: true,
            fromUser: true,
            toUser: true,
          },
        },
      },
    });

    if (!payment || payment.settlementId !== settlementId) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // 3. Authorize - verify user is a member of the trip
    await requireTripMember(auth.uid, payment.settlement.tripId);

    // 4. Additional authorization - verify user is either the recorder, receiver, or a trip organizer
    const isRecorder = payment.recordedById === auth.uid;
    const isReceiver = payment.settlement.toUserId === auth.uid;

    // Check if user is a trip organizer (OWNER or ADMIN)
    const tripMember = await prisma.tripMember.findFirst({
      where: {
        tripId: payment.settlement.tripId,
        userId: auth.uid,
      },
    });

    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isRecorder && !isReceiver && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the payment recorder, receiver, or trip organizer can edit this payment" },
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

    // 6. Calculate the current total paid and new totals
    const settlement = payment.settlement;
    const oldPaymentAmount = Number(payment.amount);
    const newPaymentAmount = amount;
    const amountDifference = newPaymentAmount - oldPaymentAmount;

    // Calculate current total paid from all payments
    const allPayments = await prisma.payment.findMany({
      where: { settlementId: settlementId },
    });
    const currentTotalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const newTotalPaid = currentTotalPaid + amountDifference;
    const newRemainingAmount = Number(settlement.amount) - newTotalPaid;

    // Validate that new total doesn't exceed settlement amount (with small tolerance for floating point precision)
    if (newTotalPaid > Number(settlement.amount) + 0.001) {
      return NextResponse.json(
        { error: "Updated payment would exceed settlement amount" },
        { status: 400 }
      );
    }

    // 7. Update the payment and settlement status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the payment
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount: newPaymentAmount,
          paidAt: paidAt || payment.paidAt,
          paymentMethod: paymentMethod !== undefined ? paymentMethod : payment.paymentMethod,
          paymentReference: paymentReference !== undefined ? paymentReference : payment.paymentReference,
          notes: notes !== undefined ? notes : payment.notes,
        },
      });

      // Update the settlement status based on new totals
      let newStatus = settlement.status;
      if (newRemainingAmount <= 0.01) {
        newStatus = "PAID";
      } else if (newTotalPaid > 0.01 && newRemainingAmount > 0.01) {
        newStatus = "PARTIALLY_PAID";
      } else {
        newStatus = "PENDING";
      }

      const updatedSettlement = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: newStatus,
        },
      });

      // Log the event
      await tx.eventLog.create({
        data: {
          entity: "Payment",
          entityId: paymentId,
          eventType: "SETTLEMENT_UPDATED",
          byUser: auth.uid,
          tripId: settlement.tripId,
          payload: {
            settlementId,
            amount: newPaymentAmount,
            oldAmount: oldPaymentAmount,
          },
        },
      });

      return { updatedPayment, updatedSettlement };
    });

    // 8. Return updated payment and settlement info
    return NextResponse.json(
      {
        success: true,
        payment: {
          id: result.updatedPayment.id,
          settlementId: result.updatedPayment.settlementId,
          amount: Number(result.updatedPayment.amount),
          paidAt: result.updatedPayment.paidAt,
          paymentMethod: result.updatedPayment.paymentMethod,
          paymentReference: result.updatedPayment.paymentReference,
          notes: result.updatedPayment.notes,
          recordedById: result.updatedPayment.recordedById,
          createdAt: result.updatedPayment.createdAt,
        },
        settlement: {
          id: result.updatedSettlement.id,
          status: result.updatedSettlement.status,
          amount: Number(result.updatedSettlement.amount),
          totalPaid: newTotalPaid,
          remainingAmount: newRemainingAmount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating payment:", error);

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
        error: "Failed to update payment",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settlements/[id]/payments/[paymentId] - Delete a payment
 *
 * Authorization: User must be either the payment recorder, receiver (toUser), or a trip organizer (OWNER/ADMIN)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: settlementId, paymentId } = await params;

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

    // 2. Get the payment and settlement
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        settlement: {
          include: {
            trip: true,
            fromUser: true,
            toUser: true,
          },
        },
      },
    });

    if (!payment || payment.settlementId !== settlementId) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // 3. Authorize - verify user is a member of the trip
    await requireTripMember(auth.uid, payment.settlement.tripId);

    // 4. Additional authorization - verify user is either the recorder, receiver, or a trip organizer
    const isRecorder = payment.recordedById === auth.uid;
    const isReceiver = payment.settlement.toUserId === auth.uid;

    // Check if user is a trip organizer (OWNER or ADMIN)
    const tripMember = await prisma.tripMember.findFirst({
      where: {
        tripId: payment.settlement.tripId,
        userId: auth.uid,
      },
    });

    const isOrganizer = tripMember && (tripMember.role === "OWNER" || tripMember.role === "ADMIN");

    if (!isRecorder && !isReceiver && !isOrganizer) {
      return NextResponse.json(
        { error: "Only the payment recorder, receiver, or trip organizer can delete this payment" },
        { status: 403 }
      );
    }

    // 5. Calculate current total paid and new totals after deletion
    const settlement = payment.settlement;
    const paymentAmount = Number(payment.amount);

    // Calculate current total paid from all payments
    const allPayments = await prisma.payment.findMany({
      where: { settlementId: settlementId },
    });
    const currentTotalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const newTotalPaid = currentTotalPaid - paymentAmount;
    const newRemainingAmount = Number(settlement.amount) - newTotalPaid;

    await prisma.$transaction(async (tx) => {
      // Delete the payment
      await tx.payment.delete({
        where: { id: paymentId },
      });

      // Update the settlement status based on new totals
      let newStatus = settlement.status;
      if (newRemainingAmount <= 0.01) {
        newStatus = "PAID";
      } else if (newTotalPaid > 0.01 && newRemainingAmount > 0.01) {
        newStatus = "PARTIALLY_PAID";
      } else {
        newStatus = "PENDING";
      }

      await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: newStatus,
        },
      });

      // Log the event
      await tx.eventLog.create({
        data: {
          entity: "Payment",
          entityId: paymentId,
          eventType: "SETTLEMENT_UPDATED",
          byUser: auth.uid,
          tripId: settlement.tripId,
          payload: {
            settlementId,
            amount: paymentAmount,
            deleted: true,
          },
        },
      });
    });

    // 6. Return success
    return NextResponse.json(
      {
        success: true,
        message: "Payment deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting payment:", error);

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
        error: "Failed to delete payment",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
