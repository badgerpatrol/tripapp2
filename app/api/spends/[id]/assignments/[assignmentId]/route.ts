import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { updateAssignment, deleteAssignment } from "@/server/services/assignments";

/**
 * PUT /api/spends/:id/assignments/:assignmentId
 * Update an individual assignment amount
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id: spendId, assignmentId } = await params;

    // Authenticate user
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { shareAmount, normalizedShareAmount, splitType } = body;

    // Validate required fields
    if (shareAmount === undefined || normalizedShareAmount === undefined) {
      return NextResponse.json(
        { error: "shareAmount and normalizedShareAmount are required" },
        { status: 400 }
      );
    }

    // Validate amounts are non-negative
    if (shareAmount < 0 || normalizedShareAmount < 0) {
      return NextResponse.json(
        { error: "Amounts cannot be negative" },
        { status: 400 }
      );
    }

    // Update the assignment
    const updatedAssignment = await updateAssignment(
      assignmentId,
      currentUserId,
      {
        shareAmount,
        normalizedShareAmount,
        splitType: splitType || "EXACT",
      }
    );

    return NextResponse.json(
      { assignment: updatedAssignment },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating assignment:", error);

    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.message.includes("unauthorized") || error.message.includes("permission")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message.includes("closed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/spends/:id/assignments/:assignmentId
 * Remove a user from a spend by deleting their assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id: spendId, assignmentId } = await params;

    // Authenticate user
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const currentUserId = decodedToken.uid;

    // Delete the assignment
    await deleteAssignment(assignmentId, currentUserId);

    return NextResponse.json(
      { message: "Assignment deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting assignment:", error);

    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.message.includes("unauthorized") || error.message.includes("permission")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message.includes("closed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
