/**
 * API Routes: /api/trips/:tripId/transport/requirements
 * POST - Create a transport requirement
 * GET - List all transport requirements for a trip
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { CreateTransportRequirementSchema } from "@/types/schemas";
import { createTransportRequirement, getTripTransportRequirements } from "@/server/services/transport";

/**
 * GET /api/trips/:tripId/transport/requirements
 * Get all transport requirements for a trip
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

    const requirements = await getTripTransportRequirements(tripId);

    return NextResponse.json({ requirements }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/transport/requirements error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch transport requirements" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips/:tripId/transport/requirements
 * Create a new transport requirement
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

    // Verify user is a trip member (any member can create requirements)
    await requireTripMember(auth.uid, tripId);

    const body = await request.json();
    const data = CreateTransportRequirementSchema.parse(body);

    const requirement = await createTransportRequirement(auth.uid, tripId, data);

    return NextResponse.json({ requirement }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/trips/:id/transport/requirements error:", error);

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
      { error: error.message || "Failed to create transport requirement" },
      { status: 500 }
    );
  }
}
