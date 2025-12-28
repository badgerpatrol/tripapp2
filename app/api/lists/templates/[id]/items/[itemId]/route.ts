import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { updateKitItem, deleteKitItemFromTemplate } from "@/server/services/lists";
import { KitItemUpdateSchema } from "@/types/schemas";

/**
 * PATCH /api/lists/templates/:id/items/:itemId
 * Update a single kit item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const body = await request.json();
    const validation = KitItemUpdateSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid item data" },
        { status: 400 }
      );
    }

    const { id: templateId, itemId } = await params;
    const item = await updateKitItem(auth.uid, templateId, itemId, validation.data);

    return NextResponse.json({ item }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating kit item:", error?.message || error);
    if (error.message === "Item not found" || error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to update item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lists/templates/:id/items/:itemId
 * Delete a single kit item from a template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const { id: templateId, itemId } = await params;
    await deleteKitItemFromTemplate(auth.uid, templateId, itemId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting kit item:", error?.message || error);
    if (error.message === "Item not found" || error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete item" },
      { status: 500 }
    );
  }
}
