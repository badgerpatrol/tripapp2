import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { SpendStatus, TripMemberRole, MilestoneTriggerType } from "@/lib/generated/prisma";
import { calculateTripBalances } from "@/server/services/settlements";

/**
 * POST /api/trips/[id]/spend-status
 * Toggle trip spend status (close/reopen all spending on the trip)
 * Only OWNER and ADMIN can toggle spend status
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
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

    // Get the trip
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      include: {
        members: {
          where: {
            userId: auth.uid,
            deletedAt: null,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check if user is OWNER or ADMIN
    const member = trip.members[0];
    if (!member || (member.role !== TripMemberRole.OWNER && member.role !== TripMemberRole.ADMIN)) {
      return NextResponse.json(
        { error: "Only trip organizers can change spend status" },
        { status: 403 }
      );
    }

    // Parse request body for optional action parameter
    const body = await req.json().catch(() => ({}));
    const action = body.action; // 'close' or 'open', optional
    const confirmClearSettlements = body.confirmClearSettlements; // true if user confirmed clearing settlements

    // Determine new status
    let newStatus: SpendStatus;
    if (action === "close") {
      newStatus = SpendStatus.CLOSED;
    } else if (action === "open") {
      newStatus = SpendStatus.OPEN;
    } else {
      // Toggle behavior
      newStatus = trip.spendStatus === SpendStatus.OPEN ? SpendStatus.CLOSED : SpendStatus.OPEN;
    }

    // Check if reopening when settlements exist
    if (newStatus === SpendStatus.OPEN && trip.spendStatus === SpendStatus.CLOSED) {
      const existingSettlements = await prisma.settlement.findMany({
        where: {
          tripId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existingSettlements.length > 0 && !confirmClearSettlements) {
        // Return warning to frontend
        return NextResponse.json({
          success: false,
          requiresConfirmation: true,
          settlementCount: existingSettlements.length,
          message: `This trip has ${existingSettlements.length} active settlement${existingSettlements.length === 1 ? '' : 's'} with payment tracking. Reopening spending will delete all settlements and payment records. Are you sure?`,
        }, { status: 200 });
      }
    }

    // If closing, calculate settlement plan first (outside transaction)
    let settlementPlan = null;
    if (newStatus === SpendStatus.CLOSED && trip.spendStatus === SpendStatus.OPEN) {
      const balanceSummary = await calculateTripBalances(tripId);
      settlementPlan = balanceSummary.settlements;
    }

    // Update trip spend status and handle settlements
    const now = new Date();
    const updatedTrip = await prisma.$transaction(async (tx) => {
      // If closing, create settlement plan
      if (newStatus === SpendStatus.CLOSED && trip.spendStatus === SpendStatus.OPEN && settlementPlan) {
        // Delete any existing settlements first to avoid duplicates
        await tx.settlement.deleteMany({
          where: {
            tripId,
            deletedAt: null,
          },
        });

        // Create new settlement records from calculated plan
        const settlementRecords = settlementPlan.map((settlement) => ({
          tripId,
          fromUserId: settlement.fromUserId,
          toUserId: settlement.toUserId,
          amount: settlement.amount,
          status: "PENDING" as const,
          notes: settlement.oldestDebtDate
            ? `Debt since ${settlement.oldestDebtDate.toLocaleDateString()}`
            : null,
        }));

        if (settlementRecords.length > 0) {
          await tx.settlement.createMany({
            data: settlementRecords,
          });
        }
      }

      // If reopening, delete all settlements and payments
      if (newStatus === SpendStatus.OPEN && trip.spendStatus === SpendStatus.CLOSED) {
        await tx.settlement.deleteMany({
          where: {
            tripId,
            deletedAt: null,
          },
        });
      }

      // Handle Spending milestone based on status change
      const spendMilestone = await tx.timelineItem.findFirst({
        where: {
          tripId,
          title: "Spending Window Closes",
          deletedAt: null,
        },
      });

      if (spendMilestone) {
        if (newStatus === SpendStatus.CLOSED && !spendMilestone.isCompleted) {
          // Closing spending - mark milestone as completed
          await tx.timelineItem.update({
            where: { id: spendMilestone.id },
            data: {
              isCompleted: true,
              completedAt: now,
              triggerType: MilestoneTriggerType.MANUAL,
            },
          });
          console.log(`[spend-status] Marked Spending Window Closes milestone as completed (MANUAL) for trip ${tripId}`);
        } else if (newStatus === SpendStatus.OPEN && spendMilestone.isCompleted) {
          // Reopening spending - reset milestone to uncompleted
          await tx.timelineItem.update({
            where: { id: spendMilestone.id },
            data: {
              isCompleted: false,
              completedAt: null,
              triggerType: null,
            },
          });
          console.log(`[spend-status] Reset Spending Window Closes milestone to uncompleted for trip ${tripId}`);
        }
      }

      // Update trip status
      return await tx.trip.update({
        where: { id: tripId },
        data: { spendStatus: newStatus },
      });
    });

    return NextResponse.json({
      success: true,
      trip: {
        id: updatedTrip.id,
        spendStatus: updatedTrip.spendStatus,
      },
      
    });
  } catch (error) {
    console.error("Error toggling trip spend status:", error);
    return NextResponse.json(
      { error: "Failed to toggle spend status" },
      { status: 500 }
    );
  }
}
