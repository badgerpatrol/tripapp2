import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { createTemplate, listMyTemplates } from "@/server/services/lists";
import { ListTemplateCreate } from "@/types/schemas";

/**
 * GET /api/lists/templates
 * Get all templates owned by the authenticated user
 */
export async function GET(request: NextRequest) {
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

    const templates = await listMyTemplates(auth.uid);

    return NextResponse.json(
      {
        templates: templates.map((t) => ({
          ...t,
          listType: t.type, // Include listType for UI rendering
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error getting templates:", error);
    return NextResponse.json(
      { error: "Failed to get templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lists/templates
 * Create a new list template
 */
export async function POST(request: NextRequest) {
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
    console.log("Received body:", JSON.stringify(body, null, 2));

    const validation = ListTemplateCreate.safeParse(body);

    if (!validation.success) {
      console.error("Validation error:", validation.error);
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid template data", issues: validation.error.issues },
        { status: 400 }
      );
    }

    console.log("Creating template with data:", validation.data);
    const template = await createTemplate(auth.uid, validation.data);

    return NextResponse.json(
      {
        template: {
          ...template,
          listType: template.type,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
