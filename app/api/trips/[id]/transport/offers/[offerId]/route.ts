/**
 * API Routes: /api/trips/:tripId/transport/offers/:offerId
 * GET - Get a single transport offer
 * PATCH - Update a transport offer
 * DELETE - Delete a transport offer
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { UpdateTransportOfferSchema } from "@/types/schemas";
import {
  getTransportOffer,
  updateTransportOffer,
  deleteTransportOffer,
} from "@/server/services/transport";

/**
 * GET /api/trips/:tripId/transport/offers/:offerId
 * Get a single transport offer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
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

    const { id, offerId } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    const offer = await getTransportOffer(offerId);

    // Verify offer belongs to this trip
    if (offer.tripId !== tripId) {
      return NextResponse.json(
        { error: "Transport offer not found in this trip" },
        { status: 404 }
      );
    }

    return NextResponse.json({ offer }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/transport/offers/:offerId error:", error);

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch transport offer" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/trips/:tripId/transport/offers/:offerId
 * Update a transport offer (only by owner)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
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

    const { id, offerId } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    const body = await request.json();
    const data = UpdateTransportOfferSchema.parse(body);

    const offer = await updateTransportOffer(offerId, auth.uid, data);

    // Verify offer belongs to this trip
    if (offer.tripId !== tripId) {
      return NextResponse.json(
        { error: "Transport offer not found in this trip" },
        { status: 404 }
      );
    }

    return NextResponse.json({ offer }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/trips/:id/transport/offers/:offerId error:", error);

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error.message?.includes("only") || error.message?.includes("Forbidden")) {
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
      { error: error.message || "Failed to update transport offer" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/:tripId/transport/offers/:offerId
 * Delete a transport offer (only by owner)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
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

    const { id, offerId } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    // First get the offer to verify it belongs to this trip
    const offer = await getTransportOffer(offerId);
    if (offer.tripId !== tripId) {
      return NextResponse.json(
        { error: "Transport offer not found in this trip" },
        { status: 404 }
      );
    }

    await deleteTransportOffer(offerId, auth.uid);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("DELETE /api/trips/:id/transport/offers/:offerId error:", error);

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error.message?.includes("only") || error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete transport offer" },
      { status: 500 }
    );
  }
}
