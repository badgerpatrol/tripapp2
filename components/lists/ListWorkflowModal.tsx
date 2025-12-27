"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { TripListsPanel } from "./TripListsPanel";
import { Button } from "@/components/ui/button";
import InviteUsersDialog from "@/app/trips/[id]/InviteUsersDialog";
import CreateChoiceDialog from "@/app/trips/[id]/CreateChoiceDialog";
import ManageChoiceDialog from "@/app/trips/[id]/ManageChoiceDialog";

interface ListWorkflowModalProps {
  tripId: string;
  tripName: string;
  tripCurrency?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  selectedListId?: string; // ID of a specific list to display
  onMilestoneCreated?: () => void; // Callback when a milestone is created
  onChoiceCreated?: () => void; // Callback when a choice is created
  currentMembers?: Array<{
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

export function ListWorkflowModal({
  tripId,
  tripName,
  tripCurrency = "GBP",
  isOpen,
  onClose,
  title = "Get Started with Your Trip",
  description = "Work through your to-do list to prepare for your trip",
  selectedListId,
  onMilestoneCreated,
  onChoiceCreated,
  currentMembers = [],
}: ListWorkflowModalProps) {
  const { user } = useAuth();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateChoiceDialogOpen, setIsCreateChoiceDialogOpen] = useState(false);
  const [isManageChoiceDialogOpen, setIsManageChoiceDialogOpen] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [manageChoiceInitialTab, setManageChoiceInitialTab] = useState<"details" | "items">("items");
  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [choiceName, setChoiceName] = useState("");
  const [pendingCompletion, setPendingCompletion] = useState<{itemId: string; label: string} | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleToggleItem = async (itemId: string, currentState: boolean) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/items/TODO/${itemId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          state: !currentState,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle item");
      }
    } catch (err) {
      console.error("Error toggling item:", err);
    }
  };

  const handleCreateMilestone = async () => {
    if (!user || !milestoneTitle.trim()) return;

    setCreatingMilestone(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/timeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: milestoneTitle.trim(),
          date: milestoneDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create milestone");
      }

      // Close milestone dialog
      setIsMilestoneDialogOpen(false);
      setMilestoneTitle("");
      setMilestoneDate("");

      // Notify parent to refresh trip data (including timeline/milestones)
      if (onMilestoneCreated) {
        onMilestoneCreated();
      }

      // Show completion confirmation if there's a pending item
      if (pendingCompletion) {
        setShowConfirmation(true);
      }
    } catch (err: any) {
      console.error("Error creating milestone:", err);
      alert(err.message || "Failed to create milestone");
    } finally {
      setCreatingMilestone(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-hidden box-border">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ maxWidth: 'min(56rem, calc(100vw - 2rem))' }}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between min-w-0 overflow-hidden">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white truncate">
              {title}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 truncate">
              {description}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 min-w-0">
          <TripListsPanel
            key={refreshKey}
            tripId={tripId}
            onOpenInviteDialog={() => setIsInviteDialogOpen(true)}
            onOpenCreateChoice={(name) => {
              setIsCreateChoiceDialogOpen(true);
              setChoiceName(name || ""); // Pre-fill with choice name from parameters
            }}
            onOpenMilestoneDialog={(itemId, itemLabel) => {
              setIsMilestoneDialogOpen(true);
              setMilestoneTitle(itemLabel); // Pre-fill with task label
              setPendingCompletion({itemId, label: itemLabel});
            }}
            onActionComplete={(itemId, label) => setPendingCompletion({itemId, label})}
            onRefreshLists={() => setRefreshKey(prev => prev + 1)}
            inWorkflowMode={true}
            selectedListId={selectedListId}
          />
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex justify-between items-center">
            
            <Button
              onClick={onClose}
              variant="primary"
            >
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* Invite Users Dialog */}
      <InviteUsersDialog
        tripId={tripId}
        tripName={tripName}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={() => {
          setIsInviteDialogOpen(false);
          // Show completion confirmation if there's a pending item
          if (pendingCompletion) {
            setShowConfirmation(true);
          }
        }}
        currentMembers={currentMembers}
      />

      {/* Create Choice Dialog */}
      <CreateChoiceDialog
        tripId={tripId}
        isOpen={isCreateChoiceDialogOpen}
        onClose={() => setIsCreateChoiceDialogOpen(false)}
        initialName={choiceName}
        onSuccess={(newChoiceId: string) => {
          setIsCreateChoiceDialogOpen(false);
          setChoiceName(""); // Reset choice name
          // Notify parent to refresh trip data (including choices)
          if (onChoiceCreated) {
            onChoiceCreated();
          }
          // Open the manage choice dialog to add items
          setSelectedChoiceId(newChoiceId);
          setManageChoiceInitialTab("items");
          setIsManageChoiceDialogOpen(true);
        }}
      />

      {/* Manage Choice Dialog */}
      <ManageChoiceDialog
        isOpen={isManageChoiceDialogOpen}
        onClose={() => {
          setIsManageChoiceDialogOpen(false);
          setSelectedChoiceId(null);
          // Show completion confirmation if there's a pending item
          if (pendingCompletion) {
            setShowConfirmation(true);
          }
        }}
        choiceId={selectedChoiceId}
        tripId={tripId}
        tripCurrency={tripCurrency}
        onSuccess={() => {
          // Refresh the lists
          setRefreshKey(prev => prev + 1);
        }}
        initialTab={manageChoiceInitialTab}
      />

      {/* Milestone Creation Dialog */}
      {isMilestoneDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Create Milestone
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Add a milestone to the trip timeline
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Milestone Title *
                </label>
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g., Book flights"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  disabled={creatingMilestone}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full min-w-0 appearance-none px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 box-border"
                  disabled={creatingMilestone}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setIsMilestoneDialogOpen(false);
                  setMilestoneTitle("");
                  setMilestoneDate("");
                }}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
                disabled={creatingMilestone}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMilestone}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={creatingMilestone || !milestoneTitle.trim()}
              >
                {creatingMilestone ? "Creating..." : "Create Milestone"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Confirmation Dialog */}
      {showConfirmation && pendingCompletion && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Mark Task as Complete?
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Would you like to mark "{pendingCompletion.label}" as complete?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  setPendingCompletion(null);
                }}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
              >
                No, Keep Open
              </Button>
              <Button
                onClick={async () => {
                  await handleToggleItem(pendingCompletion.itemId, false);
                  setShowConfirmation(false);
                  setPendingCompletion(null);
                  // Refresh the lists to show the updated state
                  setRefreshKey(prev => prev + 1);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Yes, Mark Complete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
