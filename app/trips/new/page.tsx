"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import CreateTripForm from "@/components/CreateTripForm";
import { ListWorkflowModal } from "@/components/lists/ListWorkflowModal";

interface TripData {
  id: string;
  name: string;
  participants: Array<{
    id: string;
    role: string;
    rsvpStatus: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
}

export default function NewTripPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    tripId: string | null;
    shouldNavigate: boolean;
  }>({
    isOpen: false,
    tripId: null,
    shouldNavigate: false,
  });
  const [tripData, setTripData] = useState<TripData | null>(null);

  // Fetch trip data when modal opens
  useEffect(() => {
    const fetchTrip = async () => {
      if (!modalState.tripId || !user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/trips/${modalState.tripId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTripData(data);
        }
      } catch (err) {
        console.error("Error fetching trip:", err);
      }
    };

    if (modalState.isOpen && modalState.tripId) {
      fetchTrip();
    }
  }, [modalState.isOpen, modalState.tripId, user]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="tap-target text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium mb-4 inline-flex items-center gap-2"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Create a New Trip
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Plan your next adventure with friends and family
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8">
          <CreateTripForm
            onSuccess={(tripId, hadTemplate) => {
              if (hadTemplate) {
                // Open the modal first, navigate when it closes
                setModalState({ isOpen: true, tripId, shouldNavigate: true });
              } else {
                // No template selected, just navigate
                router.push(`/trips/${tripId}`);
              }
            }}
            onCancel={() => router.back()}
          />
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            What happens next?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• A timeline with RSVP deadline and spending windows will be created</li>
            <li>• You can invite members to join your trip</li>
            <li>• Track shared expenses and settle up automatically</li>
          </ul>
        </div>
      </div>

      {/* List Workflow Modal */}
      {modalState.tripId && tripData && (
        <ListWorkflowModal
          tripId={modalState.tripId}
          tripName={tripData.name}
          isOpen={modalState.isOpen}
          onClose={() => {
            const tripId = modalState.tripId;
            setModalState({ isOpen: false, tripId: null, shouldNavigate: false });
            setTripData(null);
            // Navigate after modal closes if needed
            if (modalState.shouldNavigate && tripId) {
              router.push(`/trips/${tripId}`);
            }
          }}
          currentMembers={tripData.participants}
        />
      )}
    </div>
  );
}
