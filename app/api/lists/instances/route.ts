import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { createInstanceAdHoc } from "@/server/services/lists";
import { CreateAdHocListSchema } from "@/types/schemas";

/**
 * POST /api/lists/instances
 * Create an ad-hoc list instance (without a template)
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

    const instance = await createInstanceAdHoc(auth.uid, validation.data);

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
    console.error("Error creating list instance:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create list instance" },
      { status: 500 }
    );
  }
}
