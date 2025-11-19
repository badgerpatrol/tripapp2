import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { listAllTags, createTag, normalizeToSlug } from "@/server/services/tags";
import { TagCreateSchema } from "@/types/tag";

/**
 * GET /api/tags - Get all tags in the system
 *
 * Authorization: User must be authenticated
 * Returns: Array of all tags, sorted by usage count (descending) then name
 */
export async function GET(request: NextRequest) {
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

    // 2. Get all tags
    const tags = await listAllTags();

    return NextResponse.json(
      {
        success: true,
        tags,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching tags:", error);
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
 * POST /api/tags - Create a new tag
 *
 * Authorization: User must be authenticated
 * Body: { name: string }
 * Returns: Created tag object (or 409 if slug already exists)
 */
export async function POST(request: NextRequest) {
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

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = TagCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { name } = validationResult.data;

    // 3. Check if tag with this slug already exists
    const slug = normalizeToSlug(name);
    const tag = await createTag(name, auth.uid);

    // Check if this was an existing tag (slug match)
    if (tag.slug === slug && tag.name !== name.trim()) {
      // Tag with this slug already exists
      return NextResponse.json(
        {
          success: false,
          error: "A tag with a similar name already exists",
          existingTag: tag,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        tag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create tag",
      },
      { status: 500 }
    );
  }
}
