"use client";

import { useState } from "react";
import { SpendStatus } from "@/lib/generated/prisma";
import { useLongPress } from "@/hooks/useLongPress";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

interface SpendCardProps {
  spend: SpendWithAssignments;
  currentUserId?: string;
  isUserInvolved: (spend: SpendWithAssignments) => boolean;
  getStatusBadge: (status: SpendStatus) => React.ReactElement;
  getAssignmentBadge: (percentage: number) => React.ReactElement;
  onLongPress: (e: React.Touch | React.MouseEvent) => void;
  onClick?: (spendId: string) => void;
  onFinalize?: (spendId: string) => void;
  canUserFinalize?: (spend: SpendWithAssignments) => boolean;
}

function SpendCard({
  spend,
  currentUserId,
  isUserInvolved,
  getStatusBadge,
  getAssignmentBadge,
  onLongPress,
  onClick,
  onFinalize,
  canUserFinalize,
}: SpendCardProps) {
  const longPressHandlers = useLongPress({
    onLongPress,
  });

  const handleClick = () => {
    if (onClick) {
      onClick(spend.id);
    }
  };

  return (
    <div
      {...longPressHandlers}
      onClick={handleClick}
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
        <div className="flex flex-col items-end gap-2">
          {getStatusBadge(spend.status)}
          {currentUserId && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                isUserInvolved(spend)
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {isUserInvolved(spend) ? "You're involved" : "Not involved"}
            </span>
          )}
        </div>
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

      {/* You Owe (if current user is assigned) */}
      {currentUserId && (() => {
        const userAssignment = spend.assignments?.find(a => a.userId === currentUserId);
        if (userAssignment && userAssignment.shareAmount !== undefined && userAssignment.shareAmount > 0) {
          return (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">You owe</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                    {((userAssignment.shareAmount / spend.amount) * 100).toFixed(1)}% of total
                  </p>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {spend.currency} {userAssignment.shareAmount.toFixed(2)}
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Involved Users Count */}
      {spend.assignments && spend.assignments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>
              <span className="font-medium text-gray-900 dark:text-white">
                {spend.assignments.length}
              </span>
              {' '}{spend.assignments.length === 1 ? 'person' : 'people'} involved
            </span>
          </div>
        </div>
      )}

      {/* Close/Open Toggle Button */}
      {onFinalize && canUserFinalize && canUserFinalize(spend) && (
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
}

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
  assignments?: Array<{
    id: string;
    userId: string;
    shareAmount?: number;
    normalizedShareAmount?: number;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
}

export interface SpendListViewProps {
  spends: SpendWithAssignments[];
  currentUserId?: string;
  tripSpendingClosed?: boolean;
  canUserFinalize?: (spend: SpendWithAssignments) => boolean;
  canUserDelete?: (spend: SpendWithAssignments) => boolean;
  canUserEdit?: (spend: SpendWithAssignments) => boolean;
  onView?: (spendId: string) => void;
  onEdit?: (spendId: string) => void;
  onAssign?: (spendId: string) => void;
  onSelfAssign?: (spendId: string) => void;
  onJoin?: (spendId: string) => void;
  onLeave?: (spendId: string) => void;
  onFinalize?: (spendId: string) => void;
  onDelete?: (spendId: string) => void;
}

/**
 * SpendListView component displays spends with:
 * - Spender name
 * - Amount (with currency)
 * - Assigned percentage
 * - Open/Closed status
 * - User involvement indicator (shows if current user is involved in the spend)
 * - Long-press context menu for actions
 */
export function SpendListView({
  spends,
  currentUserId,
  tripSpendingClosed = false,
  canUserFinalize,
  canUserDelete,
  canUserEdit,
  onView,
  onEdit,
  onAssign,
  onSelfAssign,
  onJoin,
  onLeave,
  onFinalize,
  onDelete,
}: SpendListViewProps) {
  const [contextMenu, setContextMenu] = useState<{
    spendId: string;
    position: { x: number; y: number };
  } | null>(null);

  const isUserInvolved = (spend: SpendWithAssignments): boolean => {
    if (!currentUserId) return false;

    // User is involved if they paid for it OR if they're assigned to it
    if (spend.paidBy.id === currentUserId) return true;
    if (spend.assignments?.some(a => a.userId === currentUserId)) return true;

    return false;
  };

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

    if (onEdit && canUserEdit && canUserEdit(spend) && spend.status !== SpendStatus.CLOSED && !tripSpendingClosed) {
      items.push({
        label: "Edit",
        onClick: () => onEdit(spendId),
      });
    }

    // Show "Join" if user is NOT the spender and NOT already involved
    // Show "Assign" if user IS the spender
    // Show "Leave" if user is already involved (but not the spender)
    const isSpender = currentUserId && spend.paidBy.id === currentUserId;
    const isAlreadyInvolved = isUserInvolved(spend);

    if (isSpender) {
      // User is the spender - show full Assign functionality
      if (onAssign && !tripSpendingClosed) {
        items.push({
          label: "Add People",
          onClick: () => onAssign(spendId),
        });
      }
      // Also show self-assign for spender
      if (onSelfAssign && spend.status !== SpendStatus.CLOSED && !tripSpendingClosed) {
        items.push({
          label: "Assign My Share",
          onClick: () => onSelfAssign(spendId),
        });
      }
    } else if (!isAlreadyInvolved && currentUserId) {
      // User is not the spender and not involved - show Join
      if (onJoin && !tripSpendingClosed) {
        items.push({
          label: "Join",
          onClick: () => onJoin(spendId),
        });
      }
    } else if (isAlreadyInvolved) {
      // User is already involved - show self-assign option
      if (onSelfAssign && spend.status !== SpendStatus.CLOSED && !tripSpendingClosed) {
        items.push({
          label: "Assign My Share",
          onClick: () => onSelfAssign(spendId),
        });
      }
      // User is already involved (but not spender) - show Leave so they can remove themselves
      if (onLeave && !tripSpendingClosed) {
        items.push({
          label: "Leave",
          onClick: () => onLeave(spendId),
        });
      }
    }

    if (onFinalize && canUserFinalize && canUserFinalize(spend)) {
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

    if (onDelete && canUserDelete && canUserDelete(spend)) {
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
        {spends.map((spend) => (
          <SpendCard
            key={spend.id}
            spend={spend}
            currentUserId={currentUserId}
            isUserInvolved={isUserInvolved}
            getStatusBadge={getStatusBadge}
            getAssignmentBadge={getAssignmentBadge}
            onLongPress={handleLongPress(spend.id)}
            onClick={onView}
            onFinalize={onFinalize}
            canUserFinalize={canUserFinalize}
          />
        ))}
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
