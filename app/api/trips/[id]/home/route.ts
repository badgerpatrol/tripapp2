/**
 * API Route: /api/trips/:id/home
 * Get trip home dashboard summary
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { getTripHomeSummary } from "@/server/services/tripHome";

/**
 * GET /api/trips/:id/home
 * Get aggregated dashboard data for trip home
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

    const summary = await getTripHomeSummary(tripId, auth.uid);

    return NextResponse.json(summary, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/trips/:id/home error:", error);

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    if (error.message?.includes("Forbidden") || error.message?.includes("not a member")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch trip home data" },
      { status: 500 }
    );
  }
}
