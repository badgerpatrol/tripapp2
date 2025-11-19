import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { requireTripMemberForEntity, unlinkTag } from "@/server/services/tagLinks";
import { TagEntityType } from "@/lib/generated/prisma";

/**
 * DELETE /api/kit-items/[id]/tags/[tagId] - Unlink a tag from a kit item
 *
 * Authorization: User must be a member of the trip that owns this kit item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
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
    const { id: kitItemId, tagId } = await params;

    await requireTripMemberForEntity(auth.uid, TagEntityType.kit_item, kitItemId);

    await unlinkTag(tagId, TagEntityType.kit_item, kitItemId, auth.uid);

    return NextResponse.json(
      { success: true, message: "Tag unlinked successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error unlinking tag from kit item:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to unlink tag" },
      { status: 500 }
    );
  }
}
