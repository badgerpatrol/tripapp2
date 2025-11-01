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
    shareAmount?: number;
    normalizedShareAmount?: number;
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
    spendStatus?: SpendStatus;
  };
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  canUserFinalize?: (spend: Spend) => boolean;
  canUserDelete?: (spend: Spend) => boolean;
  canUserEdit?: (spend: Spend) => boolean;
  onEdit?: (spendId: string) => void;
  onAssign?: (spendId: string) => void;
  onSelfAssign?: (spendId: string) => void;
  onSplitRemainder?: (spendId: string) => void;
  onEditAssignment?: (assignmentId: string) => void;
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
  canUserDelete,
  canUserEdit,
  onEdit,
  onAssign,
  onSelfAssign,
  onSplitRemainder,
  onEditAssignment,
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

  // Calculate if there's a remainder to split
  const totalAssigned = spend.assignments?.reduce((sum, a) => sum + (a.shareAmount || 0), 0) || 0;
  const hasRemainder = spend.amount - totalAssigned > 0.01; // Small tolerance for floating point

  // Check if trip spending is closed
  const isTripSpendingClosed = (trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED;

  // Determine which buttons to show
  const showEdit = onEdit && canUserEdit && canUserEdit(spend) && spend.status !== SpendStatus.CLOSED && !isTripSpendingClosed;
  const showAssign = onAssign && isSpender && spend.status !== SpendStatus.CLOSED && !isTripSpendingClosed;
  const showSelfAssign = onSelfAssign && isAlreadyInvolved && spend.status !== SpendStatus.CLOSED && !isTripSpendingClosed;
  const showSplitRemainder = onSplitRemainder && isSpender && hasRemainder && spend.status !== SpendStatus.CLOSED && !isTripSpendingClosed;
  const showJoin = onJoin && !isAlreadyInvolved && currentUserId && !isSpender && !isTripSpendingClosed;
  const showLeave = onLeave && isAlreadyInvolved && !isSpender && spend.status !== SpendStatus.CLOSED && !isTripSpendingClosed;
  const showFinalize = onFinalize && canUserFinalize && canUserFinalize(spend);
  const showDelete = onDelete && canUserDelete && canUserDelete(spend) && spend.status !== SpendStatus.CLOSED;

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
              {spend.description}
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
          {/* Date */}
            <div>
              <p className="text-base text-zinc-900 dark:text-zinc-100 gap-2 mb-6">
                {formatDate(spend.date)} by {spend.paidBy.displayName || spend.paidBy.email}
              </p>
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
              {spend.status === SpendStatus.OPEN ? "Unlocked" : "Locked"}
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

          {/* Assignment Summary */}
          {(() => {
            const assignedPercentage = spend.assignedPercentage || 0;
            const assignedAmount = (assignedPercentage / 100) * spend.amount;
            const unassignedPercentage = 100 - assignedPercentage;
            const unassignedAmount = (unassignedPercentage / 100) * spend.amount;

            const userAssignment = currentUserId && spend.assignments?.find(a => a.userId === currentUserId);
            const showYouOwe = userAssignment && userAssignment.shareAmount !== undefined && userAssignment.shareAmount > 0;

            return (
              <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Summary
                </h3>
                <div className="space-y-2">
                  {showYouOwe && userAssignment && userAssignment.shareAmount !== undefined && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          You owe:
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-red-700 dark:text-red-300">
                            {spend.currency} {userAssignment.shareAmount.toFixed(2)}
                          </span>
                          <span className="text-xs ml-1 text-red-700 dark:text-red-500">
                            ({((userAssignment.shareAmount / spend.amount) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-blue-200 dark:border-blue-800"></div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Total assigned:
                    </span>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${
                        assignedPercentage > 100
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}>
                        {spend.currency} {assignedAmount.toFixed(2)}
                      </span>
                      <span className={`text-xs ml-1 ${
                        assignedPercentage > 100
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}>
                        ({assignedPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-800">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Remaining unassigned:
                    </span>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        unassignedPercentage < 0
                          ? "text-red-600 dark:text-red-400"
                          : unassignedPercentage < 0.1
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {spend.currency} {unassignedAmount.toFixed(2)}
                      </span>
                      <span className={`text-xs ml-1 ${
                        unassignedPercentage < 0
                          ? "text-red-600 dark:text-red-400"
                          : unassignedPercentage < 0.1
                          ? "text-green-600 dark:text-green-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        ({unassignedPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Amount Summary */}
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Amount:
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {spend.currency} {spend.amount.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-green-200 dark:border-green-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Converted Amount:
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {trip.baseCurrency} {spend.normalizedAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-green-200 dark:border-green-800">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Exchange Rate:
                </span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {spend.fxRate.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">

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

            

            

            {/* Involved People */}
            {spend.assignments && spend.assignments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                  People Involved ({spend.assignments.length})
                </label>
                <div className="space-y-2">
                  {spend.assignments.map((assignment) => {
                    // Determine if user can click on this assignment
                    const isSpender = currentUserId && spend.paidBy.id === currentUserId;
                    const isAssignmentOwner = currentUserId && assignment.userId === currentUserId;
                    const canClickAssignment = onEditAssignment && (isSpender || isAssignmentOwner) && spend.status !== SpendStatus.CLOSED && !isTripSpendingClosed;

                    return (
                      <div
                        key={assignment.id}
                        onClick={() => canClickAssignment && onEditAssignment(assignment.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          isAssignmentOwner
                            ? "bg-zinc-50 dark:bg-red-950/20 border-blue-300 dark:border-blue-800 ring-2 ring-blue-200 dark:ring-blue-900/50"
                            : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700"
                        } ${
                          canClickAssignment
                            ? "cursor-pointer hover:bg-opacity-80 dark:hover:bg-opacity-80 transition-colors"
                            : ""
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isAssignmentOwner
                            ? "bg-red-100 dark:bg-red-900/50"
                            : "bg-blue-100 dark:bg-blue-900/30"
                        }`}>
                          <span className={`text-xs font-medium ${
                            isAssignmentOwner
                              ? "text-red-700 dark:text-red-300"
                              : "text-blue-700 dark:text-blue-300"
                          }`}>
                            {(assignment.user.displayName || assignment.user.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            isAssignmentOwner
                              ? "text-red-900 dark:text-red-100"
                              : "text-zinc-900 dark:text-zinc-100"
                          }`}>
                            {assignment.user.displayName || assignment.user.email}
                            {isAssignmentOwner && (
                              <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">(You)</span>
                            )}
                          </p>
                          {assignment.user.displayName && (
                            <p className={`text-xs ${
                              isAssignmentOwner
                                ? "text-red-700 dark:text-red-400"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}>{assignment.user.email}</p>
                          )}
                        </div>
                        {assignment.shareAmount !== undefined && (
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold ${
                              isAssignmentOwner
                                ? "text-red-900 dark:text-red-100"
                                : "text-zinc-900 dark:text-zinc-100"
                            }`}>
                              {spend.currency} {assignment.shareAmount.toFixed(2)}
                            </p>
                            {assignment.shareAmount > 0 && (
                              <p className={`text-xs ${
                                isAssignmentOwner
                                  ? "text-red-700 dark:text-red-500"
                                  : "text-zinc-500 dark:text-zinc-400"
                              }`}>
                                {((assignment.shareAmount / spend.amount) * 100).toFixed(1)}%
                              </p>
                            )}
                          </div>
                        )}
                        {canClickAssignment && (
                          <div className="flex-shrink-0">
                            <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
            {showFinalize && (
                <button
                  onClick={() => {
                    // Keep dialog open - just perform the action
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
                      Unlock spend
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Lock Spend
                    </>
                  )}
                </button>
              )}

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
                  Add People
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

              {showSplitRemainder && (
                <button
                  onClick={() => {
                    // Keep view dialog open, just open split remainder on top
                    onSplitRemainder(spend.id);
                  }}
                  className="tap-target px-4 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Split Remainder
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
              
            </div>

            

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
