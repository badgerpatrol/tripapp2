/**
 * API Route: Kit Photo Parsing
 * Identifies items in photos using Claude Vision API
 * Follows the same pattern as receipt-parse API route
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { logEvent } from "@/server/eventLog";
import { EventType } from "@/lib/generated/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60; // Allow up to 60s for Claude API processing

interface KitPhotoParseRequest {
  listId: string;
  image: string; // Data URL (data:image/jpeg;base64,...)
  hint?: string; // Optional hint about the type of kit
}

export interface ParsedKitItem {
  name: string;
  description?: string;
  year?: string;
  makeModel?: string;
  weightGrams?: number;
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
    const body = (await request.json()) as KitPhotoParseRequest;
    const { listId, image, hint } = body;

    if (!listId || !image) {
      return NextResponse.json(
        { error: "Missing required fields: listId, image" },
        { status: 400 }
      );
    }

    // 3. Parse image data URL
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

    // 4. Call Claude Vision API to identify items
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const hintText = hint
      ? `\n\nThe user has provided this hint about the type of kit: "${hint}"\nUse this hint to help guide your identification, but ONLY list items you can actually see clearly in the photo.`
      : '';

    const prompt = `You are analyzing a photo to identify items that could be added to a packing list or kit list.

CRITICAL: Only identify items you can CLEARLY and CONFIDENTLY see in the photo. Do not guess, assume, or hallucinate items that might be present but are not clearly visible. It is much better to miss an item than to list something that isn't actually there.${hintText}

Look at the image carefully and identify distinct items you can see with confidence. These could be ANY type of object - clothing, gear, equipment, electronics, toiletries, food, tools, accessories, or anything else that is clearly visible in the photo.

Return ONLY a raw JSON array with no markdown formatting, code blocks, or explanations.

Each item should have:
- "name": A short, clear name for the item (REQUIRED) - only include if you can clearly see and identify it
- "description": (optional) Additional details about the item that you can actually see (color, size, visible condition, etc.) - do not guess or assume
- "year": (optional) ONLY include if you can clearly see year markings or have very high confidence based on visible features
- "makeModel": (optional) ONLY include if you can clearly see brand logos, model names, or have very high confidence in the identification
- "weightGrams": (optional) ONLY include if you have high confidence in the estimate based on clearly visible item characteristics

Example format:
[
  {"name":"Hiking boots","description":"Brown leather, ankle height"},
  {"name":"Water bottle","description":"Clear plastic"},
  {"name":"Blue backpack"},
  {"name":"Headlamp","description":"Black, mounted on elastic strap"}
]

Critical rules to prevent hallucination:
- ONLY list items you can clearly see in the photo
- If you're not sure what an item is, either describe it generically or skip it
- Do NOT assume items exist based on context (e.g., don't list "batteries" just because you see a headlamp)
- Do NOT guess brand names unless you can clearly see logos or distinctive branding
- Do NOT estimate weights unless you're very confident
- Do NOT list items that are partially obscured unless you can clearly identify them
- When in doubt, leave it out - accuracy is more important than completeness
- Be conservative with your identifications
- List each distinct item separately, don't group items together
- Return valid JSON only, no other text`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      temperature: 0, // Use temperature 0 for more deterministic, conservative output
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: `image/${imageType}` as any,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    // 5. Parse response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Clean up potential markdown formatting
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let items: ParsedKitItem[];
    try {
      items = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", cleanedText);
      throw new Error("Failed to parse AI response. Please try again.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items found in the photo. Please try a different image." },
        { status: 400 }
      );
    }

    // 6. Log the event
    await logEvent(
      "List",
      listId,
      EventType.PHOTO_SCANNED,
      auth.uid,
      {
        imageType,
        itemCount: items.length,
      }
    );

    // 7. Return parsed items
    return NextResponse.json({
      items,
    });
  } catch (error) {
    console.error("Kit photo parse error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to parse photo. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
