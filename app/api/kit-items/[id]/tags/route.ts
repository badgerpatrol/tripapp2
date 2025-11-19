import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import {
  requireTripMemberForEntity,
  listTagsForEntity,
  linkTag,
} from "@/server/services/tagLinks";
import { TagEntityType } from "@/lib/generated/prisma";
import { TagLinkCreateSchema } from "@/types/tag";

/**
 * GET /api/kit-items/[id]/tags - Get all tags for a kit item
 *
 * Authorization: User must be a member of the trip that owns this kit item
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
    const { id: kitItemId } = await params;

    await requireTripMemberForEntity(auth.uid, TagEntityType.kit_item, kitItemId);

    const tags = await listTagsForEntity(TagEntityType.kit_item, kitItemId);

    return NextResponse.json({ success: true, tags }, { status: 200 });
  } catch (error) {
    console.error("Error fetching kit item tags:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kit-items/[id]/tags - Link a tag to a kit item
 *
 * Authorization: User must be a member of the trip that owns this kit item
 * Body: { tagId: string }
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
    const { id: kitItemId } = await params;

    const body = await request.json();
    const validationResult = TagLinkCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { tagId } = validationResult.data;

    await requireTripMemberForEntity(auth.uid, TagEntityType.kit_item, kitItemId);

    const link = await linkTag(
      tagId,
      TagEntityType.kit_item,
      kitItemId,
      auth.uid
    );

    return NextResponse.json(
      {
        success: true,
        link: {
          id: link.id,
          tagId: link.tagId,
          entityType: link.entityType,
          entityId: link.entityId,
          createdAt: link.createdAt,
          tag: link.tag,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error linking tag to kit item:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 404 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to link tag" },
      { status: 500 }
    );
  }
}
