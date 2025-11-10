"use client";

import { TripListsPanel } from "./TripListsPanel";
import { Button } from "@/components/ui/button";

interface ListWorkflowModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenInviteDialog?: () => void;
  onOpenCreateChoice?: () => void;
}

export function ListWorkflowModal({
  tripId,
  isOpen,
  onClose,
  onOpenInviteDialog,
  onOpenCreateChoice,
}: ListWorkflowModalProps) {
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
            tripId={tripId}
            onOpenInviteDialog={onOpenInviteDialog}
            onOpenCreateChoice={onOpenCreateChoice}
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
    </div>
  );
}
