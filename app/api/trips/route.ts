import { NextRequest, NextResponse } from "next/server";
import { getAuthTokenFromHeader, requireAuth } from "@/server/authz";
import { createTrip, getUserTrips } from "@/server/services/trips";
import { CreateTripSchema, CreateTripResponseSchema } from "@/types/schemas";

/**
 * POST /api/trips
 * Creates a new trip with the authenticated user as owner.
 * Seeds default timeline items automatically.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = CreateTripSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || "Invalid trip data",
        },
        { status: 400 }
      );
    }

    // 3. Create trip using service
    const trip = await createTrip(auth.uid, validation.data);

    // 4. Return response
    const response = CreateTripResponseSchema.parse({
      success: true,
      trip: {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        baseCurrency: trip.baseCurrency,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        createdById: trip.createdById,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating trip:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create trip. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trips
 * Gets all trips for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = request.headers.get("authorization");
    const auth = await getAuthTokenFromHeader(authHeader);

    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user exists in database
    await requireAuth(auth.uid);

    // 2. Get user's trips
    const trips = await getUserTrips(auth.uid);

    return NextResponse.json({ trips }, { status: 200 });
  } catch (error) {
    console.error("Error getting trips:", error);
    return NextResponse.json(
      { error: "Failed to get trips. Please try again." },
      { status: 500 }
    );
  }
}
