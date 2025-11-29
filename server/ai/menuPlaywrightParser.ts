/**
 * Menu Playwright Parser Service
 * Uses Playwright to render JavaScript-heavy pages and Claude API to extract menu items
 */

import Anthropic from "@anthropic-ai/sdk";
import { MenuParseResponseSchema, type MenuParseResponse } from "@/types/menu";
import { parsePriceToMinor, prefixCourse } from "@/lib/menu";

// Dynamic import for playwright to avoid build-time bundling issues
// Playwright should only be used at runtime on the server
const getChromium = async () => {
  const { chromium } = await import("playwright");
  return chromium;
};

interface ParseMenuPlaywrightOptions {
  url: string;
  currencyHint?: string;
  tripCurrency?: string;
}

interface ParsedMenuItem {
  name: string;
  description?: string;
  priceMinor?: number;
  course?: string;
  currency: string;
}

/**
 * Parses a restaurant menu from a website URL using Playwright to render JS content
 * and Claude API to extract menu items
 *
 * @param options - Options for parsing the menu URL
 * @returns Structured menu items with normalized prices
 * @throws Error if API key is missing or parsing fails
 */
export async function parseMenuWithPlaywright(
  options: ParseMenuPlaywrightOptions
): Promise<{ items: ParsedMenuItem[]; currencyUsed: string }> {
  const { url, currencyHint, tripCurrency = "GBP" } = options;

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  // Create the prompt for Claude to analyze the website
  const prompt = `Extract menu items from this restaurant website and return ONLY raw JSON. No markdown formatting, no code blocks, no explanations.

Output this exact JSON structure:
{"items":[{"course":"optional course name","name":"item name","description":"optional details","price":"numeric or MP"}],"currency_hint":"£"}

CRITICAL RULES:
1. Return ONLY the JSON object - no backtick marks, no json label, no extra text
2. Read all menu items from the website
3. For course: use section headers like Starters, Mains, Desserts if visible
4. For name: extract the dish name only
5. For description: include dietary info like vegan or calories and brief details
6. For price: Include the numeric value or MP if Market Price
7. For currency_hint: include the currency symbol you see
8. Keep all items even without prices
9. Ignore any non-menu content like restaurant description, opening hours, contact info

${currencyHint ? `Expected currency: ${currencyHint}` : ""}

Output format: Pure JSON only, starting with curly brace and ending with curly brace`;

  // Launch Playwright browser to fetch rendered page content
  let websiteContent: string;
  let browser;

  try {
    const chromium = await getChromium();
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Navigate to the URL with timeout
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for potential dynamic content to load
    await page.waitForTimeout(2000);

    // Get the rendered page content (text content, not raw HTML)
    websiteContent = await page.evaluate(() => {
      // Remove script and style tags
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());

      // Get the text content with some structure preservation
      const getTextContent = (element: Element): string => {
        const result: string[] = [];
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          null
        );

        let node = walker.nextNode();
        while (node) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              result.push(text);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tagName = el.tagName.toLowerCase();
            // Add line breaks for block elements
            if (
              [
                "div",
                "p",
                "br",
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "li",
                "tr",
                "section",
                "article",
              ].includes(tagName)
            ) {
              result.push("\n");
            }
          }
          node = walker.nextNode();
        }

        return result.join(" ").replace(/\n\s+/g, "\n").replace(/\s+/g, " ").trim();
      };

      return getTextContent(document.body);
    });

    await browser.close();
  } catch (fetchError) {
    if (browser) {
      await browser.close();
    }
    console.error("Failed to fetch URL with Playwright:", fetchError);
    throw new Error(
      "Unable to access the provided URL. Please check the URL and try again."
    );
  }

  // Call Claude API to parse the website content
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here is the text content from a restaurant website (rendered with JavaScript):\n\n${websiteContent.substring(0, 50000)}\n\n${prompt}`,
          },
        ],
      },
    ],
  });

  // Parse the response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```)
  let cleanedText = responseText.trim();
  if (cleanedText.startsWith("```")) {
    // Remove markdown code blocks
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "");
  }

  let rawResponse: unknown;
  try {
    rawResponse = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("Failed to parse Claude response:", responseText);
    throw new Error(
      "Failed to parse menu data from URL. Please try again or use a different URL."
    );
  }

  // Validate with Zod schema
  const validationResult = MenuParseResponseSchema.safeParse(rawResponse);
  if (!validationResult.success) {
    console.error("Menu parse validation failed:", validationResult.error);
    throw new Error(
      "Invalid menu data format from URL. Please try again or use a different URL."
    );
  }

  const parsedResponse: MenuParseResponse = validationResult.data;

  // Determine currency to use
  const detectedCurrency = parsedResponse.currency_hint || currencyHint;
  const currencyToUse = detectedCurrency || tripCurrency;

  // Normalize items
  const normalizedItems: ParsedMenuItem[] = parsedResponse.items
    .map((item) => {
      // Parse price to minor units
      let priceMinor: number | undefined;
      let currency = currencyToUse;

      // Only parse if price looks numeric (skip "MP", "POA", etc.)
      const priceStr = String(item.price).trim();
      const isNumericPrice = /^[£$€¥₹A-Z]*\s*[\d,]+\.?\d*$/.test(priceStr);

      if (isNumericPrice) {
        try {
          const parsed = parsePriceToMinor(priceStr, currencyToUse);
          priceMinor = parsed.minor;
          currency = parsed.currency;
        } catch (error) {
          // If price parsing fails, log but continue without price
          console.warn(`Failed to parse price "${item.price}":`, error);
          priceMinor = undefined;
        }
      } else {
        // Non-numeric price like "MP" (Market Price), "POA" (Price on Application), etc.
        console.log(
          `Skipping non-numeric price "${item.price}" for item "${item.name}"`
        );
        priceMinor = undefined;
      }

      // Prefix name with course if present
      const displayName = item.course
        ? prefixCourse(item.name, item.course)
        : item.name;

      return {
        name: displayName.trim().substring(0, 200), // Limit name length
        description: item.description?.trim().substring(0, 500),
        priceMinor,
        course: item.course?.trim().substring(0, 100),
        currency,
      };
    })
    .filter((item) => item.name); // Keep items even if they don't have a price

  // Filter out items without names
  const validItems = normalizedItems.filter((item) => item.name);

  if (validItems.length === 0) {
    throw new Error(
      "No valid menu items found at this URL. Please ensure the URL points to a menu page."
    );
  }

  return {
    items: validItems,
    currencyUsed: currencyToUse,
  };
}
