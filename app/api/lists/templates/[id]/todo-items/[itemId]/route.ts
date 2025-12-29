import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { updateTodoItem, deleteTodoItemFromTemplate } from "@/server/services/lists";
import { TodoItemUpdateSchema } from "@/types/schemas";

/**
 * PATCH /api/lists/templates/:id/todo-items/:itemId
 * Update a single todo item
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
    const validation = TodoItemUpdateSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid item data" },
        { status: 400 }
      );
    }

    const { id: templateId, itemId } = await params;
    const item = await updateTodoItem(auth.uid, templateId, itemId, validation.data);

    return NextResponse.json({ item }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating todo item:", message);
    if (message === "Item not found" || message === "Template not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: message || "Failed to update item" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lists/templates/:id/todo-items/:itemId
 * Delete a single todo item from a list
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
    await deleteTodoItemFromTemplate(auth.uid, templateId, itemId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error deleting todo item:", message);
    if (message === "Item not found" || message === "Template not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: message || "Failed to delete item" },
      { status: 500 }
    );
  }
}
