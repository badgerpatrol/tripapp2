import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { createTimelineItem } from "@/server/services/trips";
import { z } from "zod";

const CreateTimelineItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.string().optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    const { id: tripId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateTimelineItemSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid request data" },
        { status: 400 }
      );
    }

    const { title, description, date } = validation.data;

    // Validate date is in the future if provided
    if (date) {
      const milestoneDate = new Date(date);
      if (milestoneDate <= new Date()) {
        return NextResponse.json(
          { error: "Milestone date must be in the future" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Milestone date is required" },
        { status: 400 }
      );
    }

    // Create the timeline item using service function
    const timelineItem = await createTimelineItem(tripId, auth.uid, {
      title,
      description,
      date: date ? new Date(date) : null,
    });

    return NextResponse.json(
      {
        success: true,
        timelineItem,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating timeline item:", error);

    if (error.message === "Unauthorized" || error.message === "Missing authorization token") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message === "You are not a member of this trip" ||
        error.message === "Only trip organizers can create timeline items") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create timeline item" },
      { status: 500 }
    );
  }
}
