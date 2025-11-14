import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { listTripInstances } from "@/server/services/lists";
import { ListTripInstancesQuerySchema } from "@/types/schemas";

/**
 * GET /api/trips/:id/lists
 * Get all list instances for a trip
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

    const { searchParams } = new URL(request.url);
    const queryValidation = ListTripInstancesQuerySchema.safeParse({
      type: searchParams.get("type") ?? undefined,
      completionStatus: searchParams.get("completionStatus") ?? undefined,
    });

    if (!queryValidation.success) {
      const firstError = queryValidation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid query parameters" },
        { status: 400 }
      );
    }

    const instances = await listTripInstances(auth.uid, (await params).id, queryValidation.data);

    return NextResponse.json(
      {
        instances: instances.map((i) => ({
          ...i,
          listType: i.type,
        })),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error getting trip lists:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes("Authentication required")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to get trip lists" },
      { status: 500 }
    );
  }
}
