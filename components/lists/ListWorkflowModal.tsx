"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { TripListsPanel } from "./TripListsPanel";
import { Button } from "@/components/ui/button";
import InviteUsersDialog from "@/app/trips/[id]/InviteUsersDialog";
import CreateChoiceDialog from "@/app/trips/[id]/CreateChoiceDialog";

interface ListWorkflowModalProps {
  tripId: string;
  tripName: string;
  isOpen: boolean;
  onClose: () => void;
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
  isOpen,
  onClose,
  currentMembers = [],
}: ListWorkflowModalProps) {
  const { user } = useAuth();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateChoiceDialogOpen, setIsCreateChoiceDialogOpen] = useState(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Get Started with Your Trip
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Work through your to-do list to prepare for your trip
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <TripListsPanel
            key={refreshKey}
            tripId={tripId}
            onOpenInviteDialog={() => setIsInviteDialogOpen(true)}
            onOpenCreateChoice={() => setIsCreateChoiceDialogOpen(true)}
            onActionComplete={(itemId, label) => setPendingCompletion({itemId, label})}
            onRefreshLists={() => setRefreshKey(prev => prev + 1)}
            inWorkflowMode={true}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You can always access your lists from the trip page
            </p>
            <Button
              onClick={onClose}
              variant="primary"
            >
              Done for Now
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
        onSuccess={() => {
          setIsCreateChoiceDialogOpen(false);
          // Show completion confirmation if there's a pending item
          if (pendingCompletion) {
            setShowConfirmation(true);
          }
        }}
      />

      {/* Completion Confirmation Dialog */}
      {showConfirmation && pendingCompletion && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Mark Task as Complete?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Would you like to mark "{pendingCompletion.label}" as complete?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowConfirmation(false);
                  setPendingCompletion(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200"
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
