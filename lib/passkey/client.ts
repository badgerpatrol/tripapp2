import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Registers a new passkey for the currently authenticated user.
 * Requires a valid Firebase ID token.
 */
export async function registerPasskey(idToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. Get registration options from server
    const optionsResponse = await fetch("/api/passkey/register/options", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return {
        success: false,
        error: error.error || "Failed to get registration options",
      };
    }

    const options = await optionsResponse.json();

    // 2. Start WebAuthn registration ceremony
    let registrationResponse;
    try {
      registrationResponse = await startRegistration({ optionsJSON: options });
    } catch (error: any) {
      console.error("Passkey registration cancelled or failed:", error);
      return {
        success: false,
        error: error.name === "NotAllowedError"
          ? "Passkey registration was cancelled"
          : "Passkey registration failed",
      };
    }

    // 3. Send response to server for verification
    const verificationResponse = await fetch("/api/passkey/register/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        response: registrationResponse,
        expectedChallenge: options.challenge,
      }),
    });

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json();
      return {
        success: false,
        error: error.error || "Failed to verify passkey registration",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error registering passkey:", error);
    return {
      success: false,
      error: "An unexpected error occurred during passkey registration",
    };
  }
}

/**
 * Authenticates with a passkey and signs into Firebase.
 * @param email - Optional email to pre-filter passkeys
 */
export async function authenticateWithPasskey(email?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. Get authentication options from server
    const optionsResponse = await fetch("/api/passkey/authenticate/options", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return {
        success: false,
        error: error.error || "Failed to get authentication options",
      };
    }

    const options = await optionsResponse.json();

    // 2. Start WebAuthn authentication ceremony
    let authenticationResponse;
    try {
      authenticationResponse = await startAuthentication({ optionsJSON: options });
    } catch (error: any) {
      console.error("Passkey authentication cancelled or failed:", error);
      return {
        success: false,
        error: error.name === "NotAllowedError"
          ? "Passkey authentication was cancelled"
          : "Passkey authentication failed",
      };
    }

    // 3. Send response to server for verification and get Firebase custom token
    const verificationResponse = await fetch(
      "/api/passkey/authenticate/verify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: authenticationResponse,
          expectedChallenge: options.challenge,
        }),
      }
    );

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json();
      return {
        success: false,
        error: error.error || "Failed to verify passkey authentication",
      };
    }

    const { customToken } = await verificationResponse.json();

    // 4. Sign in to Firebase with the custom token
    await signInWithCustomToken(auth, customToken);

    return { success: true };
  } catch (error) {
    console.error("Error authenticating with passkey:", error);
    return {
      success: false,
      error: "An unexpected error occurred during passkey authentication",
    };
  }
}
