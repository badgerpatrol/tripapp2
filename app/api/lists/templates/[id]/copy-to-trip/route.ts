import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { copyTemplateToTrip } from "@/server/services/lists";
import { CopyToTripSchema } from "@/types/schemas";

/**
 * POST /api/lists/templates/:id/copy-to-trip
 * Copy a template to a trip
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
    const validation = CopyToTripSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const instance = await copyTemplateToTrip(
      auth.uid,
      (await params).id,
      validation.data
    );

    return NextResponse.json(
      {
        instance: {
          ...instance,
          listType: instance.type,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error copying template to trip:", error);
    if (error.message === "Template not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to copy template to trip" },
      { status: 500 }
    );
  }
}
