import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { TripMemberRole, UserRole } from "@/lib/generated/prisma";
import { POST } from "@/app/api/trips/[id]/viewer-login/route";
import { NextRequest } from "next/server";

describe("POST /api/trips/[id]/viewer-login", () => {
  const testTripId = "test-viewer-login-trip";
  const testViewerId = "test-viewer-user-id";
  const testOwnerId = "test-owner-user-id";
  const testPassword = "test-secret-password";
  const viewerEmail = `trip_${testTripId.slice(0, 8)}_viewer@tripplanner.local`;

  beforeEach(async () => {
    // Create test owner user
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: "owner@test.com",
        displayName: "Test Owner",
      },
    });

    // Create test viewer user
    await prisma.user.create({
      data: {
        id: testViewerId,
        email: viewerEmail,
        displayName: "Trip Viewer",
        role: UserRole.VIEWER,
      },
    });

    // Create test trip with sign-up mode enabled
    await prisma.trip.create({
      data: {
        id: testTripId,
        name: "Test Trip",
        createdById: testOwnerId,
        signUpMode: true,
        signUpPassword: testPassword,
        signUpViewerUserId: testViewerId,
      },
    });

    // Add viewer as trip member
    await prisma.tripMember.create({
      data: {
        tripId: testTripId,
        userId: testViewerId,
        role: TripMemberRole.VIEWER,
        rsvpStatus: "ACCEPTED",
      },
    });
  });

  afterEach(async () => {
    // Clean up trip members
    await prisma.tripMember.deleteMany({
      where: { tripId: testTripId },
    });

    // Clean up trip
    await prisma.trip.deleteMany({
      where: { id: testTripId },
    });

    // Delete event logs before users (foreign key constraint)
    await prisma.eventLog.deleteMany({
      where: { byUser: { in: [testOwnerId, testViewerId] } },
    });

    // Clean up users
    await prisma.user.deleteMany({
      where: { id: { in: [testOwnerId, testViewerId] } },
    });
  });

  const createRequest = (tripId: string, body: Record<string, unknown>) => {
    return new NextRequest(`http://localhost/api/trips/${tripId}/viewer-login`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  it("returns viewer email for correct password", async () => {
    const request = createRequest(testTripId, { password: testPassword });
    const response = await POST(request, { params: Promise.resolve({ id: testTripId }) });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.valid).toBe(true);
    expect(data.viewerEmail).toBe(viewerEmail);
  });

  it("returns 401 for incorrect password", async () => {
    const request = createRequest(testTripId, { password: "wrong-password" });
    const response = await POST(request, { params: Promise.resolve({ id: testTripId }) });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.error).toBe("Incorrect password for this trip");
    expect(data.viewerEmail).toBeUndefined();
  });

  it("returns 401 for non-existent trip", async () => {
    const request = createRequest("non-existent-trip-id", { password: testPassword });
    const response = await POST(request, { params: Promise.resolve({ id: "non-existent-trip-id" }) });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.valid).toBe(false);
    // Generic error message to avoid leaking trip existence
    expect(data.error).toBe("Incorrect password for this trip");
  });

  it("returns 400 for missing password", async () => {
    const request = createRequest(testTripId, {});
    const response = await POST(request, { params: Promise.resolve({ id: testTripId }) });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.error).toBe("Password is required");
  });

  it("returns 403 for trip without sign-up mode", async () => {
    // Update trip to disable sign-up mode
    await prisma.trip.update({
      where: { id: testTripId },
      data: { signUpMode: false },
    });

    const request = createRequest(testTripId, { password: testPassword });
    const response = await POST(request, { params: Promise.resolve({ id: testTripId }) });

    // 403 Forbidden - trip exists but sign-up mode is disabled
    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.valid).toBe(false);
  });

  it("returns 401 for trip without sign-up password configured", async () => {
    // Update trip to remove password
    await prisma.trip.update({
      where: { id: testTripId },
      data: { signUpPassword: null },
    });

    const request = createRequest(testTripId, { password: testPassword });
    const response = await POST(request, { params: Promise.resolve({ id: testTripId }) });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.error).toBe("Incorrect password for this trip");
  });
});
