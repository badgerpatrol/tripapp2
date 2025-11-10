import { NextRequest, NextResponse } from "next/server";
import { browseTripTemplates } from "@/server/services/lists";

/**
 * GET /api/lists/templates/trip-templates
 * Browse trip templates (templates marked as trip templates)
 * No auth required - returns public trip templates
 */
export async function GET(request: NextRequest) {
  try {
    const templates = await browseTripTemplates();

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
    console.error("Error browsing trip templates:", error);
    return NextResponse.json(
      { error: "Failed to browse trip templates" },
      { status: 500 }
    );
  }
}
