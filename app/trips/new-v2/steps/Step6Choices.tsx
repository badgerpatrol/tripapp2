"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import ManageChoiceDialog from "@/app/trips/[id]/ManageChoiceDialog";
import { AddListDialog } from "@/components/lists/AddListDialog";
import type { StepProps } from "../types";
import type { CreatedChoice, CreatedList } from "../types";

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
  const [showKitListDialog, setShowKitListDialog] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);

  // Hide wizard footer when create form or dialogs are open
  useEffect(() => {
    const shouldHide = showCreateForm || !!manageChoiceId || showKitListDialog || showChecklistDialog;
    setHideFooter?.(shouldHide);
    return () => setHideFooter?.(false);
  }, [showCreateForm, manageChoiceId, showKitListDialog, showChecklistDialog, setHideFooter]);

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

  const handleCancelForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setShowCreateForm(false);
    setError(null);
  };

  const handleKitListSuccess = async () => {
    // Refresh kit lists from the trip
    if (!user || !state.tripId) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/trips/${state.tripId}/lists?type=KIT`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const kitLists: CreatedList[] = (data.instances || []).map((list: any) => ({
          id: list.id,
          title: list.title,
          description: list.description,
          itemCount: list.kitItems?.length || list._count?.kitItems || 0,
        }));
        updateState({ createdKitLists: kitLists });
      }
    } catch (err) {
      console.error("Error refreshing kit lists:", err);
    }
    setShowKitListDialog(false);
  };

  const handleChecklistSuccess = async () => {
    // Refresh checklists from the trip
    if (!user || !state.tripId) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/trips/${state.tripId}/lists?type=TODO`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const checklists: CreatedList[] = (data.instances || []).map((list: any) => ({
          id: list.id,
          title: list.title,
          description: list.description,
          itemCount: list.todoItems?.length || list._count?.todoItems || 0,
        }));
        updateState({ createdChecklists: checklists });
      }
    } catch (err) {
      console.error("Error refreshing checklists:", err);
    }
    setShowChecklistDialog(false);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Choices Section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Choices
          </h3>
          {state.createdChoices.length > 0 && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              {state.createdChoices.length} added
            </span>
          )}
        </div>
      </div>

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

      {/* Create Choice Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={handleCancelForm}
        title="Create Choice"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancelForm} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateChoice}
              disabled={!formData.name.trim() || isLoading}
              loading={isLoading}
            >
              Create & Add Items
            </Button>
          </>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>



      {/* ManageChoiceDialog for adding menu items */}
      {state.tripId && (
        <ManageChoiceDialog
          isOpen={!!manageChoiceId}
          onClose={handleManageChoiceClose}
          choiceId={manageChoiceId}
          tripId={state.tripId}
          tripCurrency="GBP"
          onSuccess={handleManageChoiceSuccess}
          initialTab="import"
        />
      )}

      {/* Kit Lists Section */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎒</span>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Kit Lists
            </h3>
            {state.createdKitLists.length > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                {state.createdKitLists.length} added
              </span>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          full
          onClick={() => setShowKitListDialog(true)}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Kit List
        </Button>
      </div>

      {/* Checklists Section */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✓</span>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Checklists
            </h3>
            {state.createdChecklists.length > 0 && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {state.createdChecklists.length} added
              </span>
            )}
          </div>
        </div> 

        <Button
          variant="secondary"
          full
          onClick={() => setShowChecklistDialog(true)}
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Checklist
        </Button>
      </div>

      {/* AddListDialog for Kit Lists */}
      {state.tripId && (
        <AddListDialog
          isOpen={showKitListDialog}
          onClose={() => setShowKitListDialog(false)}
          tripId={state.tripId}
          onSuccess={handleKitListSuccess}
          listTypeFilter="KIT"
        />
      )}

      {/* AddListDialog for Checklists */}
      {state.tripId && (
        <AddListDialog
          isOpen={showChecklistDialog}
          onClose={() => setShowChecklistDialog(false)}
          tripId={state.tripId}
          onSuccess={handleChecklistSuccess}
          listTypeFilter="TODO"
        />
      )}
    </div>
  );
}
