import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trips/:id/public
 * Gets public trip info for the account selector (no auth required).
 * Only returns data if signUpMode is enabled.
 *
 * Note: Password is intentionally NOT returned here for security.
 * Use POST /api/trips/:id/verify-password to verify passwords.
 *
 * Returns:
 * - Trip name
 * - Sign-up enabled status
 * - List of participants (for account selection)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId, deletedAt: null },
      select: {
        id: true,
        name: true,
        signUpMode: true,
        signUpPassword: true,
        members: {
          where: { deletedAt: null },
          select: {
            id: true,
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    // Only return sign-up info if signUpMode is enabled
    if (!trip.signUpMode) {
      return NextResponse.json(
        {
          tripId: trip.id,
          tripName: trip.name,
          signUpEnabled: false,
          participants: trip.members.map((m) => ({
            id: m.id,
            user: m.user,
          })),
        },
        { status: 200 }
      );
    }

    // Note: We intentionally do NOT return the signUpPassword here
    // Password verification is handled by POST /api/trips/[id]/verify-password
    return NextResponse.json(
      {
        tripId: trip.id,
        tripName: trip.name,
        signUpEnabled: true,
        participants: trip.members.map((m) => ({
          id: m.id,
          user: m.user,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error getting public trip info:", error);
    return NextResponse.json(
      { error: "Failed to get trip info" },
      { status: 500 }
    );
  }
}
