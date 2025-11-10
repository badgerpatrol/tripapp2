import { NextRequest, NextResponse } from "next/server";
import { listActiveSequences } from "@/server/services/sequence";

/**
 * GET /api/sequences
 * Lists all active sequences available to users.
 */
export async function GET(request: NextRequest) {
  try {
    const sequences = await listActiveSequences();
    return NextResponse.json({ sequences }, { status: 200 });
  } catch (error) {
    console.error("Error listing sequences:", error);
    return NextResponse.json(
      { error: "Failed to list sequences. Please try again." },
      { status: 500 }
    );
  }
}
