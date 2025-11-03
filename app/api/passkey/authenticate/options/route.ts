import { NextRequest, NextResponse } from "next/server";
import { generatePasskeyAuthenticationOptions } from "@/server/passkey";

/**
 * POST /api/passkey/authenticate/options
 * Generates passkey authentication options.
 * Email is optional - if not provided, works with discoverable credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Generate authentication options
    const options = await generatePasskeyAuthenticationOptions(email);

    return NextResponse.json(options);
  } catch (error) {
    console.error("Error generating passkey authentication options:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 }
    );
  }
}
