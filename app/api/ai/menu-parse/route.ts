import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth, requireTripMember } from "@/server/authz";
import { parseMenuImage } from "@/server/ai/menuParser";
import { logEvent } from "@/server/eventLog";
import { EventType } from "@/lib/generated/prisma";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Request schema for menu parsing
 */
const MenuParseRequestSchema = z.object({
  tripId: z.string().uuid(),
  image: z.string().min(1), // Base64 data URL
  currencyHint: z.string().optional(),
});

/**
 * POST /api/ai/menu-parse
 *
 * Parses a restaurant menu image using Claude Vision API
 * Requires: authenticated user who is a member of the trip
 * Premium feature: Can be gated by feature flags (future implementation)
 *
 * Request body:
 * {
 *   tripId: string (UUID),
 *   image: string (base64 data URL),
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
    const validationResult = MenuParseRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { tripId, image, currencyHint } = validationResult.data;

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

    // 5. Check for premium feature flag (optional - can be enabled later)
    // const hasMenuScanAccess = await checkFeatureFlag(auth.uid, tripId, "menu_scan");
    // if (!hasMenuScanAccess) {
    //   return NextResponse.json(
    //     { error: "Premium feature: Upgrade to use menu scanning" },
    //     { status: 403 }
    //   );
    // }

    // 6. Extract base64 data from data URL
    if (!image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format. Must be a data URL." },
        { status: 400 }
      );
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageTypeMatch = image.match(/^data:image\/(\w+);base64,/)?.[1];

    if (!imageTypeMatch) {
      return NextResponse.json(
        { error: "Could not detect image type" },
        { status: 400 }
      );
    }

    // 7. Log the menu parse request
    await logEvent(
      "AI",
      tripId,
      EventType.CHOICE_MENU_SCANNED,
      auth.uid,
      {
        imageType: imageTypeMatch,
        currencyHint,
        tripCurrency: trip.baseCurrency,
      }
    );

    // 8. Parse menu using Claude Vision API
    let result;
    try {
      result = await parseMenuImage({
        imageBase64: base64Data,
        imageType: imageTypeMatch,
        currencyHint,
        tripCurrency: trip.baseCurrency,
      });
    } catch (error) {
      console.error("Menu parsing error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to parse menu. Please try again with a clearer image.";

      // Log failure
      await logEvent("AI", tripId, EventType.CHOICE_MENU_SCANNED, auth.uid, {
        error: errorMessage,
        success: false,
      });

      return NextResponse.json({ error: errorMessage }, { status: 422 });
    }

    // 9. Log success
    await logEvent("AI", tripId, EventType.CHOICE_MENU_SCANNED, auth.uid, {
      itemCount: result.items.length,
      currencyUsed: result.currencyUsed,
      success: true,
    });

    // 10. Return parsed items
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Menu parse endpoint error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process menu image",
      },
      { status: 500 }
    );
  }
}
