"use client";

import { useState } from "react";
import { SpendStatus } from "@/lib/generated/prisma";
import { useLongPress } from "@/hooks/useLongPress";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

export interface SpendWithAssignments {
  id: string;
  description: string;
  amount: number;
  currency: string;
  normalizedAmount: number;
  date: Date;
  status: SpendStatus;
  paidBy: {
    id: string;
    displayName: string | null;
    email: string;
  };
  category: {
    id: string;
    name: string;
  } | null;
  assignedPercentage?: number;
}

export interface SpendListViewProps {
  spends: SpendWithAssignments[];
  onEdit?: (spendId: string) => void;
  onAssign?: (spendId: string) => void;
  onFinalize?: (spendId: string) => void;
  onDelete?: (spendId: string) => void;
}

/**
 * SpendListView component displays spends with:
 * - Spender name
 * - Amount (with currency)
 * - Assigned percentage
 * - Open/Closed status
 * - Long-press context menu for actions
 */
export function SpendListView({
  spends,
  onEdit,
  onAssign,
  onFinalize,
  onDelete,
}: SpendListViewProps) {
  const [contextMenu, setContextMenu] = useState<{
    spendId: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleLongPress = (spendId: string) => (e: React.Touch | React.MouseEvent) => {
    // Get position from either mouse or touch event
    const x = (e as React.MouseEvent).clientX || (e as React.Touch).pageX;
    const y = (e as React.MouseEvent).clientY || (e as React.Touch).pageY;
    setContextMenu({ spendId, position: { x, y } });
  };

  const getStatusBadge = (status: SpendStatus) => {
    const statusConfig = {
      [SpendStatus.OPEN]: {
        label: "Open",
        className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      },
      [SpendStatus.CLOSED]: {
        label: "Closed",
        className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      },
    };

    const config = statusConfig[status] || statusConfig[SpendStatus.OPEN];
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const getAssignmentBadge = (percentage: number) => {
    const isComplete = Math.abs(percentage - 100) < 0.1;
    const isOverAssigned = percentage > 100;

    let className = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (isComplete) {
      className = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    } else if (isOverAssigned) {
      className = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>
        {percentage.toFixed(1)}% assigned
      </span>
    );
  };

  const getContextMenuItems = (spendId: string, spend: SpendWithAssignments): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (onEdit) {
      items.push({
        label: "Edit",
        onClick: () => onEdit(spendId),
        disabled: spend.status === SpendStatus.CLOSED,
      });
    }

    if (onAssign) {
      items.push({
        label: "Assign",
        onClick: () => onAssign(spendId),
      });
    }

    if (onFinalize) {
      if (spend.status === SpendStatus.CLOSED) {
        items.push({
          label: "Reopen",
          onClick: () => onFinalize(spendId),
        });
      } else {
        items.push({
          label: "Close",
          onClick: () => onFinalize(spendId),
        });
      }
    }

    if (onDelete) {
      items.push({
        label: "Delete",
        onClick: () => onDelete(spendId),
        variant: "danger",
      });
    }

    return items;
  };

  if (spends.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No spends found</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {spends.map((spend) => {
          const longPressHandlers = useLongPress({
            onLongPress: handleLongPress(spend.id),
          });

          return (
            <div
              key={spend.id}
              {...longPressHandlers}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Header: Description & Status */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {spend.description}
                  </h3>
                  {spend.category && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {spend.category.name}
                    </p>
                  )}
                </div>
                {getStatusBadge(spend.status)}
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {/* Spender */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Paid by</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {spend.paidBy.displayName || spend.paidBy.email}
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Amount</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {spend.currency} {spend.amount.toFixed(2)}
                  </p>
                </div>

                {/* Date */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Date</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {new Date(spend.date).toLocaleDateString()}
                  </p>
                </div>

                {/* Assignment % */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assigned</p>
                  <div>
                    {getAssignmentBadge(spend.assignedPercentage || 0)}
                  </div>
                </div>
              </div>

              {/* Close/Open Toggle Button */}
              {onFinalize && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFinalize(spend.id);
                    }}
                    className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      spend.status === SpendStatus.CLOSED
                        ? "bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400"
                        : "bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400"
                    }`}
                  >
                    {spend.status === SpendStatus.CLOSED ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                        Reopen Spend
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Close Spend
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          isOpen={true}
          onClose={() => setContextMenu(null)}
          position={contextMenu.position}
          items={getContextMenuItems(
            contextMenu.spendId,
            spends.find((s) => s.id === contextMenu.spendId)!
          )}
        />
      )}
    </>
  );
}
