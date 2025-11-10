import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { completeRun, getRun } from "@/server/services/sequence";

/**
 * POST /api/sequences/runs/:runId/complete
 * Marks a sequence run as completed.
 */
export async function POST(
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

    // 3. Complete the run
    const updatedRun = await completeRun(runId);

    return NextResponse.json({ success: true, run: updatedRun }, { status: 200 });
  } catch (error) {
    console.error("Error completing run:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete run." },
      { status: 500 }
    );
  }
}
