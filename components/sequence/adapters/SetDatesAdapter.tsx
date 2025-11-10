"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SetDatesAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

export default function SetDatesAdapter({ run, runStep }: SetDatesAdapterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [completing, setCompleting] = useState(false);

  const tripId = (run.payload as any)?.tripId;

  const handleSetDates = () => {
    if (!tripId) {
      alert("Trip ID not found. Please complete the previous step.");
      return;
    }
    // Navigate to trip edit page
    router.push(`/trips/${tripId}/edit?runId=${run.id}`);
  };

  const handleMarkDone = async () => {
    setCompleting(true);
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(`/api/sequences/runs/${run.id}/steps/${runStep.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          result: { datesSet: true },
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to complete step:", err);
    } finally {
      setCompleting(false);
    }
  };

  if (!tripId) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
        <p className="text-red-600">Missing trip information. Please restart the sequence.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
        Set Dates
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        When is this happening? Set start and end dates for your trip.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSetDates} variant="primary" size="lg">
          Edit Trip Dates
        </Button>
        <Button onClick={handleMarkDone} variant="secondary" size="lg" disabled={completing}>
          {completing ? "Saving..." : "Mark as Done"}
        </Button>
      </div>
    </div>
  );
}
