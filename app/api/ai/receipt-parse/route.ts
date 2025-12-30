/**
 * API Route: Receipt Parsing
 * Extracts items from receipt images using Claude Vision API
 * Reuses patterns from menu-parse API route
 */

import { NextRequest, NextResponse } from "next/server";
import { parseReceiptImage } from "@/server/ai/receiptParser";
import { getAuthTokenFromHeader, requireAuth, requireTripMembershipOnly } from "@/server/authz";
import { logEvent } from "@/server/eventLog";
import { createSystemLog } from "@/server/systemLog";
import { EventType, LogSeverity } from "@/lib/generated/prisma";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60; // Allow up to 60s for Claude API processing

interface ReceiptParseRequest {
  tripId: string;
  image: string; // Data URL (data:image/jpeg;base64,...)
  currencyHint?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requireAuth(auth.uid);

    // 2. Parse request body
    const body = (await request.json()) as ReceiptParseRequest;
    const { tripId, image, currencyHint } = body;

    if (!tripId || !image) {
      return NextResponse.json(
        { error: "Missing required fields: tripId, image" },
        { status: 400 }
      );
    }

    // 3. Validate trip access
    await requireTripMembershipOnly(auth.uid, tripId);

    // 4. Get trip details for currency
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { baseCurrency: true },
    });
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 5. Parse image data URL
    if (!image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format. Expected data URL." },
        { status: 400 }
      );
    }

    // Extract image type and base64 data
    const matches = image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Invalid image data URL format" },
        { status: 400 }
      );
    }

    const [, imageType, imageBase64] = matches;

    // 6. Parse receipt with Claude Vision
    const result = await parseReceiptImage({
      imageBase64,
      imageType,
      currencyHint: currencyHint || trip.baseCurrency,
      tripCurrency: trip.baseCurrency,
    });

    // 7. Log the event
    await logEvent(
      "Receipt",
      tripId,
      EventType.RECEIPT_SCANNED,
      auth.uid,
      {
        imageType,
        currencyHint: result.currencyUsed,
        itemCount: result.items.length,
        total: result.total,
      }
    );

    // 8. Create system log for admin visibility
    await createSystemLog(
      LogSeverity.INFO,
      "receipt-scan",
      "receipt_photo_scanned",
      `Receipt photo scanned for trip ${tripId} by user ${auth.uid}. Found ${result.items.length} items with total ${result.total} ${result.currencyUsed}`,
      {
        tripId,
        userId: auth.uid,
        imageType,
        currency: result.currencyUsed,
        itemCount: result.items.length,
        total: result.total,
      }
    );

    // 9. Return parsed items
    return NextResponse.json({
      items: result.items,
      currency: result.currencyUsed,
      total: result.total,
    });
  } catch (error) {
    console.error("Receipt parse error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to parse receipt. Please try again.";

    // Log error to system log
    await createSystemLog(
      LogSeverity.ERROR,
      "receipt-scan",
      "receipt_scan_error",
      `Failed to scan receipt: ${message}`,
      {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
