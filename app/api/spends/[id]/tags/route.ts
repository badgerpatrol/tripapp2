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
 * GET /api/spends/[id]/tags - Get all tags for a spend
 *
 * Authorization: User must be a member of the trip that owns this spend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { id: spendId } = await params;

    // 2. Authorize - verify user is a member of the trip
    await requireTripMemberForEntity(auth.uid, TagEntityType.spend, spendId);

    // 3. Get tags for this spend
    const tags = await listTagsForEntity(TagEntityType.spend, spendId);

    return NextResponse.json(
      {
        success: true,
        tags,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching spend tags:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        );
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch tags",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spends/[id]/tags - Link a tag to a spend
 *
 * Authorization: User must be a member of the trip that owns this spend
 * Body: { tagId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { id: spendId } = await params;

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = TagLinkCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { tagId } = validationResult.data;

    // 3. Authorize - verify user is a member of the trip
    await requireTripMemberForEntity(auth.uid, TagEntityType.spend, spendId);

    // 4. Link the tag
    const link = await linkTag(
      tagId,
      TagEntityType.spend,
      spendId,
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
    console.error("Error linking tag to spend:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        );
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link tag",
      },
      { status: 500 }
    );
  }
}
