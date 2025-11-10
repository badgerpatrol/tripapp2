import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { startSequenceRun } from "@/server/services/sequence";

/**
 * POST /api/sequences/runs
 * Starts a new sequence run for the authenticated user.
 * Body: { sequenceId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // 2. Parse and validate request body
    const body = await request.json();
    const { sequenceId } = body;

    if (!sequenceId || typeof sequenceId !== "string") {
      return NextResponse.json(
        { success: false, error: "sequenceId is required" },
        { status: 400 }
      );
    }

    // 3. Start sequence run
    const run = await startSequenceRun({
      sequenceId,
      userId: auth.uid,
    });

    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error) {
    console.error("Error starting sequence run:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start sequence run.",
      },
      { status: 500 }
    );
  }
}
