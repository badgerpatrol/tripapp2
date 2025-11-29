import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { parseMenuWithPlaywright } from "@/server/ai/menuPlaywrightParser";
import { logEvent } from "@/server/eventLog";
import { createSystemLog } from "@/server/systemLog";
import { EventType, LogSeverity } from "@/lib/generated/prisma";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Request schema for Playwright-based menu parsing
 */
const MenuParsePlaywrightRequestSchema = z.object({
  tripId: z.string().uuid(),
  url: z.string().url(),
  currencyHint: z.string().optional(),
});

/**
 * POST /api/ai/menu-parse-playwright
 *
 * Parses a restaurant menu from a website URL using Playwright to render JS content
 * and Claude API to extract menu items
 *
 * This is useful for websites that load menu content dynamically via JavaScript
 *
 * Requires: authenticated user who is a member of the trip
 *
 * Request body:
 * {
 *   tripId: string (UUID),
 *   url: string (website URL),
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
    const validationResult = MenuParsePlaywrightRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { tripId, url, currencyHint } = validationResult.data;

    // 3. Verify trip membership
    await requireTripMember(auth.uid, tripId);

    // 4. Get trip details for currency
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { baseCurrency: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 5. Log the menu parse request
    await logEvent(
      "AI",
      tripId,
      EventType.CHOICE_MENU_SCANNED,
      auth.uid,
      {
        source: "playwright",
        url,
        currencyHint,
        tripCurrency: trip.baseCurrency,
      }
    );

    // 6. Parse menu from URL using Playwright + Claude API
    let result;
    try {
      result = await parseMenuWithPlaywright({
        url,
        currencyHint,
        tripCurrency: trip.baseCurrency,
      });
    } catch (error) {
      console.error("Menu Playwright parsing error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to parse menu from URL. Please try again.";

      // Log failure
      await logEvent("AI", tripId, EventType.CHOICE_MENU_SCANNED, auth.uid, {
        source: "playwright",
        error: errorMessage,
        success: false,
      });

      // Log error to system log
      await createSystemLog(
        LogSeverity.WARNING,
        "menu-playwright-scan",
        "menu_playwright_parse_failed",
        `Menu Playwright parsing failed for trip ${tripId}: ${errorMessage}`,
        {
          tripId,
          userId: auth.uid,
          url,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

      return NextResponse.json({ error: errorMessage }, { status: 422 });
    }

    // 7. Log success
    await logEvent("AI", tripId, EventType.CHOICE_MENU_SCANNED, auth.uid, {
      source: "playwright",
      itemCount: result.items.length,
      currencyUsed: result.currencyUsed,
      success: true,
    });

    // 8. Create system log for admin visibility
    await createSystemLog(
      LogSeverity.INFO,
      "menu-playwright-scan",
      "menu_playwright_scanned",
      `Menu scanned via Playwright for trip ${tripId} by user ${auth.uid}. Found ${result.items.length} items from ${url} using currency ${result.currencyUsed}`,
      {
        tripId,
        userId: auth.uid,
        url,
        itemCount: result.items.length,
        currency: result.currencyUsed,
      }
    );

    // 9. Return parsed items
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Menu parse Playwright endpoint error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to process menu URL";

    // Log error to system log
    await createSystemLog(
      LogSeverity.ERROR,
      "menu-playwright-scan",
      "menu_playwright_scan_error",
      `Failed to scan menu via Playwright: ${message}`,
      {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
