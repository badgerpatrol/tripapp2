import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { updateTimelineItemDate, deleteTimelineItem } from "@/server/services/trips";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const { id: tripId, itemId } = await params;

    // Parse request body
    const body = await request.json();
    const { date } = body;

    if (date === undefined) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      );
    }

    // Update the timeline item using service function
    const updatedItem = await updateTimelineItemDate(
      tripId,
      itemId,
      auth.uid,
      date ? new Date(date) : null
    );

    return NextResponse.json({
      success: true,
      timelineItem: updatedItem,
    });
  } catch (error: any) {
    console.error("Error updating timeline item:", error);

    if (error.message === "Unauthorized" || error.message === "Missing authorization token") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message === "You are not a member of this trip" ||
        error.message === "Only trip organizers can edit timeline items") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message === "Timeline item not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update timeline item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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

    const { id: tripId, itemId } = await params;

    // Delete the timeline item using service function
    await deleteTimelineItem(tripId, itemId, auth.uid);

    return NextResponse.json({
      success: true,
      message: "Timeline item deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting timeline item:", error);

    if (error.message === "Unauthorized" || error.message === "Missing authorization token") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message === "You are not a member of this trip" ||
        error.message === "Only trip organizers can delete timeline items") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message === "Timeline item not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete timeline item" },
      { status: 500 }
    );
  }
}
