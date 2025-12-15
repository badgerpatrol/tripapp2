import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/trips/:id/verify-password
 * Verifies the trip password without exposing it to the frontend.
 * No authentication required - this is for verifying the password before login.
 *
 * This endpoint:
 * 1. Checks if the trip has signUpMode enabled
 * 2. Compares the provided password with the stored signUpPassword
 * 3. Returns whether the password is valid (but never returns the password itself)
 *
 * Request body:
 * - password: The password to verify
 *
 * Returns:
 * - valid: boolean indicating if the password matches
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    // 1. Get trip and verify signUpMode is enabled
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        signUpMode: true,
        signUpPassword: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    // Password verification works regardless of signUpMode - only requires a password to be set
    if (!trip.signUpPassword) {
      return NextResponse.json(
        { error: "This trip does not have a password set" },
        { status: 400 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // 3. Compare passwords
    const isValid = password === trip.signUpPassword;

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { valid: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying trip password:", error);
    return NextResponse.json(
      { error: "Failed to verify password" },
      { status: 500 }
    );
  }
}
