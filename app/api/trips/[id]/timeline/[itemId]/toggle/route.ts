import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { TripMemberRole, MilestoneTriggerType, RsvpWindowStatus, SpendStatus, ChoiceStatus } from "@/lib/generated/prisma";
import { calculateTripBalances } from "@/server/services/settlements";

/**
 * POST /api/trips/[id]/timeline/[itemId]/toggle
 * Toggle milestone completion status
 * Only OWNER and ADMIN can toggle milestones
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const { id: tripId, itemId } = await params;

    // Get the trip and verify user is OWNER or ADMIN
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
        { error: "Only trip organizers can toggle milestones" },
        { status: 403 }
      );
    }

    // Get the timeline item with choice relationship
    const timelineItem = await prisma.timelineItem.findUnique({
      where: { id: itemId, tripId, deletedAt: null },
      include: {
        choice: true,
      },
    });

    if (!timelineItem) {
      return NextResponse.json(
        { error: "Timeline item not found" },
        { status: 404 }
      );
    }

    // Toggle completion status
    const now = new Date();
    const newCompletionState = !timelineItem.isCompleted;

    // Handle status synchronization based on milestone type
    // Use transaction to update both milestone and related status atomically
    const result = await prisma.$transaction(async (tx) => {
      // Update the milestone
      const updatedItem = await tx.timelineItem.update({
        where: { id: itemId },
        data: {
          isCompleted: newCompletionState,
          completedAt: newCompletionState ? now : null,
          triggerType: newCompletionState ? MilestoneTriggerType.MANUAL : null,
        },
      });

      // Sync corresponding status based on milestone title
      if (timelineItem.title === "RSVP Deadline") {
        // Toggle RSVP status
        const newRsvpStatus = newCompletionState ? RsvpWindowStatus.CLOSED : RsvpWindowStatus.OPEN;
        await tx.trip.update({
          where: { id: tripId },
          data: { rsvpStatus: newRsvpStatus },
        });
        console.log(`[timeline-toggle] Synced RSVP status to ${newRsvpStatus}`);
      } else if (timelineItem.title === "Spending Window Closes") {
        // Toggle spend status
        const newSpendStatus = newCompletionState ? SpendStatus.CLOSED : SpendStatus.OPEN;

        if (newCompletionState) {
          // Closing spending - calculate and create settlements
          const balanceSummary = await calculateTripBalances(tripId);
          const settlementPlan = balanceSummary.settlements;

          // Delete any existing settlements first
          await tx.settlement.deleteMany({
            where: { tripId, deletedAt: null },
          });

          // Create new settlement records from calculated plan
          if (settlementPlan.length > 0) {
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

            await tx.settlement.createMany({
              data: settlementRecords,
            });
          }
        } else {
          // Reopening spending - delete all settlements
          await tx.settlement.deleteMany({
            where: { tripId, deletedAt: null },
          });
        }

        await tx.trip.update({
          where: { id: tripId },
          data: { spendStatus: newSpendStatus },
        });
        console.log(`[timeline-toggle] Synced Spend status to ${newSpendStatus}`);
      } else if (timelineItem.title.startsWith("Choice:") && timelineItem.choiceId) {
        // Toggle choice status
        const newChoiceStatus = newCompletionState ? ChoiceStatus.CLOSED : ChoiceStatus.OPEN;
        await tx.choice.update({
          where: { id: timelineItem.choiceId },
          data: { status: newChoiceStatus },
        });
        console.log(`[timeline-toggle] Synced Choice ${timelineItem.choiceId} status to ${newChoiceStatus}`);
      }

      return updatedItem;
    });

    console.log(
      `[timeline-toggle] ${newCompletionState ? 'Completed' : 'Uncompleted'} milestone "${timelineItem.title}" (MANUAL) for trip ${tripId}`
    );

    return NextResponse.json({
      success: true,
      timelineItem: {
        id: result.id,
        isCompleted: result.isCompleted,
        completedAt: result.completedAt,
        triggerType: result.triggerType,
      },
    });
  } catch (error) {
    console.error("Error toggling milestone:", error);
    return NextResponse.json(
      { error: "Failed to toggle milestone" },
      { status: 500 }
    );
  }
}
