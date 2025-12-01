/**
 * API Routes: /api/trips/:tripId/transport/offers
 * POST - Create a transport offer
 * GET - List all transport offers for a trip
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { CreateTransportOfferSchema } from "@/types/schemas";
import { createTransportOffer, getTripTransportOffers } from "@/server/services/transport";

/**
 * GET /api/trips/:tripId/transport/offers
 * Get all transport offers for a trip
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

    const offers = await getTripTransportOffers(tripId);

    return NextResponse.json({ offers }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/transport/offers error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch transport offers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips/:tripId/transport/offers
 * Create a new transport offer
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

    // Verify user is a trip member (any member can create offers)
    await requireTripMember(auth.uid, tripId);

    const body = await request.json();
    const data = CreateTransportOfferSchema.parse(body);

    const offer = await createTransportOffer(auth.uid, tripId, data);

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/trips/:id/transport/offers error:", error);

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
      { error: error.message || "Failed to create transport offer" },
      { status: 500 }
    );
  }
}
