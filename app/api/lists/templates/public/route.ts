import { NextRequest, NextResponse } from "next/server";
import { browsePublicTemplates } from "@/server/services/lists";
import { BrowsePublicTemplatesQuerySchema } from "@/types/schemas";

/**
 * GET /api/lists/templates/public
 * Browse public templates (no auth required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = BrowsePublicTemplatesQuerySchema.parse({
      query: searchParams.get("query") ?? undefined,
      tags: searchParams.get("tags")
        ? searchParams.get("tags")!.split(",")
        : undefined,
      type: searchParams.get("type") ?? undefined,
    });

    const templates = await browsePublicTemplates(query);

    return NextResponse.json(
      {
        templates: templates.map((t) => ({
          ...t,
          listType: t.type,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error browsing public templates:", error);
    return NextResponse.json(
      { error: "Failed to browse templates" },
      { status: 500 }
    );
  }
}
