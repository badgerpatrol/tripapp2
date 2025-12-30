import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { parseGoogleSheet } from "@/server/ai/googleSheetParser";
import { logEvent } from "@/server/eventLog";
import { createSystemLog } from "@/server/systemLog";
import { EventType, LogSeverity } from "@/lib/generated/prisma";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Request schema for Google Sheet-based menu parsing
 */
const MenuParseGSheetRequestSchema = z.object({
  tripId: z.string().uuid(),
  sheetUrl: z.string().min(1, "Sheet URL is required"),
  currencyHint: z.string().optional(),
});

/**
 * POST /api/ai/menu-parse-gsheet
 *
 * Parses menu/list items from a Google Sheet using Claude API
 * Requires: authenticated user who is a member of the trip
 *
 * Request body:
 * {
 *   tripId: string (UUID),
 *   sheetUrl: string (Google Sheet URL),
 *   currencyHint?: string (optional currency code or symbol)
 * }
 *
 * Response:
 * {
 *   items: Array<{
 *     name: string,
 *     description?: string,
 *     priceMinor?: number,
 *     course?: string,
 *     currency: string
 *   }>,
 *   currencyUsed: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requireAuth(auth.uid);

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = MenuParseGSheetRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { tripId, sheetUrl, currencyHint } = validationResult.data;

    // 3. Verify trip membership
    await requireTripMembershipOnly(auth.uid, tripId);

    // 4. Get trip details for currency
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { baseCurrency: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 5. Log the Google Sheet parse request
    await logEvent(
      "AI",
      tripId,
      EventType.CHOICE_MENU_SCANNED,
      auth.uid,
      {
        source: "google_sheet",
        sheetUrl,
        currencyHint,
        tripCurrency: trip.baseCurrency,
      }
    );

    // 6. Parse items from Google Sheet using Claude API
    let result;
    try {
      result = await parseGoogleSheet({
        sheetUrl,
        currencyHint,
        tripCurrency: trip.baseCurrency,
      });
    } catch (error) {
      console.error("Google Sheet parsing error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to parse items from Google Sheet. Please try again.";

      // Log failure
      await logEvent("AI", tripId, EventType.CHOICE_MENU_SCANNED, auth.uid, {
        source: "google_sheet",
        error: errorMessage,
        success: false,
      });

      // Log error to system log
      await createSystemLog(
        LogSeverity.WARNING,
        "menu-gsheet-scan",
        "menu_gsheet_parse_failed",
        `Google Sheet parsing failed for trip ${tripId}: ${errorMessage}`,
        {
          tripId,
          userId: auth.uid,
          sheetUrl,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

      return NextResponse.json({ error: errorMessage }, { status: 422 });
    }

    // 7. Log success
    await logEvent("AI", tripId, EventType.CHOICE_MENU_SCANNED, auth.uid, {
      source: "google_sheet",
      itemCount: result.items.length,
      currencyUsed: result.currencyUsed,
      success: true,
    });

    // 8. Create system log for admin visibility
    await createSystemLog(
      LogSeverity.INFO,
      "menu-gsheet-scan",
      "menu_gsheet_scanned",
      `Google Sheet scanned for trip ${tripId} by user ${auth.uid}. Found ${result.items.length} items using currency ${result.currencyUsed}`,
      {
        tripId,
        userId: auth.uid,
        sheetUrl,
        itemCount: result.items.length,
        currency: result.currencyUsed,
      }
    );

    // 9. Return parsed items
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Menu parse Google Sheet endpoint error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to process Google Sheet";

    // Log error to system log
    await createSystemLog(
      LogSeverity.ERROR,
      "menu-gsheet-scan",
      "menu_gsheet_scan_error",
      `Failed to scan Google Sheet: ${message}`,
      {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
