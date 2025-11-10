"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { zCreateChoiceConfig } from "@/types/sequence";

interface CreateChoiceAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

export default function CreateChoiceAdapter({ run, step, runStep }: CreateChoiceAdapterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tripId = (run.payload as any)?.tripId;
  const config = zCreateChoiceConfig.parse(step.config || {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) {
      alert("Trip ID not found. Please complete the previous step.");
      return;
    }

    setSubmitting(true);
    try {
      if (!user) return;
      const token = await user.getIdToken();

      // Create choice via API
      const choiceResponse = await fetch(`/api/choices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tripId,
          name: title || config.defaultTitle || "Menu",
          description: description || undefined,
        }),
      });

      if (!choiceResponse.ok) {
        throw new Error("Failed to create choice");
      }

      const choiceData = await choiceResponse.json();
      const choiceId = choiceData.choice?.id;

      // Complete the step with choiceId
      const completeResponse = await fetch(`/api/sequences/runs/${run.id}/steps/${runStep.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          result: { choiceId },
          payloadPatch: { choiceId },
        }),
      });

      if (completeResponse.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to create choice:", err);
      alert("Failed to create choice. Please try again.");
    } finally {
      setSubmitting(false);
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
        Create a Choice
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Create a menu or voting list where everyone can pick their preferences.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={config.defaultTitle || "Menu"}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description {config.descriptionHint && `(${config.descriptionHint})`}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? "Creating..." : "Create Choice"}
        </Button>
      </form>
    </div>
  );
}
