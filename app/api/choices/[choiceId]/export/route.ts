/**
 * API Route: /api/choices/:choiceId/export
 * C3. Export reports as CSV (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { TripMemberRole } from "@/lib/generated/prisma";
import { getItemsReport, getUsersReport } from "@/server/services/choices";
import { prisma } from "@/lib/prisma";

/**
 * Convert items report to CSV
 */
function itemsReportToCSV(report: any): string {
  const headers = ["Item Name", "Type", "Total Quantity", "Total Price", "Distinct Users"];
  const rows = report.items.map((item: any) => {
    // Show friendly name for item type
    const typeDisplay = item.itemType === "NO_PARTICIPATION"
      ? "Not Participating"
      : item.itemType === "OTHER"
        ? "Other"
        : "Normal";

    const row: (string | number)[] = [
      item.name,
      typeDisplay,
      item.qtyTotal,
      item.itemType === "NO_PARTICIPATION" ? "N/A" : (item.totalPrice?.toFixed(2) || "N/A"),
      item.distinctUsers,
    ];
    return row;
  });

  // Add grand total row (excludes NO_PARTICIPATION items)
  if (report.grandTotalPrice !== null) {
    rows.push([
      "GRAND TOTAL",
      "",
      "",
      report.grandTotalPrice.toFixed(2),
      "",
    ]);
  }

  const csv = [
    headers.join(","),
    ...rows.map((row: (string | number)[]) => row.map((cell: string | number) => `"${cell}"`).join(",")),
  ].join("\n");

  return csv;
}

/**
 * Convert users report to CSV
 */
function usersReportToCSV(report: any): string {
  const lines: string[] = [];

  // Header
  lines.push('"User","Status","Item","Quantity","Price","Note"');

  // Data rows
  for (const user of report.users) {
    const userName = user.displayName || user.userId;
    const userNote = user.note || "";

    // Check if user is not participating
    if (user.isNotParticipating) {
      lines.push([
        `"${userName}"`,
        '"NOT PARTICIPATING"',
        '"(opted out)"',
        '""',
        '""',
        `"${userNote}"`,
      ].join(","));
      continue;
    }

    if (user.lines.length === 0) {
      lines.push([
        `"${userName}"`,
        '"No Response"',
        '"(no selections)"',
        '""',
        '""',
        `"${userNote}"`,
      ].join(","));
    } else {
      for (let i = 0; i < user.lines.length; i++) {
        const line = user.lines[i];
        const isFirstLine = i === 0;

        // Skip NO_PARTICIPATION items in the detail (they're shown via status)
        if (line.itemType === "NO_PARTICIPATION") {
          continue;
        }

        lines.push([
          `"${isFirstLine ? userName : ""}"`,
          `"${isFirstLine ? "Participating" : ""}"`,
          `"${line.itemName}"`,
          `"${line.quantity}"`,
          `"${line.linePrice?.toFixed(2) || "N/A"}"`,
          `"${isFirstLine ? userNote : (line.note || "")}"`,
        ].join(","));
      }

      // User total (only if they have a price)
      if (user.userTotalPrice !== null && user.userTotalPrice > 0) {
        lines.push([
          '""',
          '""',
          `"${userName} Total"`,
          '""',
          `"${user.userTotalPrice.toFixed(2)}"`,
          '""',
        ].join(","));
      }
    }
  }

  // Grand total
  if (report.grandTotalPrice !== null) {
    lines.push('');
    lines.push([
      '""',
      '""',
      '"GRAND TOTAL"',
      '""',
      `"${report.grandTotalPrice.toFixed(2)}"`,
      '""',
    ].join(","));
  }

  return lines.join("\n");
}

/**
 * GET /api/choices/:choiceId/export
 * Export choice report as CSV
 * Query params: type=items|users, format=csv
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ choiceId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requireAuth(auth.uid);

    const { choiceId } = await params;

    // Get choice to verify trip membership
    const choice = await prisma.choice.findUnique({
      where: { id: choiceId },
      select: { tripId: true, name: true },
    });

    if (!choice) {
      return NextResponse.json(
        { error: "Choice not found" },
        { status: 404 }
      );
    }

    // Verify user is at least ADMIN (organisers can export)
    await requireTripMember(auth.uid, choice.tripId, TripMemberRole.ADMIN);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "items";
    const format = searchParams.get("format") || "csv";

    if (format !== "csv") {
      return NextResponse.json(
        { error: "Only CSV format is supported" },
        { status: 400 }
      );
    }

    let csv: string;
    let filename: string;

    if (type === "items") {
      const report = await getItemsReport(choiceId);
      csv = itemsReportToCSV(report);
      filename = `${choice.name.replace(/[^a-z0-9]/gi, "_")}_items.csv`;
    } else if (type === "users") {
      const report = await getUsersReport(choiceId);
      csv = usersReportToCSV(report);
      filename = `${choice.name.replace(/[^a-z0-9]/gi, "_")}_users.csv`;
    } else {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'items' or 'users'" },
        { status: 400 }
      );
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/choices/:choiceId/export error:", error);

    if (error.message?.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to export report" },
      { status: 500 }
    );
  }
}
