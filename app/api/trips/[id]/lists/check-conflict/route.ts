import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CheckConflictSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["TODO", "KIT"]),
});

/**
 * GET /api/trips/:id/lists/check-conflict?title=...&type=...
 * Check if a list with the given title and type already exists on the trip
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
    const queryValidation = CheckConflictSchema.safeParse({
      title: searchParams.get("title"),
      type: searchParams.get("type"),
    });

    if (!queryValidation.success) {
      const firstError = queryValidation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid query parameters" },
        { status: 400 }
      );
    }

    const tripId = (await params).id;
    const { title, type } = queryValidation.data;

    // Check if a list with this title and type exists on the trip
    const existingList = await prisma.listTemplate.findFirst({
      where: {
        tripId,
        title,
        type,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json(
      {
        exists: !!existingList,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error checking list conflict:", error);
    if (error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes("Authentication required")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to check list conflict" },
      { status: 500 }
    );
  }
}
