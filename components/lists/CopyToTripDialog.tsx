"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";

interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  status: string;
}

interface CopyToTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: {
    id: string;
    title: string;
    type: string;
  };
  onSuccess: () => void;
}

type MergeMode = "NEW_INSTANCE" | "REPLACE" | "MERGE_ADD" | "MERGE_ADD_ALLOW_DUPES";

export function CopyToTripDialog({
  isOpen,
  onClose,
  template,
  onSuccess,
}: CopyToTripDialogProps) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [mergeMode, setMergeMode] = useState<MergeMode>("NEW_INSTANCE");
  const [loading, setLoading] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchTrips();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (selectedTripId && user) {
      checkForConflict();
    } else {
      setHasConflict(false);
    }
  }, [selectedTripId, user]);

  const fetchTrips = async () => {
    if (!user) return;

    setLoadingTrips(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/trips", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips || []);
      }
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoadingTrips(false);
    }
  };

  const checkForConflict = async () => {
    if (!user || !selectedTripId) return;

    setCheckingConflict(true);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        title: template.title,
        type: template.type,
      });

      const response = await fetch(
        `/api/trips/${selectedTripId}/lists/check-conflict?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check for conflicts");
      }

      const data = await response.json();
      setHasConflict(data.exists);
    } catch (err) {
      console.error("Error checking for conflict:", err);
      // In case of error, default to showing conflict options to be safe
      setHasConflict(true);
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleCopy = async () => {
    if (!user || !selectedTripId) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/lists/templates/${template.id}/copy-to-trip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tripId: selectedTripId,
            mode: mergeMode,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to copy template to trip");
      }

      onSuccess();
      onClose();

      // Reset state
      setSelectedTripId("");
      setMergeMode("NEW_INSTANCE");
      setHasConflict(false);
    } catch (err: any) {
      console.error("Error copying template:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Copy to Trip"
      size="lg"
      footer={
        <>
          <Button
            onClick={onClose}
            className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={loading || !selectedTripId}
          >
            {loading ? "Copying..." : "Copy to Trip"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-zinc-600 dark:text-zinc-400">
          Copy <strong>{template.title}</strong> to one of your trips.
        </p>

        {/* Trip Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Select Trip
          </label>
          {loadingTrips ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : trips.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              No trips found. Create a trip first.
            </p>
          ) : (
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Choose a trip...</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name} ({trip.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Merge Mode - only show when trip is selected AND there's a conflict */}
        {selectedTripId && checkingConflict && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
              Checking for conflicts...
            </span>
          </div>
        )}

        {selectedTripId && !checkingConflict && hasConflict && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              There's already a list with this name. How do you want to handle it?
            </label>
            <div className="space-y-2">
              <label className="flex items-start p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="mergeMode"
                  value="NEW_INSTANCE"
                  checked={mergeMode === "NEW_INSTANCE"}
                  onChange={(e) => setMergeMode(e.target.value as MergeMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Create New List
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Add a new list (will add suffix if name exists)
                  </div>
                </div>
              </label>

              <label className="flex items-start p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="mergeMode"
                  value="MERGE_ADD"
                  checked={mergeMode === "MERGE_ADD"}
                  onChange={(e) => setMergeMode(e.target.value as MergeMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Merge (Skip Duplicates)
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Add new items, skip items with matching names
                  </div>
                </div>
              </label>

              <label className="flex items-start p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="mergeMode"
                  value="MERGE_ADD_ALLOW_DUPES"
                  checked={mergeMode === "MERGE_ADD_ALLOW_DUPES"}
                  onChange={(e) => setMergeMode(e.target.value as MergeMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Merge (Allow Duplicates)
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Add all items, even if some have matching names
                  </div>
                </div>
              </label>

              <label className="flex items-start p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer">
                <input
                  type="radio"
                  name="mergeMode"
                  value="REPLACE"
                  checked={mergeMode === "REPLACE"}
                  onChange={(e) => setMergeMode(e.target.value as MergeMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white text-red-600 dark:text-red-400">
                    Replace Existing List
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Delete the existing list and create a fresh copy
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
