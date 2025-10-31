"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { SpendStatus } from "@/lib/generated/prisma";
import EditTripDialog from "./EditTripDialog";
import InviteUsersDialog from "./InviteUsersDialog";
import AddSpendDialog from "./AddSpendDialog";
import EditSpendDialog from "./EditSpendDialog";
import AssignSpendDialog from "./AssignSpendDialog";
import { SpendListView } from "@/components/SpendListView";
import { SpendFilters } from "@/components/SpendFilters";

interface TripDetail {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  spendStatus: SpendStatus;
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
      user: {
        id: string;
        email: string;
        displayName: string | null;
      };
    }>;
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAddSpendDialogOpen, setIsAddSpendDialogOpen] = useState(false);
  const [isEditSpendDialogOpen, setIsEditSpendDialogOpen] = useState(false);
  const [isAssignSpendDialogOpen, setIsAssignSpendDialogOpen] = useState(false);
  const [selectedSpendId, setSelectedSpendId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Spend filtering and sorting state
  const [statusFilter, setStatusFilter] = useState<SpendStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "description">("description");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

  const handleEditSuccess = () => {
    // Refetch the trip data after successful edit
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  const handleInviteSuccess = () => {
    // Refetch the trip data after successful invitations
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  const handleAddSpendSuccess = () => {
    // Refetch the trip data after successful spend creation
    const fetchTrip = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTrip(data.trip);
        }
      } catch (err) {
        console.error("Error refetching trip:", err);
      }
    };

    fetchTrip();
  };

  // Filter and sort spends
  const getFilteredAndSortedSpends = () => {
    if (!trip?.spends) return [];

    let filteredSpends = [...trip.spends];

    // Apply status filter
    if (statusFilter !== "all") {
      filteredSpends = filteredSpends.filter((spend) => spend.status === statusFilter);
    }

    // Apply sorting
    filteredSpends.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = a.normalizedAmount - b.normalizedAmount;
          break;
        case "description":
          comparison = a.description.localeCompare(b.description);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filteredSpends;
  };

  // Spend action handlers
  const handleEditSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsEditSpendDialogOpen(true);
  };

  const handleAssignSpend = (spendId: string) => {
    setSelectedSpendId(spendId);
    setIsAssignSpendDialogOpen(true);
  };

  const handleJoinSpend = async (spendId: string) => {
    if (!user || !trip) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === spendId);

      if (!spend) return;

      // Get existing assignments
      const existingAssignments = spend.assignments || [];

      // Check if user is already involved
      if (existingAssignments.some(a => a.userId === user.uid)) {
        alert("You are already involved in this spend");
        return;
      }

      // Add current user to the assignments
      const newAssignments = [
        ...existingAssignments.map(a => ({
          userId: a.userId,
          shareAmount: 0,
          normalizedShareAmount: 0,
          splitType: "EQUAL" as const,
        })),
        {
          userId: user.uid,
          shareAmount: 0,
          normalizedShareAmount: 0,
          splitType: "EQUAL" as const,
        }
      ];

      const response = await fetch(`/api/spends/${spendId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments: newAssignments,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to join spend");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }
    } catch (err) {
      console.error("Error joining spend:", err);
      alert(err instanceof Error ? err.message : "Failed to join spend");
    }
  };

  const handleLeaveSpend = async (spendId: string) => {
    if (!user || !trip) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === spendId);

      if (!spend) return;

      // Get existing assignments
      const existingAssignments = spend.assignments || [];

      // Check if user is the spender
      if (spend.paidBy.id === user.uid) {
        alert("You cannot leave a spend you created. Delete it instead.");
        return;
      }

      // Check if user is involved
      if (!existingAssignments.some(a => a.userId === user.uid)) {
        alert("You are not involved in this spend");
        return;
      }

      // Remove current user from the assignments
      const newAssignments = existingAssignments
        .filter(a => a.userId !== user.uid)
        .map(a => ({
          userId: a.userId,
          shareAmount: 0,
          normalizedShareAmount: 0,
          splitType: "EQUAL" as const,
        }));

      const response = await fetch(`/api/spends/${spendId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assignments: newAssignments,
          replaceAll: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to leave spend");
      }

      // Refetch trip data
      const tripResponse = await fetch(`/api/trips/${tripId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (tripResponse.ok) {
        const data = await tripResponse.json();
        setTrip(data.trip);
      }
    } catch (err) {
      console.error("Error leaving spend:", err);
      alert(err instanceof Error ? err.message : "Failed to leave spend");
    }
  };

  const handleFinalizeSpend = async (spendId: string) => {
    if (!user || !trip) return;

    try {
      const idToken = await user.getIdToken();
      const spend = trip.spends?.find((s) => s.id === spendId);

      if (!spend) return;

      // If already closed, reopen it using the reopen endpoint
      if (spend.status === "CLOSED") {
        
        const response = await fetch(`/api/spends/${spendId}/reopen`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          // Refetch trip data
          const tripResponse = await fetch(`/api/trips/${tripId}`, {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (tripResponse.ok) {
            const data = await tripResponse.json();
            setTrip(data.trip);
          }
        } else {
          alert("Failed to reopen spend");
        }
      } else {
        // Check if assignments are 100% before closing
        const assignedPercentage = spend.assignedPercentage || 0;
        const isFullyAssigned = Math.abs(assignedPercentage - 100) < 0.1;

        if (!isFullyAssigned) {
          const shouldForce = confirm(
            `This spend is only ${assignedPercentage.toFixed(1)}% assigned. ` +
            `Close anyway? (Once closed, the spend cannot be edited)`
          );
          if (!shouldForce) return;
        } 

        // Close the spend
        const response = await fetch(`/api/spends/${spendId}/finalize`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ force: !isFullyAssigned }),
        });

        if (response.ok) {
          // Refetch trip data
          const tripResponse = await fetch(`/api/trips/${tripId}`, {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (tripResponse.ok) {
            const data = await tripResponse.json();
            setTrip(data.trip);
          }
        } else {
          const errorData = await response.json();
          alert(`Failed to close spend: ${errorData.error}`);
        }
      }
    } catch (err) {
      console.error("Error closing/reopening spend:", err);
      alert("Failed to close/reopen spend");
    }
  };

  const handleDeleteSpend = async (spendId: string) => {
    if (!user) return;

    const confirmed = window.confirm("Are you sure you want to delete this spend?");
    if (!confirmed) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spendId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        // Refetch trip data
        const tripResponse = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (tripResponse.ok) {
          const data = await tripResponse.json();
          setTrip(data.trip);
        }
      } else {
        alert("Failed to delete spend");
      }
    } catch (err) {
      console.error("Error deleting spend:", err);
      alert("Failed to delete spend");
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${userName} from this trip?`
    );

    if (!confirmed) return;

    setRemovingUserId(userId);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/trips/${tripId}/members/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to remove member (${response.status})`
        );
      }

      // Success - refresh the trip data
      handleInviteSuccess();
    } catch (err) {
      console.error("Error removing member:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove member. Please try again."
      );
    } finally {
      setRemovingUserId(null);
    }
  };

  const isOwner = trip?.userRole === "OWNER";
  const canInvite = trip?.userRole === "OWNER" || trip?.userRole === "ADMIN";

  // Check if current user can finalize (close/reopen) a specific spend
  const canUserFinalizeSpend = (spend: { paidBy: { id: string } }) => {
    if (!user) return false;

    // User can finalize if they are:
    // 1. The spender (person who paid for the spend)
    // 2. The trip organizer (OWNER or ADMIN role)
    const isSpender = spend.paidBy.id === user.uid;
    const isOrganizer = canInvite;

    return isSpender || isOrganizer;
  };

  const handleToggleTripSpendStatus = async () => {
    if (!user || !trip) return;

    // Default to OPEN if spendStatus is undefined (for backwards compatibility)
    const currentStatus = trip.spendStatus || SpendStatus.OPEN;
    const isClosing = currentStatus === SpendStatus.OPEN;

    console.log("Toggle spend status:", { currentStatus, isClosing, tripSpendStatus: trip.spendStatus });

    

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/spend-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        // Refetch trip data
        const tripResponse = await fetch(`/api/trips/${tripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (tripResponse.ok) {
          const data = await tripResponse.json();
          setTrip(data.trip);
        } else {
          alert("Failed to refresh trip data after status change");
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to ${isClosing ? "close" : "open"} spending: ${errorData.error}`);
      }
    } catch (err) {
      console.error("Error toggling trip spend status:", err);
      alert(`Failed to toggle spending status: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleRsvpResponse = async (status: "ACCEPTED" | "DECLINED" | "MAYBE") => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/members/${user.uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ rsvpStatus: status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to update RSVP (${response.status})`);
      }

      // Success - refresh the trip data
      handleEditSuccess();
    } catch (err) {
      console.error("Error updating RSVP:", err);
      setError(err instanceof Error ? err.message : "Failed to update RSVP. Please try again.");
    }
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
            <div className="flex items-center gap-3">
              
              {isOwner && (
                <button
                  onClick={() => setIsEditDialogOpen(true)}
                  className="tap-target px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
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

        {/* RSVP Response Card (for invitees) */}
        {trip.userRsvpStatus === "PENDING" && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm border-2 border-blue-200 dark:border-blue-800 p-6 md:p-8 mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  You've been invited to {trip.name}!
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {trip.organizer.displayName || trip.organizer.email} has invited you to join this trip.
                  Please respond to let them know if you can make it.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleRsvpResponse("ACCEPTED")}
                className="tap-target flex-1 min-w-[140px] px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Accept
              </button>
              <button
                onClick={() => handleRsvpResponse("MAYBE")}
                className="tap-target flex-1 min-w-[140px] px-6 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Maybe
              </button>
              <button
                onClick={() => handleRsvpResponse("DECLINED")}
                className="tap-target flex-1 min-w-[140px] px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Current RSVP Status (for users who have responded) */}
        {(trip.userRsvpStatus === "ACCEPTED" || trip.userRsvpStatus === "DECLINED" || trip.userRsvpStatus === "MAYBE") && (
          <div className={`rounded-xl shadow-sm border p-6 md:p-8 mb-6 ${
            trip.userRsvpStatus === "ACCEPTED"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : trip.userRsvpStatus === "DECLINED"
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  trip.userRsvpStatus === "ACCEPTED"
                    ? "bg-green-100 dark:bg-green-900/50"
                    : trip.userRsvpStatus === "DECLINED"
                    ? "bg-red-100 dark:bg-red-900/50"
                    : "bg-yellow-100 dark:bg-yellow-900/50"
                }`}>
                  <svg className={`w-6 h-6 ${
                    trip.userRsvpStatus === "ACCEPTED"
                      ? "text-green-600 dark:text-green-400"
                      : trip.userRsvpStatus === "DECLINED"
                      ? "text-red-600 dark:text-red-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {trip.userRsvpStatus === "ACCEPTED" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : trip.userRsvpStatus === "DECLINED" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </div>
                <div>
                  <h3 className={`text-lg font-bold mb-1 ${
                    trip.userRsvpStatus === "ACCEPTED"
                      ? "text-green-900 dark:text-green-100"
                      : trip.userRsvpStatus === "DECLINED"
                      ? "text-red-900 dark:text-red-100"
                      : "text-yellow-900 dark:text-yellow-100"
                  }`}>
                    You {trip.userRsvpStatus === "ACCEPTED" ? "accepted" : trip.userRsvpStatus === "DECLINED" ? "declined" : "might attend"} this invitation
                  </h3>
                  <p className={`text-sm ${
                    trip.userRsvpStatus === "ACCEPTED"
                      ? "text-green-700 dark:text-green-300"
                      : trip.userRsvpStatus === "DECLINED"
                      ? "text-red-700 dark:text-red-300"
                      : "text-yellow-700 dark:text-yellow-300"
                  }`}>
                    {trip.userRsvpStatus === "ACCEPTED" && "Of course you're in!"}
                    {trip.userRsvpStatus === "DECLINED" && "Shunning it."}
                    {trip.userRsvpStatus === "MAYBE" && "Faffing at the moment but will make your mind up later."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditDialogOpen(true)}
                className={`tap-target px-4 py-2 rounded-lg font-medium transition-colors ${
                  trip.userRsvpStatus === "ACCEPTED"
                    ? "bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-900/70 text-green-700 dark:text-green-300"
                    : trip.userRsvpStatus === "DECLINED"
                    ? "bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 text-red-700 dark:text-red-300"
                    : "bg-yellow-100 dark:bg-yellow-900/50 hover:bg-yellow-200 dark:hover:bg-yellow-900/70 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                Change Response
              </button>
            </div>

            {/* Quick change buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-current/20">
              <button
                onClick={() => handleRsvpResponse("ACCEPTED")}
                disabled={trip.userRsvpStatus === "ACCEPTED"}
                className="tap-target px-4 py-2 rounded-lg bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => handleRsvpResponse("MAYBE")}
                disabled={trip.userRsvpStatus === "MAYBE"}
                className="tap-target px-4 py-2 rounded-lg bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Maybe
              </button>
              <button
                onClick={() => handleRsvpResponse("DECLINED")}
                disabled={trip.userRsvpStatus === "DECLINED"}
                className="tap-target px-4 py-2 rounded-lg bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        )}

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

        {/* Assign Tasks (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && user && (() => {
          // Find all spends where the current user is involved but has shareAmount = 0 (pending assignment)
          const pendingAssignments = trip.spends
            ?.filter((spend) => {
              const userAssignment = spend.assignments?.find((a) => a.userId === user.uid);
              return userAssignment !== undefined; // User is tagged as involved
            })
            .map((spend) => {
              const userAssignment = spend.assignments?.find((a) => a.userId === user.uid);
              return {
                spend,
                assignment: userAssignment,
              };
            }) || [];

          // TODO: Implement pending assignments display
          return null;
        })()}

        {/* Spends (for accepted members) */}
        {trip.userRsvpStatus === "ACCEPTED" && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Spends</h2>
                {(trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    Spending Closed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddSpendDialogOpen(true)}
                  disabled={(trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED}
                  className="tap-target px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium transition-colors"
                >
                  Add Spend
                </button>
                {canInvite && (
                  <button
                    onClick={handleToggleTripSpendStatus}
                    className={`tap-target px-4 py-2 rounded-lg font-medium transition-colors ${
                      (trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED
                        ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {(trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED ? "Reopen Spending" : "Close Spending"}
                  </button>
                )}
              </div>
            </div>

            {/* Spending Status Notice */}
            

            {trip.spends && trip.spends.length > 0 ? (
              <>
                {/* Filters */}
                <div className="mb-4">
                  <SpendFilters
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                  />
                </div>

                {/* Spend List */}
                <SpendListView
                  spends={getFilteredAndSortedSpends().map((spend) => ({
                    ...spend,
                    date: new Date(spend.date),
                  }))}
                  currentUserId={user?.uid}
                  canUserFinalize={canUserFinalizeSpend}
                  onEdit={handleEditSpend}
                  onAssign={handleAssignSpend}
                  onJoin={handleJoinSpend}
                  onLeave={handleLeaveSpend}
                  onFinalize={handleFinalizeSpend}
                  onDelete={handleDeleteSpend}
                />
              </>
            ) : (
              <div className="text-center py-8">
                <svg className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-zinc-600 dark:text-zinc-400">No spends recorded yet</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">Click "Add Spend" to record your first expense</p>
              </div>
            )}
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Members</h2>
            {canInvite && (
              <button
                onClick={() => setIsInviteDialogOpen(true)}
                className="tap-target px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Users
              </button>
            )}
          </div>
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
                  {member.role === "OWNER" && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {member.role}
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      member.rsvpStatus === "ACCEPTED"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : member.rsvpStatus === "DECLINED"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : member.rsvpStatus === "MAYBE"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {member.rsvpStatus}
                  </span>
                  {member.role !== "OWNER" && canInvite && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.user.id, member.user.displayName || member.user.email)}
                      disabled={removingUserId === member.user.id}
                      className="ml-1 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove member"
                    >
                      {removingUserId === member.user.id ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Trip Dialog */}
      {trip && (
        <EditTripDialog
          trip={trip}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Invite Users Dialog */}
      {trip && (
        <InviteUsersDialog
          tripId={trip.id}
          tripName={trip.name}
          isOpen={isInviteDialogOpen}
          onClose={() => setIsInviteDialogOpen(false)}
          onSuccess={handleInviteSuccess}
          currentMembers={trip.participants}
        />
      )}

      {/* Add Spend Dialog */}
      {trip && (
        <AddSpendDialog
          trip={{ id: trip.id, baseCurrency: trip.baseCurrency }}
          isOpen={isAddSpendDialogOpen}
          onClose={() => setIsAddSpendDialogOpen(false)}
          onSuccess={handleAddSpendSuccess}
        />
      )}

      {/* Edit Spend Dialog */}
      {trip && selectedSpendId && (
        <EditSpendDialog
          spend={trip.spends?.find((s) => s.id === selectedSpendId) || null}
          trip={{ id: trip.id, baseCurrency: trip.baseCurrency }}
          isOpen={isEditSpendDialogOpen}
          onClose={() => {
            setIsEditSpendDialogOpen(false);
            setSelectedSpendId(null);
          }}
          onSuccess={handleAddSpendSuccess}
        />
      )}

      {/* Assign Spend Dialog */}
      {trip && selectedSpendId && (
        <AssignSpendDialog
          spend={
            trip.spends?.find((s) => s.id === selectedSpendId) || {
              id: selectedSpendId,
              description: "",
              amount: 0,
              currency: trip.baseCurrency,
            }
          }
          participants={trip.participants}
          tripId={trip.id}
          isOpen={isAssignSpendDialogOpen}
          onClose={() => {
            setIsAssignSpendDialogOpen(false);
            setSelectedSpendId(null);
          }}
          onSuccess={handleAddSpendSuccess}
        />
      )}
    </div>
  );
}
