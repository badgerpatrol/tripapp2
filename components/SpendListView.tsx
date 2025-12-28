"use client";

import { SpendStatus } from "@/lib/generated/prisma";

interface SpendCardProps {
  spend: SpendWithAssignments;
  currentUserId?: string;
  isUserInvolved: (spend: SpendWithAssignments) => boolean;
  getStatusBadge: (status: SpendStatus) => React.ReactElement;
  getAssignmentBadge: (percentage: number) => React.ReactElement;
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
  onClick,
  onFinalize,
  canUserFinalize,
}: SpendCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(spend.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header: Description & Status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-zinc-900 dark:text-white truncate">
            {spend.description}
          </h3>
          {spend.category && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {spend.category.name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {getStatusBadge(spend.status)}
            {/* Lock/Unlock Toggle Icon */}
            {onFinalize && canUserFinalize && canUserFinalize(spend) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFinalize(spend.id);
                }}
                className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                  spend.status === SpendStatus.CLOSED
                    ? "bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400"
                    : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-400"
                }`}
                title={spend.status === SpendStatus.CLOSED ? "Unlock spend" : "Lock spend"}
              >
                {spend.status === SpendStatus.CLOSED ? (
                  // Locked icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  // Unlocked icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
          </div>
          {currentUserId && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                isUserInvolved(spend)
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
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
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Paid by</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
            {spend.paidBy.displayName ?? "Unknown"}
          </p>
        </div>

        {/* Amount */}
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Amount</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {spend.currency} {spend.amount.toFixed(2)}
          </p>
        </div>

        {/* Date */}
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Date</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {new Date(spend.date).toLocaleDateString()}
          </p>
        </div>

        {/* Assignment % */}
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Assigned</p>
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
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">You owe</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                    {((userAssignment.shareAmount / spend.amount) * 100).toFixed(1)}% of total
                  </p>
                </div>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">
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
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {spend.assignments.length}
              </span>
              {' '}{spend.assignments.length === 1 ? 'person' : 'people'} involved
            </span>
          </div>
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
  const isUserInvolved = (spend: SpendWithAssignments): boolean => {
    if (!currentUserId) return false;

    // User is involved if they paid for it OR if they're assigned to it
    if (spend.paidBy.id === currentUserId) return true;
    if (spend.assignments?.some(a => a.userId === currentUserId)) return true;

    return false;
  };

  const getStatusBadge = (status: SpendStatus) => {
    const statusConfig = {
      [SpendStatus.OPEN]: {
        label: "Unlocked",
        className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400",
      },
      [SpendStatus.CLOSED]: {
        label: "Locked",
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
        {percentage.toFixed(1)}%
      </span>
    );
  };

  if (spends.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
        <p>No spends found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {spends.map((spend) => (
        <SpendCard
          key={spend.id}
          spend={spend}
          currentUserId={currentUserId}
          isUserInvolved={isUserInvolved}
          getStatusBadge={getStatusBadge}
          getAssignmentBadge={getAssignmentBadge}
          onClick={onView}
          onFinalize={onFinalize}
          canUserFinalize={canUserFinalize}
        />
      ))}
    </div>
  );
}
