import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { addKitItem } from "@/server/services/lists";
import { z } from "zod";

const AddKitItemSchema = z.object({
  label: z.string().min(1, "Label is required"),
  notes: z.string().optional(),
  quantity: z.number().optional(),
  orderIndex: z.number().optional(),
  perPerson: z.boolean().optional(),
});

/**
 * POST /api/lists/templates/:id/kit-items
 * Add a single kit item to a template/trip list
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const validation = AddKitItemSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid item data" },
        { status: 400 }
      );
    }

    const { id: templateId } = await params;
    const item = await addKitItem(auth.uid, templateId, validation.data);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding kit item:", error?.message || error);
    if (error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to add item" },
      { status: 500 }
    );
  }
}
