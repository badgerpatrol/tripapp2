"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { User } from "firebase/auth";

// System milestone types that trigger automatic actions
// These must match EXACTLY for system recognition
const SYSTEM_MILESTONES = [
  {
    title: "RSVP Deadline",
    description: "Closes RSVP window - no more responses accepted after this date",
  },
  {
    title: "Spending Window Closes",
    description: "Closes spending and calculates settlements between participants",
  },
  {
    title: "Settlement Deadline",
    description: "Deadline for participants to settle their balances",
  },
  {
    title: "Event Starts",
    description: "The trip/event begins",
  },
  {
    title: "Event Ends",
    description: "The trip/event concludes",
  },
];

interface ExistingMilestone {
  id: string;
  title: string;
}

interface AddMilestoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  user: User | null;
  onSuccess: () => void;
  existingMilestones?: ExistingMilestone[];
}

export default function AddMilestoneDialog({
  isOpen,
  onClose,
  tripId,
  user,
  onSuccess,
  existingMilestones = [],
}: AddMilestoneDialogProps) {
  const [selectedPredefined, setSelectedPredefined] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out system milestones that already exist on the trip
  const availableSystemMilestones = useMemo(() => {
    const existingTitles = new Set(existingMilestones.map((m) => m.title));
    return SYSTEM_MILESTONES.filter((m) => !existingTitles.has(m.title));
  }, [existingMilestones]);

  // Set default date/time to 10 minutes in the future when dialog opens
  useEffect(() => {
    if (isOpen) {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const year = futureDate.getFullYear();
      const month = String(futureDate.getMonth() + 1).padStart(2, "0");
      const day = String(futureDate.getDate()).padStart(2, "0");
      const hours = String(futureDate.getHours()).padStart(2, "0");
      const minutes = String(futureDate.getMinutes()).padStart(2, "0");
      setDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  }, [isOpen]);

  const handleClose = () => {
    setSelectedPredefined(null);
    setIsCustom(false);
    setTitle("");
    setDescription("");
    setDate("");
    onClose();
  };

  const handleSelectSystemMilestone = (milestoneTitle: string) => {
    const milestone = SYSTEM_MILESTONES.find((m) => m.title === milestoneTitle);
    if (milestone) {
      setSelectedPredefined(milestoneTitle);
      setIsCustom(false);
      setTitle(milestone.title);
      setDescription(milestone.description);
    }
  };

  const handleSelectCustom = () => {
    setSelectedPredefined(null);
    setIsCustom(true);
    setTitle("");
    setDescription("");
  };

  // Check if the selected date is in the future
  const isDateInFuture = useMemo(() => {
    if (!date) return false;
    const selectedDate = new Date(date);
    return selectedDate > new Date();
  }, [date]);

  const handleSubmit = async () => {
    if (!user || !title.trim()) return;

    // Validate date is in the future
    if (!date) {
      alert("Please select a date and time for the milestone");
      return;
    }

    const selectedDate = new Date(date);
    if (selectedDate <= new Date()) {
      alert("Milestone date must be in the future");
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/timeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          date: date || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create milestone");
      }

      // Success - reset form and notify parent
      setSelectedPredefined(null);
      setIsCustom(false);
      setTitle("");
      setDescription("");
      setDate("");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error creating milestone:", err);
      alert(err instanceof Error ? err.message : "Failed to create milestone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSelection = selectedPredefined !== null || isCustom;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Milestone"
      size="md"
      footer={
        hasSelection ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedPredefined(null);
                setIsCustom(false);
                setTitle("");
                setDescription("");
              }}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!title.trim() || !isDateInFuture || isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Milestone"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        )
      }
    >
      {!hasSelection ? (
        // Milestone type selection
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            Select a system milestone or create a custom one:
          </p>

          {/* System milestones section */}
          {availableSystemMilestones.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                System Milestones
              </p>
              <div className="space-y-2">
                {availableSystemMilestones.map((milestone) => (
                  <button
                    key={milestone.title}
                    onClick={() => handleSelectSystemMilestone(milestone.title)}
                    className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {milestone.title}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        Auto
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {milestone.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom milestone option */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <button
              onClick={handleSelectCustom}
              className="w-full text-left p-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  Custom Milestone
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 ml-7">
                Create your own milestone with a custom name
              </p>
            </button>
          </div>
        </div>
      ) : (
        // Milestone details form
        <div className="space-y-4">
          {selectedPredefined && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  {selectedPredefined}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                  Auto
                </span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                This milestone will trigger automatic system actions when completed.
              </p>
            </div>
          )}

          {isCustom && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Book Activities"
                className="w-full px-3 py-2 text-base rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 text-base rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus={!isCustom}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full max-w-[280px] px-3 py-2 text-base rounded border bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:border-transparent ${
                date && !isDateInFuture
                  ? "border-red-500 focus:ring-red-500"
                  : "border-zinc-300 dark:border-zinc-600 focus:ring-blue-500"
              }`}
            />
            {date && !isDateInFuture && (
              <p className="text-sm text-red-500 mt-1">
                Date must be in the future
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
