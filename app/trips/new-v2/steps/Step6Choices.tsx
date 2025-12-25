"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import ManageChoiceDialog from "@/app/trips/[id]/ManageChoiceDialog";
import type { StepProps } from "../types";
import type { CreatedChoice } from "../types";

interface CreateChoiceFormData {
  name: string;
  description: string;
  datetime: string;
  place: string;
}

const INITIAL_FORM_DATA: CreateChoiceFormData = {
  name: "",
  description: "",
  datetime: "",
  place: "",
};

export default function Step6Choices({
  state,
  updateState,
  error,
  setError,
  isLoading,
  setIsLoading,
  setHideFooter,
}: StepProps) {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateChoiceFormData>(INITIAL_FORM_DATA);
  const [manageChoiceId, setManageChoiceId] = useState<string | null>(null);

  // Hide wizard footer when create form or manage dialog is open
  useEffect(() => {
    const shouldHide = showCreateForm || !!manageChoiceId;
    setHideFooter?.(shouldHide);
    return () => setHideFooter?.(false);
  }, [showCreateForm, manageChoiceId, setHideFooter]);

  const handleCreateChoice = async () => {
    if (!formData.name.trim()) {
      setError("Choice name is required");
      return;
    }

    if (!user || !state.tripId) {
      setError("You must be logged in and have a trip to create choices");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const token = await user.getIdToken();

      const requestBody: Record<string, unknown> = {
        name: formData.name.trim(),
        visibility: "TRIP",
      };

      if (formData.description.trim()) {
        requestBody.description = formData.description.trim();
      }
      if (formData.datetime) {
        requestBody.datetime = new Date(formData.datetime).toISOString();
      }
      if (formData.place.trim()) {
        requestBody.place = formData.place.trim();
      }

      const response = await fetch(`/api/trips/${state.tripId}/choices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create choice");
      }

      const data = await response.json();
      const newChoiceId = data.choice?.id || data.id;

      // Add to created choices list
      const newChoice: CreatedChoice = {
        id: newChoiceId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        datetime: formData.datetime || undefined,
        place: formData.place.trim() || undefined,
        itemCount: 0,
      };

      updateState({
        createdChoices: [...state.createdChoices, newChoice],
      });

      // Reset form and open ManageChoiceDialog on items tab
      setFormData(INITIAL_FORM_DATA);
      setShowCreateForm(false);
      setManageChoiceId(newChoiceId);
    } catch (err) {
      console.error("Error creating choice:", err);
      setError(err instanceof Error ? err.message : "Failed to create choice");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageChoiceClose = () => {
    setManageChoiceId(null);
  };

  const handleManageChoiceSuccess = async () => {
    // Refresh the choice to get updated item count
    if (!user || !manageChoiceId) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/choices/${manageChoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const itemCount = data.items?.length || 0;

        // Update the choice in the list with new item count
        updateState({
          createdChoices: state.createdChoices.map((c) =>
            c.id === manageChoiceId ? { ...c, itemCount } : c
          ),
        });
      }
    } catch (err) {
      console.error("Error refreshing choice:", err);
    }
  };

  const handleOpenManageDialog = (choiceId: string) => {
    setManageChoiceId(choiceId);
  };

  const handleDeleteChoice = async (choiceId: string) => {
    if (!user || !confirm("Delete this choice?")) return;

    try {
      const token = await user.getIdToken();
      await fetch(`/api/choices/${choiceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      updateState({
        createdChoices: state.createdChoices.filter((c) => c.id !== choiceId),
      });
    } catch (err) {
      console.error("Error deleting choice:", err);
      setError("Failed to delete choice");
    }
  };

  const handleCancelForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setShowCreateForm(false);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Add Choices
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Create choices for your trip (optional)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* List of created choices */}
      {state.createdChoices.length > 0 && !showCreateForm && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Choices ({state.createdChoices.length})
          </h3>
          {state.createdChoices.map((choice) => (
            <div
              key={choice.id}
              className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {choice.name}
                  </h4>
                  {choice.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {choice.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {choice.itemCount} menu item{choice.itemCount !== 1 ? "s" : ""}
                    </span>
                    {choice.datetime && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(choice.datetime).toLocaleString()}
                      </span>
                    )}
                    {choice.place && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {choice.place}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenManageDialog(choice.id)}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Add menu items"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChoice(choice.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                    title="Delete choice"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create choice form */}
      {showCreateForm ? (
        <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            Create Choice
          </h3>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Choice Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Lunch Menu"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What are we choosing?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.datetime}
              onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Place
            </label>
            <input
              type="text"
              value={formData.place}
              onChange={(e) => setFormData({ ...formData, place: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., The Moghul"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleCancelForm} className="flex-1" disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateChoice}
              disabled={!formData.name.trim() || isLoading}
              loading={isLoading}
              className="flex-1"
            >
              Create & Add Items
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          full
          onClick={() => setShowCreateForm(true)}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Choice
        </Button>
      )}

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-4">
        You can skip this and add choices later from the trip page
      </p>

      {/* ManageChoiceDialog for adding menu items */}
      {state.tripId && (
        <ManageChoiceDialog
          isOpen={!!manageChoiceId}
          onClose={handleManageChoiceClose}
          choiceId={manageChoiceId}
          tripId={state.tripId}
          tripCurrency="GBP"
          onSuccess={handleManageChoiceSuccess}
          initialTab="items"
        />
      )}
    </div>
  );
}
