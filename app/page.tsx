'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminMode } from "@/lib/admin/AdminModeContext";
import LoginForm from "@/components/LoginForm";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/lib/generated/prisma";

interface Trip {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    displayName: string | null;
  };
  members: Array<{
    id: string;
    userId: string;
    role: string;
    rsvpStatus: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
}

export default function Home() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isAdminMode } = useAdminMode();
  const canCreateTrip = userProfile && userProfile.role !== UserRole.VIEWER;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrips = async () => {
      if (!user) {
        console.log("[DEBUG] No user, skipping fetch");
        return;
      }

      console.log("[DEBUG] Fetching trips for user:", user.uid, user.email, "Admin mode:", isAdminMode);

      try {
        const idToken = await user.getIdToken();
        console.log("[DEBUG] Got ID token, making request...");

        const url = isAdminMode ? "/api/trips?adminMode=true" : "/api/trips";
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        console.log("[DEBUG] Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[DEBUG] API error:", errorData);
          throw new Error("Failed to fetch trips");
        }

        const data = await response.json();
        console.log("[DEBUG] API response data:", data);
        console.log("[DEBUG] Trips count:", data.trips?.length || 0);

        setTrips(data.trips || []);
      } catch (err) {
        console.error("[DEBUG] Error fetching trips:", err);
        setError("Failed to load trips. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      console.log("[DEBUG] Auth loaded, user exists, fetching trips");
      setLoading(true);
      fetchTrips();
    } else if (!authLoading && !user) {
      console.log("[DEBUG] Auth loaded, no user");
      setLoading(false);
    } else {
      console.log("[DEBUG] Still loading auth...");
    }
  }, [user, authLoading, isAdminMode]);

  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Separate trips into invitations (PENDING) and accepted trips (ACCEPTED or MAYBE)
  const myRsvpStatus = (trip: Trip) => {
    const myMembership = trip.members.find(m => m.userId === user?.uid);
    console.log(`[DEBUG] Trip "${trip.name}":`, {
      userId: user?.uid,
      memberCount: trip.members.length,
      foundMembership: !!myMembership,
      rsvpStatus: myMembership?.rsvpStatus,
      memberUserIds: trip.members.map(m => ({ userId: m.userId, email: m.user.email }))
    });
    return myMembership?.rsvpStatus || "PENDING";
  };

  const pendingInvitations = trips.filter(trip => myRsvpStatus(trip) === "PENDING");
  const declinedInvitations = trips.filter(trip => myRsvpStatus(trip) === "DECLINED");
  const acceptedTrips = trips.filter(trip => {
    const status = myRsvpStatus(trip);
    return status === "ACCEPTED" || status === "MAYBE";
  });

  console.log("[DEBUG] Trips categorized:", {
    totalTrips: trips.length,
    pendingInvitations: pendingInvitations.length,
    declinedInvitations: declinedInvitations.length,
    acceptedTrips: acceptedTrips.length,
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
        <div className="max-w-6xl mx-auto min-w-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-8 gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                My Stuff
              </h1>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Plot world domination
              </p>
            </div>
            {canCreateTrip && (
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={() => router.push("/trips/new")}
                  leftIcon={
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  }
                >
                  New Trip
                </Button>
              </div>
            )}
          </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Pending Invitations
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {pendingInvitations.length} trip{pendingInvitations.length !== 1 ? 's' : ''} awaiting your response
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingInvitations.map((trip) => (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="block bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm border-2 border-blue-200 dark:border-blue-800 p-6 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                >
                  <div className="flex justify-between items-start mb-3 gap-2 min-w-0">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex-1 min-w-0 break-words">
                      {trip.name}
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                      PENDING
                    </span>
                  </div>

                  <div className="mb-4 p-3 bg-white/70 dark:bg-zinc-800/70 rounded-lg">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                      Invited by {trip.createdBy.displayName}
                    </p>
                  </div>

                  {trip.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
                      {trip.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{trip.members.length} members</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Click to view invitation and respond →
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* My Trips */}
        {acceptedTrips.length === 0 && pendingInvitations.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No trips yet
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {!canCreateTrip ? "You have read-only access." : "Create your first trip to start planning!"}
            </p>
            {canCreateTrip && (
              <Button
                variant="primary"
                onClick={() => router.push("/trips/new")}
              >
                Create Trip
              </Button>
            )}
          </div>
        ) : acceptedTrips.length > 0 ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {acceptedTrips.length} active trip{acceptedTrips.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {acceptedTrips.map((trip) => {
                const userRsvp = myRsvpStatus(trip);
                return (
                  <a
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="block bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                  >
                    <div className="flex justify-between items-start mb-4 gap-2 min-w-0">
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex-1 min-w-0 break-words">
                        {trip.name}
                      </h3>
                      <div className="flex gap-1.5">
                        {userRsvp === "MAYBE" && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                            MAYBE
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            trip.status === "PLANNING"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : trip.status === "ACTIVE"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {trip.status}
                        </span>
                      </div>
                    </div>

                    {trip.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
                        {trip.description}
                      </p>
                    )}

                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                      Organized by {trip.createdBy.displayName ?? "Unknown"}
                    </p>


                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>
                        {trip.members.length === 0
                          ? "no-one"
                          : trip.members.length === 1
                          ? "1 person"
                          : `${trip.members.length} people`}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
