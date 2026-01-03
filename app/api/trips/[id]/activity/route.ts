/**
 * API Route: /api/trips/:id/activity
 * Get recent activity feed for a trip
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { getTripActivity, getUserActionPrompts } from "@/server/services/tripHome";

/**
 * GET /api/trips/:id/activity
 * Get recent activity feed and action prompts
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

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Fetch activity and prompts in parallel
    const [activities, prompts] = await Promise.all([
      getTripActivity(tripId, auth.uid, limit),
      getUserActionPrompts(tripId, auth.uid),
    ]);

    return NextResponse.json(
      {
        activities,
        prompts,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("GET /api/trips/:id/activity error:", error);

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
      { error: "Failed to fetch trip activity" },
      { status: 500 }
    );
  }
}
