import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { toggleItemState } from "@/server/services/lists";
import { ToggleItemStateSchema, ListTypeSchema } from "@/types/schemas";

/**
 * PATCH /api/lists/items/:type/:itemId/toggle
 * Toggle the state of a list item (done/packed)
 */
export async function PATCH(
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

    // Validate list type
    const typeValidation = ListTypeSchema.safeParse(type);
    if (!typeValidation.success) {
      return NextResponse.json(
        { error: "Invalid list type" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = ToggleItemStateSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid data" },
        { status: 400 }
      );
    }

    await toggleItemState(
      auth.uid,
      typeValidation.data,
      itemId,
      validation.data.state
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error toggling item state:", error);
    if (error.message === "Item not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to toggle item state" },
      { status: 500 }
    );
  }
}
