import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { createTripListAdHoc } from "@/server/services/lists";
import { CreateAdHocListSchema } from "@/types/schemas";

/**
 * POST /api/lists/instances
 * Create an ad-hoc list in a trip (without a source template)
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
    const validation = CreateAdHocListSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const list = await createTripListAdHoc(auth.uid, validation.data);

    return NextResponse.json(
      {
        instance: {
          ...list,
          listType: list.type,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating trip list:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create trip list" },
      { status: 500 }
    );
  }
}
