import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { completeStep, getRun, getNextPendingStep, updateRunPayload } from "@/server/services/sequence";

/**
 * POST /api/sequences/runs/:runId/steps/:runStepId/complete
 * Completes a step in a sequence run.
 * Body: { result?: any, payloadPatch?: Record<string, any> }
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

    // 3. Parse request body
    const body = await request.json().catch(() => ({}));
    const { result, payloadPatch } = body;

    // 4. Update payload if provided
    if (payloadPatch && typeof payloadPatch === "object") {
      await updateRunPayload(runId, payloadPatch);
    }

    // 5. Complete the step
    await completeStep(runStepId, result);

    // 6. Return updated state
    const updatedRun = await getRun(runId);
    const nextStep = getNextPendingStep(updatedRun);

    return NextResponse.json({ success: true, run: updatedRun, nextStep }, { status: 200 });
  } catch (error) {
    console.error("Error completing step:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete step." },
      { status: 500 }
    );
  }
}
