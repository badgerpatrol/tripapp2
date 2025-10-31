"use client";

import { SpendStatus } from "@/lib/generated/prisma";

interface Spend {
  id: string;
  description: string;
  amount: number;
  currency: string;
  fxRate: number;
  normalizedAmount: number;
  date: string;
  status: SpendStatus;
  notes: string | null;
  paidBy: {
    id: string;
    email: string;
    displayName: string | null;
  };
  category: {
    id: string;
    name: string;
  } | null;
  assignedPercentage?: number;
  assignments?: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }>;
}

interface ViewSpendDialogProps {
  spend: Spend | null;
  trip: {
    id: string;
    baseCurrency: string;
  };
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  canUserFinalize?: (spend: Spend) => boolean;
  onEdit?: (spendId: string) => void;
  onAssign?: (spendId: string) => void;
  onSelfAssign?: (spendId: string) => void;
  onJoin?: (spendId: string) => void;
  onLeave?: (spendId: string) => void;
  onFinalize?: (spendId: string) => void;
  onDelete?: (spendId: string) => void;
}

export default function ViewSpendDialog({
  spend,
  trip,
  currentUserId,
  isOpen,
  onClose,
  canUserFinalize,
  onEdit,
  onAssign,
  onSelfAssign,
  onJoin,
  onLeave,
  onFinalize,
  onDelete,
}: ViewSpendDialogProps) {
  if (!isOpen || !spend) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSpender = currentUserId && spend.paidBy.id === currentUserId;
  const isUserInvolved = currentUserId && (
    spend.paidBy.id === currentUserId ||
    spend.assignments?.some(a => a.userId === currentUserId)
  );
  const isAlreadyInvolved = currentUserId && spend.assignments?.some(a => a.userId === currentUserId);

  // Determine which buttons to show
  const showEdit = onEdit && spend.status !== SpendStatus.CLOSED;
  const showAssign = onAssign && isSpender;
  const showSelfAssign = onSelfAssign && isAlreadyInvolved && spend.status !== SpendStatus.CLOSED;
  const showJoin = onJoin && !isAlreadyInvolved && currentUserId && !isSpender;
  const showLeave = onLeave && isAlreadyInvolved && !isSpender;
  const showFinalize = onFinalize && canUserFinalize && canUserFinalize(spend);
  const showDelete = onDelete;

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Spend Details
            </h2>
            <button
              onClick={handleClose}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status and Involvement Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                spend.status === SpendStatus.OPEN
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              }`}
            >
              {spend.status === SpendStatus.OPEN ? "Open" : "Closed"}
            </span>

            {currentUserId && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isUserInvolved
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                {isUserInvolved ? "You're involved" : "Not involved"}
              </span>
            )}

            {/* Assignment Badge */}
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                Math.abs((spend.assignedPercentage || 0) - 100) < 0.1
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : (spend.assignedPercentage || 0) > 100
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {(spend.assignedPercentage || 0).toFixed(1)}% assigned
            </span>
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Description
              </label>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {spend.description}
              </p>
            </div>

            {/* Category */}
            {spend.category && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Category
                </label>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {spend.category.name}
                </p>
              </div>
            )}

            {/* Amount and Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Amount
                </label>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {spend.currency} {spend.amount.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Converted Amount
                </label>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {trip.baseCurrency} {spend.normalizedAmount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* FX Rate and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Exchange Rate
                </label>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {spend.fxRate.toFixed(6)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Date
                </label>
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {formatDate(spend.date)}
                </p>
              </div>
            </div>

            {/* Paid By */}
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Paid by
              </label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {(spend.paidBy.displayName || spend.paidBy.email)[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {spend.paidBy.displayName || spend.paidBy.email}
                  </p>
                  {spend.paidBy.displayName && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{spend.paidBy.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Involved People */}
            {spend.assignments && spend.assignments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  People Involved ({spend.assignments.length})
                </label>
                <div className="space-y-2">
                  {spend.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          {(assignment.user.displayName || assignment.user.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {assignment.user.displayName || assignment.user.email}
                        </p>
                        {assignment.user.displayName && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{assignment.user.email}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {spend.notes && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  Notes
                </label>
                <p className="text-base text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                  {spend.notes}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-700">
            {/* Primary Actions Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {showEdit && (
                <button
                  onClick={() => {
                    // Keep view dialog open, just open edit on top
                    onEdit(spend.id);
                  }}
                  className="tap-target px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}

              {showAssign && (
                <button
                  onClick={() => {
                    // Keep view dialog open, just open assign on top
                    onAssign(spend.id);
                  }}
                  className="tap-target px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Assign
                </button>
              )}

              {showSelfAssign && (
                <button
                  onClick={() => {
                    // Keep view dialog open, just open self-assign on top
                    onSelfAssign(spend.id);
                  }}
                  className="tap-target px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Assign My Share
                </button>
              )}
            </div>

            {/* Secondary Actions Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {showJoin && (
                <button
                  onClick={() => {
                    // Close view dialog before performing action
                    handleClose();
                    onJoin(spend.id);
                  }}
                  className="tap-target px-4 py-3 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Join
                </button>
              )}

              {showLeave && (
                <button
                  onClick={() => {
                    // Close view dialog before performing action
                    handleClose();
                    onLeave(spend.id);
                  }}
                  className="tap-target px-4 py-3 rounded-lg bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Leave
                </button>
              )}

              {showFinalize && (
                <button
                  onClick={() => {
                    // Close view dialog before performing action
                    handleClose();
                    onFinalize(spend.id);
                  }}
                  className={`tap-target px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
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
                      Reopen
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Close
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Delete Button (if available) */}
            {showDelete && (
              <button
                onClick={() => {
                  // Close view dialog before performing action
                  handleClose();
                  onDelete(spend.id);
                }}
                className="tap-target w-full px-4 py-3 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
