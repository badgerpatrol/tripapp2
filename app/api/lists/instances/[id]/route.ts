import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { deleteTripList } from "@/server/services/lists";

/**
 * DELETE /api/lists/instances/:id
 * Delete a trip list
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
    await deleteTripList(auth.uid, id);

    return NextResponse.json(
      { success: true, message: "List deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting trip list:", error);
    if (error.message.includes("Forbidden") || error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete trip list" },
      { status: 500 }
    );
  }
}
