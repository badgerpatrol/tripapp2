import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trips/:id/public
 * Gets public trip info for the account selector (no auth required).
 * Returns data if signUpMode or signInMode is enabled, or if a password is set.
 *
 * Note: Password is intentionally NOT returned here for security.
 * Use POST /api/trips/:id/verify-password to verify passwords.
 *
 * Returns:
 * - Trip name
 * - Sign-up enabled status
 * - Sign-in enabled status
 * - Whether password is required
 * - List of participants with user types (for sign-in mode)
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
        signInMode: true,
        signUpPassword: true,
        members: {
          where: { deletedAt: null },
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                userType: true,
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

    // Filter out SYSTEM users (viewer accounts) from the participant list
    // They shouldn't appear as selectable options
    const selectableParticipants = trip.members
      .filter((m) => m.user.userType !== "SYSTEM")
      .map((m) => ({
        id: m.id,
        role: m.role,
        user: {
          id: m.user.id,
          email: m.user.email,
          displayName: m.user.displayName,
          // Include userType so frontend knows if it's SIGNUP (trip password) or FULL (own password)
          userType: m.user.userType,
          // For FULL users, provide a masked email hint for identification
          emailHint: m.user.userType === "FULL" ? maskEmail(m.user.email) : null,
        },
      }));

    // Note: We intentionally do NOT return the signUpPassword here
    // Password verification is handled by POST /api/trips/[id]/verify-password

    // Password login is only allowed if signUpMode or signInMode is enabled
    // If neither is enabled ("Users with accounts only"), users must log in with their own account
    const passwordLoginAllowed = trip.signUpMode || trip.signInMode;

    return NextResponse.json(
      {
        tripId: trip.id,
        tripName: trip.name,
        signUpEnabled: trip.signUpMode,
        signInEnabled: trip.signInMode,
        passwordRequired: !!trip.signUpPassword,
        passwordLoginAllowed,
        participants: selectableParticipants,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error("Error getting public trip info:", error);
    return NextResponse.json(
      { error: "Failed to get trip info" },
      { status: 500 }
    );
  }
}

/**
 * Masks an email address for privacy while still being identifiable
 * e.g., "john.doe@example.com" -> "j***e@e***e.com"
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return "***";

  const maskedLocal = localPart.length <= 2
    ? "***"
    : `${localPart[0]}***${localPart[localPart.length - 1]}`;

  const domainParts = domain.split(".");
  const maskedDomain = domainParts.map((part, index) => {
    if (index === domainParts.length - 1) return part; // Keep TLD
    if (part.length <= 2) return "***";
    return `${part[0]}***${part[part.length - 1]}`;
  }).join(".");

  return `${maskedLocal}@${maskedDomain}`;
}
