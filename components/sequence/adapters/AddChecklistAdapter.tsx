"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { zAddChecklistConfig } from "@/types/sequence";

interface AddChecklistAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

export default function AddChecklistAdapter({ run, step, runStep }: AddChecklistAdapterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const config = zAddChecklistConfig.parse(step.config || {});

  const [items, setItems] = useState<string[]>(
    config.items.length > 0 ? config.items : [""]
  );
  const [submitting, setSubmitting] = useState(false);

  const tripId = (run.payload as any)?.tripId;

  const handleAddItem = () => {
    setItems([...items, ""]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) {
      alert("Trip ID not found. Please complete the previous step.");
      return;
    }

    // Filter out empty items
    const validItems = items.filter(item => item.trim());

    if (validItems.length === 0) {
      alert("Please add at least one checklist item.");
      return;
    }

    setSubmitting(true);
    try {
      if (!user) return;
      const token = await user.getIdToken();

      // Create checklist - you'll need to implement this API endpoint
      // For now, we'll just complete the step
      await fetch(`/api/sequences/runs/${run.id}/steps/${runStep.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          result: { items: validItems },
          payloadPatch: { checklistItems: validItems },
        }),
      });

      router.refresh();
    } catch (err) {
      console.error("Failed to add checklist:", err);
      alert("Failed to add checklist. Please try again.");
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
        Add Checklist Items
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Create a checklist of things to do for this trip.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleItemChange(index, e.target.value)}
              placeholder={`Item ${index + 1}`}
              className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="text-red-600 dark:text-red-400 text-sm hover:underline px-2"
              >
                Remove
              </button>
            )}
          </div>
        ))}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button type="button" onClick={handleAddItem} variant="secondary">
            Add Another Item
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={submitting}>
            {submitting ? "Saving..." : "Save Checklist"}
          </Button>
        </div>
      </form>
    </div>
  );
}
