/**
 * API Routes: /api/trips/:tripId/choices
 * A1. Create a Choice (POST)
 * A6. Get all Choices for a Trip (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { TripMemberRole } from "@/lib/generated/prisma";
import { CreateChoiceSchema, GetChoicesQuerySchema } from "@/types/schemas";
import { createChoice, getTripChoices } from "@/server/services/choices";

/**
 * GET /api/trips/:tripId/choices
 * Get all choices for a trip
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
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { id } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = GetChoicesQuerySchema.parse({
      includeClosed: searchParams.get("includeClosed") || "false",
      includeArchived: searchParams.get("includeArchived") || "false",
    });

    const choices = await getTripChoices(tripId, {
      includeClosed: query.includeClosed,
      includeArchived: query.includeArchived,
    });

    return NextResponse.json(choices, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/choices error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch choices" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips/:tripId/choices
 * Create a new choice (organiser only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { id } = await params;
    const tripId = id;

    // Verify user is at least ADMIN (organisers can create choices)
    await requireTripMember(auth.uid, tripId, TripMemberRole.ADMIN);

    const body = await request.json();
    const data = CreateChoiceSchema.parse(body);

    const choice = await createChoice(auth.uid, tripId, data);

    return NextResponse.json(choice, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/trips/:id/choices error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create choice" },
      { status: 500 }
    );
  }
}
