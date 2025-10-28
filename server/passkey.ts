import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";

// Configuration
const rpName = "TripPlanner";
const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const origin = process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000";

/**
 * Generates registration options for a new passkey.
 * This initiates the passkey registration ceremony.
 */
export async function generatePasskeyRegistrationOptions(
  userId: string,
  userEmail: string
) {
  // Get existing authenticators for this user
  const existingAuthenticators = await prisma.passkey.findMany({
    where: { userId },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userEmail,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    excludeCredentials: existingAuthenticators.map((auth) => ({
      id: Buffer.from(auth.credentialID, "base64"),
      type: "public-key",
      transports: auth.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  return options;
}

/**
 * Verifies a passkey registration response and stores the credential.
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: any,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;

    // Store the credential in the database
    await prisma.passkey.create({
      data: {
        userId,
        credentialID: Buffer.from(credential.id).toString("base64"),
        credentialPublicKey: Buffer.from(credential.publicKey).toString(
          "base64"
        ),
        counter: credential.counter,
        transports: response.response.transports || [],
      },
    });
  }

  return verification;
}

/**
 * Generates authentication options for signing in with a passkey.
 */
export async function generatePasskeyAuthenticationOptions(email?: string) {
  let allowCredentials: { id: Buffer; type: "public-key"; transports?: AuthenticatorTransport[] }[] = [];

  if (email) {
    // If email is provided, look up user and their passkeys
    const user = await prisma.user.findUnique({
      where: { email },
      include: { passkeys: true },
    });

    if (user && user.passkeys.length > 0) {
      allowCredentials = user.passkeys.map((passkey) => ({
        id: Buffer.from(passkey.credentialID, "base64"),
        type: "public-key" as const,
        transports: passkey.transports as AuthenticatorTransport[],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: "preferred",
  });

  return options;
}

/**
 * Verifies a passkey authentication response.
 * Returns the user ID if verification succeeds.
 */
export async function verifyPasskeyAuthentication(
  response: any,
  expectedChallenge: string
): Promise<{ verified: boolean; userId?: string }> {
  // Find the passkey by credential ID
  const passkey = await prisma.passkey.findUnique({
    where: {
      credentialID: Buffer.from(response.id, "base64url").toString("base64"),
    },
  });

  if (!passkey) {
    return { verified: false };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: Buffer.from(passkey.credentialID, "base64"),
      publicKey: Buffer.from(passkey.credentialPublicKey, "base64"),
      counter: passkey.counter,
    },
  });

  if (verification.verified) {
    // Update the counter
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    return { verified: true, userId: passkey.userId };
  }

  return { verified: false };
}
