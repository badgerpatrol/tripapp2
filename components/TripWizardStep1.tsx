"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

interface TripWizardStep1Props {
  tripId?: string | null;
  onCancel: () => void;
}

export default function TripWizardStep1({ tripId: initialTripId, onCancel }: TripWizardStep1Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!initialTripId);
  const [error, setError] = useState<string | null>(null);

  // Track saved trip ID - once saved, cancel should be disabled
  const [savedTripId, setSavedTripId] = useState<string | null>(initialTripId || null);

  // Track original values to detect changes
  const originalValues = useRef<{ name: string; startDate: string; endDate: string } | null>(null);

  // Load existing trip data if editing
  useEffect(() => {
    async function loadTrip() {
      if (!initialTripId || !user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/trips/${initialTripId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const trip = data.trip;
          if (trip) {
            const loadedName = trip.name || "";
            // Format dates for datetime-local input (YYYY-MM-DDTHH:MM)
            const formatDateTimeLocal = (dateString: string | null): string => {
              if (!dateString) return "";
              const d = new Date(dateString);
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const hours = String(d.getHours()).padStart(2, '0');
              const minutes = String(d.getMinutes()).padStart(2, '0');
              return `${year}-${month}-${day}T${hours}:${minutes}`;
            };
            const loadedStartDate = formatDateTimeLocal(trip.startDate);
            const loadedEndDate = formatDateTimeLocal(trip.endDate);

            setName(loadedName);
            setStartDate(loadedStartDate);
            setEndDate(loadedEndDate);

            // Store original values to track changes
            originalValues.current = {
              name: loadedName,
              startDate: loadedStartDate,
              endDate: loadedEndDate,
            };
          }
        }
      } catch (err) {
        console.error("Error loading trip:", err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadTrip();
  }, [initialTripId, user]);

  // Auto-set end date to match start date when start date is selected
  useEffect(() => {
    if (startDate) {
      if (!endDate || endDate < startDate) {
        setEndDate(startDate);
      }
    }
  }, [startDate, endDate]);

  // Check if values have changed from original
  const hasChanges = (): boolean => {
    if (!originalValues.current) return true; // New trip, always has "changes"
    return (
      name !== originalValues.current.name ||
      startDate !== originalValues.current.startDate ||
      endDate !== originalValues.current.endDate
    );
  };

  const createOrUpdateTrip = async (): Promise<string | null> => {
    setError(null);
    setLoading(true);

    try {
      if (!user) {
        throw new Error("You must be signed in to create a trip");
      }

      const formData = {
        name: name.trim(),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      };

      const idToken = await user.getIdToken();

      if (savedTripId) {
        // Update existing trip
        const response = await fetch(`/api/trips/${savedTripId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to update trip");
        }

        // Update original values after successful save
        originalValues.current = {
          name: name.trim(),
          startDate,
          endDate,
        };

        return savedTripId;
      } else {
        // Create new trip
        const response = await fetch("/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to create trip");
        }

        // Remember that we've saved the trip
        setSavedTripId(result.trip.id);

        // Store original values after successful save
        originalValues.current = {
          name: name.trim(),
          startDate,
          endDate,
        };

        return result.trip.id;
      }
    } catch (err) {
      console.error("Error saving trip:", err);
      setError(err instanceof Error ? err.message : "Failed to save trip. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    // If trip is already saved and no changes, just navigate
    if (savedTripId && !hasChanges()) {
      router.push(`/trips/${savedTripId}`);
      return;
    }

    const tripId = await createOrUpdateTrip();
    if (tripId) {
      router.push(`/trips/${tripId}`);
    }
  };

  const handleNext = async () => {
    // If trip is already saved and no changes, just navigate
    if (savedTripId && !hasChanges()) {
      router.push(`/trips/new/step2?tripId=${savedTripId}`);
      return;
    }

    const tripId = await createOrUpdateTrip();
    if (tripId) {
      router.push(`/trips/new/step2?tripId=${tripId}`);
    }
  };

  const handleCancel = async () => {
    // If trip has been saved, delete it before canceling
    if (savedTripId && user) {
      setLoading(true);
      try {
        const idToken = await user.getIdToken();
        await fetch(`/api/trips/${savedTripId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
      } catch (err) {
        console.error("Error deleting trip:", err);
        // Continue with cancel even if delete fails
      } finally {
        setLoading(false);
      }
    }
    // Always go to home screen
    router.push("/");
  };

  if (initialLoading) {
    return (
      <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Trip Name */}
      <Field label="Trip Name" htmlFor="name" required>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g., Summer Vacation 2025"
          autoFocus
        />
      </Field>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
        <Field label="Start Date & Time" htmlFor="startDate">
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>

        <Field label="End Date & Time" htmlFor="endDate">
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
          />
        </Field>
      </div>

      {/* Action Buttons - Cancel | Done | Next */}
      <div className="flex gap-3 pt-4 min-w-0">
        <Button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          variant="secondary"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleDone}
          disabled={loading || !name.trim()}
          loading={loading}
          variant="secondary"
          className="flex-1"
        >
          Done
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={loading || !name.trim()}
          loading={loading}
          variant="primary"
          className="flex-1"
        >
          Next
        </Button>
      </div>

      {/* Help text */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        Press Done to create the trip and add more details later, or Next to continue setup
      </p>
    </div>
  );
}
