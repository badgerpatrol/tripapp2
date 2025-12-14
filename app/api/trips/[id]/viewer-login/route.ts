import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/trips/:id/viewer-login
 * Validates the trip password and returns the viewer account email for Firebase auth.
 * No authentication required - this is for unauthenticated users accessing the public trip URL.
 *
 * The viewer email is a hidden internal detail - users only see "Enter trip password".
 *
 * Request body:
 * - password: The trip password to verify
 *
 * Returns on success:
 * - valid: true
 * - viewerEmail: The viewer account email (hidden from UI, used for Firebase auth)
 *
 * Returns on failure:
 * - valid: false
 * - error: Generic error message (does not reveal if trip exists or password format)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    // 1. Parse request body
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { valid: false, error: "Password is required" },
        { status: 400 }
      );
    }

    // 2. Get trip and verify signUpMode is enabled
    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        signUpMode: true,
        signUpPassword: true,
        signUpViewerUserId: true,
        signUpViewerUser: {
          select: {
            email: true,
          },
        },
      },
    });

    // Use generic error message to avoid leaking information about trip existence
    // Password login works regardless of signUpMode - only requires a password to be set
    if (!trip || !trip.signUpPassword) {
      return NextResponse.json(
        { valid: false, error: "Incorrect password for this trip" },
        { status: 401 }
      );
    }

    // 3. Validate password
    if (password !== trip.signUpPassword) {
      return NextResponse.json(
        { valid: false, error: "Incorrect password for this trip" },
        { status: 401 }
      );
    }

    // 4. Get viewer email
    if (!trip.signUpViewerUser?.email) {
      console.error(`Trip ${tripId} has signUpMode but no viewer user`);
      return NextResponse.json(
        { valid: false, error: "Trip configuration error" },
        { status: 500 }
      );
    }

    // 5. Return success with viewer email (hidden from UI)
    return NextResponse.json(
      {
        valid: true,
        viewerEmail: trip.signUpViewerUser.email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in viewer login:", error);
    return NextResponse.json(
      { valid: false, error: "An error occurred" },
      { status: 500 }
    );
  }
}
