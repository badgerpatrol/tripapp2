"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { SpendStatus } from "@/lib/generated/prisma";
import LoginForm from "@/components/LoginForm";
import { Button } from "@/components/ui/button";

interface TripDetail {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  spendStatus: SpendStatus;
  rsvpStatus: string;
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
    triggerType: string | null;
    order: number;
  }>;
  spends?: Array<{
    id: string;
    description: string;
    amount: number;
    currency: string;
    fxRate: number;
    normalizedAmount: number;
    date: string;
    status: SpendStatus;
    notes: string | null;
    paidBy: {
      id: string;
      email: string;
      displayName: string | null;
    };
    category: {
      id: string;
      name: string;
    } | null;
    assignedPercentage?: number;
    assignments?: Array<{
      id: string;
      userId: string;
      shareAmount: number;
      normalizedShareAmount: number;
      user: {
        id: string;
        email: string;
        displayName: string | null;
      };
    }>;
  }>;
  balances?: Array<{
    userId: string;
    userEmail: string;
    userDisplayName: string | null;
    shareAmount: number;
    normalizedShareAmount: number;
    splitType: string;
  }>;
  totalSpent?: number;
  userOwes?: number;
  userIsOwed?: number;
  totalUnassigned?: number;
}

export default function StandaloneTripPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripId = params.id as string;

  const fetchTrip = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

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

      // Calculate total unassigned spend
      const tripData = data.trip;
      if (tripData.spends && tripData.spends.length > 0) {
        const totalUnassigned = tripData.spends.reduce((sum: number, spend: any) => {
          const assignedPercentage = spend.assignedPercentage || 0;
          const unassignedPercentage = 100 - assignedPercentage;
          const unassignedAmount = (spend.normalizedAmount * unassignedPercentage) / 100;
          return sum + unassignedAmount;
        }, 0);
        tripData.totalUnassigned = totalUnassigned;
      }

      setTrip(tripData);
    } catch (err: any) {
      console.error("Error fetching trip:", err);
      setError(err.message || "Failed to load trip");
    } finally {
      setLoading(false);
    }
  }, [user, tripId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTrip();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading, fetchTrip]);

  // Show loading state while checking authentication
  if (authLoading || (user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Sign in to view this trip
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              You need to be signed in to access this trip
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="max-w-md w-full">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-lg mb-4">
            {error}
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  // Show trip not found
  if (!loading && !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Trip not found
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            This trip doesn't exist or you don't have access to it.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/")}
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string = trip.baseCurrency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  // Check if user has accepted the invitation
  const hasAccepted = trip.userRsvpStatus === "ACCEPTED" || trip.userRsvpStatus === "MAYBE";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 break-words">
                {trip.name}
              </h1>
              {trip.description && (
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  {trip.description}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 text-sm font-medium rounded ${
                  trip.status === "PLANNING"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : trip.status === "ACTIVE"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : trip.status === "FINALIZED"
                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {trip.status}
              </span>
            </div>
          </div>

          {/* Trip Info */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Organized by</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {trip.organizer.displayName || trip.organizer.email}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Dates</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Currency</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {trip.baseCurrency}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RSVP Section (if pending) */}
        {trip.userRsvpStatus === "PENDING" && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              You've been invited!
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Please respond to this invitation to access all trip features.
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Visit the full trip page to respond to this invitation.
            </p>
          </div>
        )}

        {/* Show limited info if not accepted */}
        {!hasAccepted && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Trip Members
            </h2>
            <div className="space-y-2">
              {trip.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {participant.user.displayName || participant.user.email}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {participant.role}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      participant.rsvpStatus === "ACCEPTED"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : participant.rsvpStatus === "PENDING"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                        : participant.rsvpStatus === "MAYBE"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {participant.rsvpStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show full info if accepted */}
        {hasAccepted && (
          <>
            {/* Balance Summary */}
            {trip.totalSpent !== undefined && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Total Spent</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(trip.totalSpent)}
                  </p>
                </div>
                {trip.userOwes !== undefined && trip.userOwes > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-1">You Owe</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {formatCurrency(trip.userOwes)}
                    </p>
                  </div>
                )}
                {trip.userIsOwed !== undefined && trip.userIsOwed > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                    <p className="text-sm text-green-600 dark:text-green-400 mb-1">You're Owed</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(trip.userIsOwed)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Spends Section */}
            {trip.spends && trip.spends.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                  Expenses
                </h2>
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {trip.spends.map((spend) => (
                      <div key={spend.id} className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                              {spend.description}
                            </h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              Paid by {spend.paidBy.displayName || spend.paidBy.email}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">
                              {formatCurrency(spend.amount, spend.currency)}
                            </p>
                            {spend.currency !== trip.baseCurrency && (
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                ≈ {formatCurrency(spend.normalizedAmount)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {new Date(spend.date).toLocaleDateString()}
                          </span>
                          {spend.category && (
                            <>
                              <span className="text-zinc-400 dark:text-zinc-600">•</span>
                              <span className="text-zinc-600 dark:text-zinc-400">
                                {spend.category.name}
                              </span>
                            </>
                          )}
                          <span className="text-zinc-400 dark:text-zinc-600">•</span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              spend.status === "OPEN"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {spend.status}
                          </span>
                        </div>
                        {spend.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            {spend.notes}
                          </p>
                        )}
                        {spend.assignments && spend.assignments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                              Assigned to:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {spend.assignments.map((assignment) => (
                                <span
                                  key={assignment.id}
                                  className="inline-flex items-center gap-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded text-sm"
                                >
                                  <span className="text-zinc-900 dark:text-zinc-100">
                                    {assignment.user.displayName || assignment.user.email}
                                  </span>
                                  <span className="text-zinc-600 dark:text-zinc-400">
                                    {formatCurrency(assignment.normalizedShareAmount)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Settlement Section */}
            {trip.balances && trip.balances.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                  Balances
                </h2>
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
                  <div className="space-y-3">
                    {trip.balances
                      .sort((a, b) => b.normalizedShareAmount - a.normalizedShareAmount)
                      .map((balance) => (
                        <div
                          key={balance.userId}
                          className="flex items-center justify-between py-2"
                        >
                          <span className="text-zinc-900 dark:text-zinc-100">
                            {balance.userDisplayName || balance.userEmail}
                          </span>
                          <span
                            className={`font-medium ${
                              balance.normalizedShareAmount > 0
                                ? "text-green-600 dark:text-green-400"
                                : balance.normalizedShareAmount < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {balance.normalizedShareAmount > 0 ? "+" : ""}
                            {formatCurrency(balance.normalizedShareAmount)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            {trip.timeline && trip.timeline.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                  Timeline
                </h2>
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
                  <div className="space-y-4">
                    {trip.timeline
                      .sort((a, b) => a.order - b.order)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-700 last:border-0 last:pb-0"
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              item.isCompleted
                                ? "bg-green-100 dark:bg-green-900/30"
                                : "bg-zinc-100 dark:bg-zinc-700"
                            }`}
                          >
                            {item.isCompleted && (
                              <svg
                                className="w-4 h-4 text-green-600 dark:text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                {item.description}
                              </p>
                            )}
                            {item.date && (
                              <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                                {formatDate(item.date)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            This is a read-only view of the trip.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
          >
            Go to My Trips
          </Button>
        </div>
      </div>
    </div>
  );
}
