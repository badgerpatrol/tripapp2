import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { getRun, getNextPendingStep } from "@/server/services/sequence";

/**
 * GET /api/sequences/runs/:runId
 * Gets a sequence run with its current state and next pending step.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    // 2. Get run
    const run = await getRun(runId);

    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    // 3. Check authorization - user must own this run
    if (run.userId !== auth.uid) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 4. Calculate next step
    const nextStep = getNextPendingStep(run);

    return NextResponse.json({ run, nextStep }, { status: 200 });
  } catch (error) {
    console.error("Error getting run:", error);
    return NextResponse.json(
      { error: "Failed to get run. Please try again." },
      { status: 500 }
    );
  }
}
