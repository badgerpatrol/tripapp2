import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { image, currency } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey,
    });

    // Extract base64 data from data URL
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageTypeMatch = image.match(/^data:image\/(\w+);base64,/)?.[1] || "jpeg";

    // Map to valid media types
    const validMediaType = (type: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" => {
      const lowerType = type.toLowerCase();
      if (lowerType === "png") return "image/png";
      if (lowerType === "gif") return "image/gif";
      if (lowerType === "webp") return "image/webp";
      return "image/jpeg"; // Default to jpeg
    };

    // Create the prompt for Claude to analyze the receipt
    const prompt = `Analyze this receipt image and extract all the individual items with their prices.

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, just the JSON):
{
  "items": [
    {
      "name": "Item name",
      "cost": 12.50,
      "description": "Optional additional details"
    }
  ]
}

Important rules:
1. Extract the actual item names and individual prices from the receipt
2. Do NOT include tax, tip, or total as separate items
3. Costs should be positive numbers (not strings)
4. If an item has quantity > 1, you can multiply it out or note in description
5. Be as accurate as possible with the prices
6. If you cannot read the receipt clearly, return an empty items array
7. Return ONLY the JSON object, nothing else

Currency: ${currency || "Unknown"}`;

    // Call Claude Vision API
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: validMediaType(imageTypeMatch),
                data: base64Data,
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

    // Parse the response
    const responseText = message.content[0].type === "text"
      ? message.content[0].text
      : "";

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return NextResponse.json(
        { error: "Failed to parse receipt data. Please try again with a clearer image." },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!parsedResponse.items || !Array.isArray(parsedResponse.items)) {
      return NextResponse.json(
        { error: "Invalid response format from AI. Please try again." },
        { status: 500 }
      );
    }

    // Validate and clean each item
    const items = parsedResponse.items
      .filter((item: any) => {
        return (
          item.name &&
          typeof item.name === "string" &&
          item.cost &&
          typeof item.cost === "number" &&
          item.cost > 0
        );
      })
      .map((item: any) => ({
        name: item.name.trim().substring(0, 80), // Limit name length
        cost: Math.round(item.cost * 100) / 100, // Round to 2 decimals
        description: item.description
          ? item.description.trim().substring(0, 280)
          : undefined,
      }));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No valid items found on receipt. Please ensure the receipt is clear and readable." },
        { status: 400 }
      );
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Receipt processing error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process receipt",
      },
      { status: 500 }
    );
  }
}
