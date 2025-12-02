import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trips/:id/ticks
 * Get tick statistics for a trip - used for the tick report
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);
    const { id: tripId } = await params;

    // Verify trip membership
    await requireTripMember(auth.uid, tripId);

    // Get all list instances for this trip
    const listInstances = await prisma.listInstance.findMany({
      where: { tripId },
      select: { id: true },
    });

    const listIds = listInstances.map((l) => l.id);

    // Get all ticks for items in these lists
    const ticks = await prisma.itemTick.findMany({
      where: {
        OR: [
          {
            todoItem: {
              listId: { in: listIds },
            },
          },
          {
            kitItem: {
              listId: { in: listIds },
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
        todoItem: {
          select: {
            id: true,
            label: true,
            perPerson: true,
            list: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
        kitItem: {
          select: {
            id: true,
            label: true,
            perPerson: true,
            list: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get trip members for context
    const members = await prisma.tripMember.findMany({
      where: { tripId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            photoURL: true,
          },
        },
      },
    });

    // Calculate statistics per user
    const userStats: Record<string, {
      userId: string;
      displayName: string;
      photoURL: string | null;
      totalTicks: number;
      sharedTicks: number;
      perPersonTicks: number;
    }> = {};

    // Initialize all members
    for (const member of members) {
      userStats[member.userId] = {
        userId: member.userId,
        displayName: member.user.displayName,
        photoURL: member.user.photoURL,
        totalTicks: 0,
        sharedTicks: 0,
        perPersonTicks: 0,
      };
    }

    // Count ticks
    for (const tick of ticks) {
      if (!userStats[tick.userId]) {
        userStats[tick.userId] = {
          userId: tick.userId,
          displayName: tick.user.displayName,
          photoURL: tick.user.photoURL,
          totalTicks: 0,
          sharedTicks: 0,
          perPersonTicks: 0,
        };
      }

      userStats[tick.userId].totalTicks++;
      if (tick.isShared) {
        userStats[tick.userId].sharedTicks++;
      } else {
        userStats[tick.userId].perPersonTicks++;
      }
    }

    // Get shared items that have been ticked (for the report showing who ticked shared items)
    const sharedTicks = ticks.filter((t) => t.isShared);

    return NextResponse.json({
      ticks,
      userStats: Object.values(userStats),
      sharedTicks,
      members: members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        photoURL: m.user.photoURL,
        role: m.role,
      })),
    });
  } catch (error: any) {
    console.error("Error getting trip ticks:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to get trip ticks" },
      { status: 500 }
    );
  }
}
