"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface InvitePeopleAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

export default function InvitePeopleAdapter({ run, runStep }: InvitePeopleAdapterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [completing, setCompleting] = useState(false);

  const tripId = (run.payload as any)?.tripId;

  const handleInvitePeople = () => {
    if (!tripId) {
      alert("Trip ID not found. Please complete the previous step.");
      return;
    }
    // Navigate to trip detail page where members can be managed
    router.push(`/trips/${tripId}?runId=${run.id}`);
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
          result: { invited: true },
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
        Invite People
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Add friends to your trip so they can see plans and contribute.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleInvitePeople} variant="primary" size="lg">
          Manage Participants
        </Button>
        <Button onClick={handleMarkDone} variant="secondary" size="lg" disabled={completing}>
          {completing ? "Saving..." : "Mark as Done"}
        </Button>
      </div>
    </div>
  );
}
