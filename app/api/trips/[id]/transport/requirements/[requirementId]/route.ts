/**
 * API Routes: /api/trips/:tripId/transport/requirements/:requirementId
 * GET - Get a single transport requirement
 * PATCH - Update a transport requirement
 * DELETE - Delete a transport requirement
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { UpdateTransportRequirementSchema } from "@/types/schemas";
import {
  getTransportRequirement,
  updateTransportRequirement,
  deleteTransportRequirement,
} from "@/server/services/transport";

/**
 * GET /api/trips/:tripId/transport/requirements/:requirementId
 * Get a single transport requirement
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requirementId: string }> }
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

    const { id, requirementId } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    const requirement = await getTransportRequirement(requirementId);

    // Verify requirement belongs to this trip
    if (requirement.tripId !== tripId) {
      return NextResponse.json(
        { error: "Transport requirement not found in this trip" },
        { status: 404 }
      );
    }

    return NextResponse.json({ requirement }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/transport/requirements/:requirementId error:", error);

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
      { error: error.message || "Failed to fetch transport requirement" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/trips/:tripId/transport/requirements/:requirementId
 * Update a transport requirement (only by owner)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requirementId: string }> }
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

    const { id, requirementId } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    const body = await request.json();
    const data = UpdateTransportRequirementSchema.parse(body);

    const requirement = await updateTransportRequirement(requirementId, auth.uid, data);

    // Verify requirement belongs to this trip
    if (requirement.tripId !== tripId) {
      return NextResponse.json(
        { error: "Transport requirement not found in this trip" },
        { status: 404 }
      );
    }

    return NextResponse.json({ requirement }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/trips/:id/transport/requirements/:requirementId error:", error);

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
      { error: error.message || "Failed to update transport requirement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/:tripId/transport/requirements/:requirementId
 * Delete a transport requirement (only by owner)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requirementId: string }> }
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

    const { id, requirementId } = await params;
    const tripId = id;

    // Verify user is a trip member
    await requireTripMember(auth.uid, tripId);

    // First get the requirement to verify it belongs to this trip
    const requirement = await getTransportRequirement(requirementId);
    if (requirement.tripId !== tripId) {
      return NextResponse.json(
        { error: "Transport requirement not found in this trip" },
        { status: 404 }
      );
    }

    await deleteTransportRequirement(requirementId, auth.uid);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("DELETE /api/trips/:id/transport/requirements/:requirementId error:", error);

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
      { error: error.message || "Failed to delete transport requirement" },
      { status: 500 }
    );
  }
}
