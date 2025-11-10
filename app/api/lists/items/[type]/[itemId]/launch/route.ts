import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { launchItemAction } from "@/server/services/lists";

/**
 * POST /api/lists/items/:type/:itemId/launch
 * Launch the action associated with a TODO item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; itemId: string }> }
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

    const { type, itemId } = await params;

    // Only TODO items support actions
    if (type !== "TODO") {
      return NextResponse.json(
        { error: "Only TODO items support actions" },
        { status: 400 }
      );
    }

    const deepLink = await launchItemAction(auth.uid, itemId);

    return NextResponse.json({ deepLink }, { status: 200 });
  } catch (error: any) {
    console.error("Error launching item action:", error);
    if (error.message === "Item not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to launch item action" },
      { status: 500 }
    );
  }
}
