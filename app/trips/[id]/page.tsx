"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

interface TripDetail {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdAt: string;
  organizer: {
    id: string;
    email: string;
    displayName: string | null;
  };
  participants: Array<{
    id: string;
    role: string;
    rsvpStatus: string;
    joinedAt: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
  userRole: string | null;
  userRsvpStatus: string | null;
  timeline?: Array<{
    id: string;
    title: string;
    description: string | null;
    date: string | null;
    isCompleted: boolean;
    completedAt: string | null;
    order: number;
  }>;
  spends?: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    normalizedAmount: number;
    date: string;
    paidBy: {
      id: string;
      email: string;
      displayName: string | null;
    };
    category: {
      id: string;
      name: string;
    } | null;
  }>;
  userAssignments?: Array<{
    id: string;
    userId: string;
    shareAmount: number;
    normalizedShareAmount: number;
    splitType: string;
  }>;
  totalSpent?: number;
  userOwes?: number;
  userIsOwed?: number;
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripId = params.id as string;

  useEffect(() => {
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("API Error:", response.status, errorData);
          throw new Error(errorData.error || `Failed to fetch trip (${response.status})`);
        }

        const data = await response.json();
        console.log("Trip data received:", data);
        setTrip(data.trip);
      } catch (err) {
        console.error("Error fetching trip:", err);
        setError(err instanceof Error ? err.message : "Failed to load trip. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchTrip();
    } else if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, tripId, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading trip...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "Trip not found"}</p>
          <a
            href="/trips"
            className="tap-target inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Trips
          </a>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <a
            href="/trips"
            className="tap-target text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Trips
          </a>
        </div>

        {/* Trip Header */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                {trip.name}
              </h1>
              {trip.description && (
                <p className="text-zinc-600 dark:text-zinc-400">{trip.description}</p>
              )}
            </div>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Dates</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDate(trip.startDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Members</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {trip.participants.length} people
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Currency</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {trip.baseCurrency}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Summary (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && (trip.userOwes !== undefined || trip.userIsOwed !== undefined || trip.totalSpent !== undefined) && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Your Balance</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Trip Spend */}
              {trip.totalSpent !== undefined && (
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Total Trip Spend</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {trip.baseCurrency} {trip.totalSpent.toFixed(2)}
                  </p>
                </div>
              )}

              {/* You Owe */}
              {trip.userOwes !== undefined && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">You Owe</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {trip.baseCurrency} {trip.userOwes.toFixed(2)}
                  </p>
                </div>
              )}

              {/* You Are Owed */}
              {trip.userIsOwed !== undefined && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">You Are Owed</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {trip.baseCurrency} {trip.userIsOwed.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline (if available) */}
        {trip.timeline && trip.timeline.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Timeline</h2>
            <div className="space-y-3">
              {trip.timeline.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${
                    item.isCompleted
                      ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                      : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  >
                    {item.isCompleted && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    {item.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{item.description}</p>
                    )}
                    {item.date && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                        {formatDate(item.date)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spends (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && trip.spends && trip.spends.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Spends</h2>
            <div className="space-y-3">
              {trip.spends.map((spend) => (
                <div
                  key={spend.id}
                  className="flex items-start justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{spend.description}</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Paid by {spend.paidBy.displayName || spend.paidBy.email}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {spend.currency} {spend.amount.toFixed(2)}
                        </p>
                        {spend.currency !== trip.baseCurrency && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-500">
                            {trip.baseCurrency} {spend.normalizedAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                      <span>{formatDate(spend.date)}</span>
                      {spend.category && (
                        <>
                          <span>•</span>
                          <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                            {spend.category.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Assignments (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && trip.userAssignments && trip.userAssignments.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Your Assignments</h2>
            <div className="space-y-3">
              {trip.userAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700"
                >
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Share Amount</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      Split Type: {assignment.splitType}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {trip.baseCurrency} {assignment.normalizedShareAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Members</h2>
          <div className="space-y-3">
            {trip.participants.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {(member.user.displayName || member.user.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {member.user.displayName || member.user.email}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {member.role}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      member.rsvpStatus === "ACCEPTED"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : member.rsvpStatus === "DECLINED"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {member.rsvpStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
