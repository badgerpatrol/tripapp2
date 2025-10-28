import { NextRequest, NextResponse } from "next/server";
import { verifyPasskeyAuthentication } from "@/server/passkey";
import { adminAuth } from "@/lib/firebase/admin";
import { logEvent } from "@/server/eventLog";
import { EventType } from "@prisma/client";

/**
 * POST /api/passkey/authenticate/verify
 * Verifies a passkey authentication and creates a Firebase custom token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, expectedChallenge } = body;

    if (!response || !expectedChallenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the authentication
    const verification = await verifyPasskeyAuthentication(
      response,
      expectedChallenge
    );

    if (verification.verified && verification.userId) {
      // Create a Firebase custom token for this user
      const customToken = await adminAuth.createCustomToken(
        verification.userId
      );

      // Log passkey sign in event
      await logEvent(
        "User",
        verification.userId,
        EventType.USER_SIGNED_IN,
        verification.userId,
        {
          method: "passkey",
        }
      );

      return NextResponse.json({
        verified: true,
        customToken,
      });
    } else {
      return NextResponse.json(
        { verified: false, error: "Verification failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error verifying passkey authentication:", error);
    return NextResponse.json(
      { error: "Failed to verify passkey authentication" },
      { status: 500 }
    );
  }
}
