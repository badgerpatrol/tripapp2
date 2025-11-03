import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader } from "@/server/authz";
import { createAssignments, replaceAssignments } from "@/server/services/assignments";
import { SplitType } from "@/lib/generated/prisma";

/**
 * POST /api/spends/:id/assignments
 * Creates or replaces assignments for a spend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spendId } = await params;
    const body = await request.json();

    const {
      assignments,
      replaceAll = false,
    }: {
      assignments: Array<{
        userId: string;
        shareAmount: number;
        normalizedShareAmount: number;
        splitType: SplitType;
        splitValue?: number;
      }>;
      replaceAll?: boolean;
    } = body;

    // Validate assignments array
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { error: "Assignments array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate each assignment
    for (const assignment of assignments) {
      if (!assignment.userId) {
        return NextResponse.json(
          { error: "Each assignment must have a userId" },
          { status: 400 }
        );
      }
      if (typeof assignment.shareAmount !== "number" || assignment.shareAmount < 0) {
        return NextResponse.json(
          { error: "Each assignment must have a valid shareAmount >= 0" },
          { status: 400 }
        );
      }
      if (
        typeof assignment.normalizedShareAmount !== "number" ||
        assignment.normalizedShareAmount < 0
      ) {
        return NextResponse.json(
          { error: "Each assignment must have a valid normalizedShareAmount >= 0" },
          { status: 400 }
        );
      }
      if (!assignment.splitType) {
        return NextResponse.json(
          { error: "Each assignment must have a splitType" },
          { status: 400 }
        );
      }
    }

    let created;
    if (replaceAll) {
      // Replace all existing assignments
      created = await replaceAssignments(spendId, assignments);
    } else {
      // Add new assignments (may create duplicates if not careful)
      created = await createAssignments(spendId, assignments);
    }

    return NextResponse.json(
      {
        assignments: created,
        message: replaceAll
          ? "Assignments replaced successfully"
          : "Assignments created successfully",
      },
      { status: replaceAll ? 200 : 201 }
    );
  } catch (error) {
    console.error("Error creating/replacing assignments:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes("not found") ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create/replace assignments" },
      { status: 500 }
    );
  }
}
