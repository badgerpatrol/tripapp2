import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trips/[id]/settlements - Get persisted settlements for a trip
 *
 * Authorization: User must be a member of the trip
 *
 * Returns settlements with payment information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

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

    // 2. Authorize - verify user is a member of the trip
    await requireTripMembershipOnly(auth.uid, tripId);

    // 3. Get settlements with payments
    const settlements = await prisma.settlement.findMany({
      where: {
        tripId,
        deletedAt: null,
      },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
            photoURL: true,
          },
        },
        toUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
            photoURL: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paidAt: true,
            paymentMethod: true,
            paymentReference: true,
            notes: true,
            recordedById: true,
            recordedBy: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            createdAt: true,
          },
          orderBy: {
            paidAt: "desc",
          },
        },
      },
      orderBy: [
        { status: "asc" }, // PENDING first, then PARTIALLY_PAID, PAID, VERIFIED
        { createdAt: "desc" },
      ],
    });

    // Calculate total paid and remaining for each settlement
    const settlementsWithTotals = settlements.map((settlement) => {
      const totalPaid = settlement.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );
      const remainingAmount = Number(settlement.amount) - totalPaid;

      return {
        id: settlement.id,
        tripId: settlement.tripId,
        fromUserId: settlement.fromUserId,
        fromUserName: settlement.fromUser.displayName || settlement.fromUser.email,
        fromUserEmail: settlement.fromUser.email,
        fromUserPhotoURL: settlement.fromUser.photoURL,
        toUserId: settlement.toUserId,
        toUserName: settlement.toUser.displayName || settlement.toUser.email,
        toUserEmail: settlement.toUser.email,
        toUserPhotoURL: settlement.toUser.photoURL,
        amount: Number(settlement.amount),
        status: settlement.status,
        paymentMethod: settlement.paymentMethod,
        paymentReference: settlement.paymentReference,
        notes: settlement.notes,
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt,
        totalPaid,
        remainingAmount,
        payments: settlement.payments.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          paidAt: payment.paidAt,
          paymentMethod: payment.paymentMethod,
          paymentReference: payment.paymentReference,
          notes: payment.notes,
          recordedById: payment.recordedById,
          recordedByName: payment.recordedBy.displayName || payment.recordedBy.email,
          recordedByEmail: payment.recordedBy.email,
          createdAt: payment.createdAt,
        })),
      };
    });

    return NextResponse.json(
      {
        success: true,
        settlements: settlementsWithTotals,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching settlements:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("not a member")) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch settlements",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
