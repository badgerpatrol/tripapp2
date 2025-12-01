/**
 * API Routes: /api/trips/:tripId/transport
 * GET - Get all transport offers and requirements for a trip
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { getTripTransport } from "@/server/services/transport";

/**
 * GET /api/trips/:tripId/transport
 * Get all transport data (offers and requirements) for a trip
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

    const transport = await getTripTransport(tripId);

    return NextResponse.json(transport, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/transport error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch transport data" },
      { status: 500 }
    );
  }
}
