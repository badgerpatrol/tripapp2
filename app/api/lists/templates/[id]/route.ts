import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/server/services/lists";
import { ListTemplateUpdate } from "@/types/schemas";

/**
 * GET /api/lists/templates/:id
 * Get a single template by ID
 */
export async function GET(
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

    const { id } = await params;
    const template = await getTemplate(auth.uid, id);

    return NextResponse.json(
      {
        template: {
          ...template,
          listType: template.type,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error getting template:", error);
    if (error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to get template" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/lists/templates/:id
 * Update a template (owner only)
 */
export async function PATCH(
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
    const validation = ListTemplateUpdate.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid template data" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const template = await updateTemplate(auth.uid, id, validation.data);

    return NextResponse.json(
      {
        template: {
          ...template,
          listType: template.type,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating template:", error);
    if (error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lists/templates/:id
 * Delete a template (owner only)
 */
export async function DELETE(
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

    const { id } = await params;
    await deleteTemplate(auth.uid, id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    if (error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
