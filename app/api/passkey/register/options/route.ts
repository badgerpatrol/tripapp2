import { NextRequest, NextResponse } from "next/server";
import { generatePasskeyRegistrationOptions } from "@/server/passkey";
import { verifyIdToken } from "@/server/authz";

/**
 * POST /api/passkey/register/options
 * Generates passkey registration options for an authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await verifyIdToken(idToken);

    if (!decodedToken.email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Generate registration options
    const options = await generatePasskeyRegistrationOptions(
      decodedToken.uid,
      decodedToken.email
    );

    return NextResponse.json(options);
  } catch (error) {
    console.error("Error generating passkey registration options:", error);
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 }
    );
  }
}
