import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { activateStep, getRun, getNextPendingStep } from "@/server/services/sequence";

/**
 * POST /api/sequences/runs/:runId/steps/:runStepId/activate
 * Activates a step in a sequence run.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; runStepId: string }> }
) {
  try {
    const { runId, runStepId } = await params;

    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    // 2. Verify run ownership
    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    if (run.userId !== auth.uid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 3. Activate the step
    await activateStep(runStepId);

    // 4. Return updated state
    const updatedRun = await getRun(runId);
    const nextStep = getNextPendingStep(updatedRun);

    return NextResponse.json({ success: true, run: updatedRun, nextStep }, { status: 200 });
  } catch (error) {
    console.error("Error activating step:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate step." },
      { status: 500 }
    );
  }
}
