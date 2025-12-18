import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { deleteKitItem } from "@/server/services/lists";

/**
 * DELETE /api/lists/items/KIT/:itemId
 * Delete a kit item from a list instance.
 *
 * For per-person items: Only deletes the current user's tick, leaving the item for others.
 * For shared items: Only trip organizers can delete, and only if no one has ticked it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
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

    const { itemId } = await params;

    const result = await deleteKitItem(auth.uid, itemId);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting kit item:", error);
    if (error.message === "Item not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden") || error.message.includes("Cannot delete")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete kit item" },
      { status: 500 }
    );
  }
}
