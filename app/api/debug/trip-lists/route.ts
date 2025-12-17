import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

/**
 * DEBUG ONLY: Check trip lists setup
 * GET /api/debug/trip-lists?tripId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("tripId");

    if (!tripId) {
      return NextResponse.json(
        { error: "tripId query parameter required" },
        { status: 400 }
      );
    }

    // Check if trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { members: true },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    // Check trip lists (ListTemplates with tripId set)
    const tripLists = await prisma.listTemplate.findMany({
      where: { tripId },
      include: {
        todoItems: { orderBy: { orderIndex: "asc" } },
        kitItems: { orderBy: { orderIndex: "asc" } },
      },
    });

    // Check public templates
    const templates = await prisma.listTemplate.findMany({
      where: { visibility: "PUBLIC", tripId: null },
      take: 5,
    });

    return NextResponse.json({
      trip: {
        id: trip.id,
        name: trip.name,
        memberCount: trip.members.length,
      },
      tripLists: {
        count: tripLists.length,
        lists: tripLists.map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          itemCount: l.type === "TODO" ? l.todoItems.length : l.kitItems.length,
        })),
      },
      publicTemplates: {
        count: templates.length,
        templates: templates.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
