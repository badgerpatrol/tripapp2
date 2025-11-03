import { NextRequest, NextResponse } from "next/server";
import { verifyPasskeyRegistration } from "@/server/passkey";
import { verifyIdToken } from "@/server/authz";
import { logEvent } from "@/server/eventLog";
import { EventType } from "@/lib/generated/prisma";

/**
 * POST /api/passkey/register/verify
 * Verifies and stores a passkey registration.
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

    // Get the registration response from the request body
    const body = await request.json();
    const { response, expectedChallenge } = body;

    if (!response || !expectedChallenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the registration
    const verification = await verifyPasskeyRegistration(
      decodedToken.uid,
      response,
      expectedChallenge
    );

    if (verification.verified) {
      // Log passkey registration event
      await logEvent(
        "User",
        decodedToken.uid,
        EventType.USER_UPDATED,
        decodedToken.uid,
        {
          action: "passkey_registered",
          email: decodedToken.email,
        }
      );

      return NextResponse.json({
        verified: true,
        message: "Passkey registered successfully",
      });
    } else {
      return NextResponse.json(
        { verified: false, error: "Verification failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error verifying passkey registration:", error);
    return NextResponse.json(
      { error: "Failed to verify passkey registration" },
      { status: 500 }
    );
  }
}
