"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ListType, TodoActionType } from "@/lib/generated/prisma";

interface TodoItem {
  id: string;
  label: string;
  notes: string | null;
  isDone: boolean;
  doneBy: string | null;
  doneAt: string | null;
  actionType: TodoActionType | null;
  actionData: any | null;
  orderIndex: number;
}

interface KitItem {
  id: string;
  label: string;
  notes: string | null;
  quantity: number;
  perPerson: boolean;
  required: boolean;
  weightGrams: number | null;
  category: string | null;
  isPacked: boolean;
  packedBy: string | null;
  packedAt: string | null;
  orderIndex: number;
}

interface ListInstance {
  id: string;
  tripId: string;
  type: ListType;
  listType: ListType;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
}

interface TripListsPanelProps {
  tripId: string;
  onOpenInviteDialog?: () => void;
  onOpenCreateChoice?: () => void;
}

export function TripListsPanel({ tripId, onOpenInviteDialog, onOpenCreateChoice }: TripListsPanelProps) {
  const { user } = useAuth();
  const [lists, setLists] = useState<ListInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ListType | "ALL">("ALL");
  const [confirmCompletionItem, setConfirmCompletionItem] = useState<{itemId: string; label: string} | null>(null);
  const [milestoneDialog, setMilestoneDialog] = useState<{isOpen: boolean; itemId: string; itemLabel: string} | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user, tripId, typeFilter]);

  const fetchLists = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const response = await fetch(`/api/trips/${tripId}/lists?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch lists (${response.status})`);
      }

      const data = await response.json();
      setLists(data.instances || []);
    } catch (err: any) {
      console.error("Error fetching lists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (listType: ListType, itemId: string, currentState: boolean) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/items/${listType}/${itemId}/toggle`, {
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

      // Refresh lists
      await fetchLists();
    } catch (err) {
      console.error("Error toggling item:", err);
    }
  };

  const handleLaunchAction = async (item: TodoItem) => {
    if (!user || !item.actionType) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/items/TODO/${item.id}/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to launch action");
      }

      const { deepLink } = await response.json();

      // Handle different action types
      switch (item.actionType) {
        case "INVITE_USERS":
          if (onOpenInviteDialog) {
            onOpenInviteDialog();
            // After the dialog is opened, show confirmation dialog when it closes
            setConfirmCompletionItem({ itemId: item.id, label: item.label });
          }
          break;
        case "CREATE_CHOICE":
          if (onOpenCreateChoice) {
            onOpenCreateChoice();
            setConfirmCompletionItem({ itemId: item.id, label: item.label });
          }
          break;
        case "SET_MILESTONE":
          // Open milestone creation dialog
          setMilestoneDialog({
            isOpen: true,
            itemId: item.id,
            itemLabel: item.label,
          });
          setMilestoneTitle(item.label); // Pre-fill with task label
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("Error launching action:", err);
    }
  };

  const handleConfirmCompletion = async (complete: boolean) => {
    if (!confirmCompletionItem) return;

    if (complete) {
      // Mark the item as done
      await handleToggleItem("TODO", confirmCompletionItem.itemId, false);
    }

    setConfirmCompletionItem(null);
  };

  const handleCreateMilestone = async () => {
    if (!user || !milestoneDialog || !milestoneTitle.trim()) return;

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

      // Ask if they want to mark the task as complete
      setConfirmCompletionItem({
        itemId: milestoneDialog.itemId,
        label: milestoneDialog.itemLabel,
      });

      // Close milestone dialog
      setMilestoneDialog(null);
      setMilestoneTitle("");
      setMilestoneDate("");
    } catch (err: any) {
      console.error("Error creating milestone:", err);
      alert(err.message || "Failed to create milestone");
    } finally {
      setCreatingMilestone(false);
    }
  };

  const getActionButtonText = (actionType: TodoActionType): string => {
    switch (actionType) {
      case "INVITE_USERS":
        return "Invite People";
      case "CREATE_CHOICE":
        return "Create Choice";
      case "SET_MILESTONE":
        return "Set Milestone";
      default:
        return "Launch Action";
    }
  };

  const getTypeIcon = (type: ListType) => {
    return type === "TODO" ? "✓" : "🎒";
  };

  const getTypeBadgeColor = (type: ListType) => {
    return type === "TODO"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  const todoLists = lists.filter((l) => l.type === "TODO");
  const kitLists = lists.filter((l) => l.type === "KIT");

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          📋 Lists
        </h2>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ListType | "ALL")}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="ALL">All</option>
            <option value="TODO">TODO</option>
            <option value="KIT">Kit</option>
          </select>
          <Button
            onClick={() => alert("Add list from template - Coming soon!")}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            + Add List
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && lists.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            No lists yet. Add a template to get started!
          </p>
        </div>
      )}

      {/* Lists */}
      {!loading && lists.length > 0 && (
        <div className="space-y-4">
          {lists.map((list) => {
            const isExpanded = expandedListId === list.id;
            const items = list.type === "TODO" ? list.todoItems || [] : list.kitItems || [];
            const completedCount =
              list.type === "TODO"
                ? list.todoItems?.filter((i) => i.isDone).length || 0
                : list.kitItems?.filter((i) => i.isPacked).length || 0;
            const totalCount = items.length;
            const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return (
              <div
                key={list.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* List Header */}
                <button
                  onClick={() => setExpandedListId(isExpanded ? null : list.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getTypeIcon(list.type)}</span>
                    <div className="text-left">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {list.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {completedCount} / {totalCount} {list.type === "TODO" ? "done" : "packed"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Progress Bar */}
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          list.type === "TODO" ? "bg-blue-600" : "bg-green-600"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Expand Icon */}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/20">
                    {list.type === "TODO" ? (
                      <div className="space-y-2">
                        {(list.todoItems || []).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-white dark:hover:bg-gray-800"
                          >
                            <label className="flex items-start gap-3 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.isDone}
                                onChange={() => handleToggleItem("TODO", item.id, item.isDone)}
                                className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <div className="flex-1">
                                <p
                                  className={`text-sm ${
                                    item.isDone
                                      ? "line-through text-gray-400 dark:text-gray-600"
                                      : "text-gray-900 dark:text-white"
                                  }`}
                                >
                                  {item.label}
                                </p>
                                {item.notes && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </label>
                            {item.actionType && !item.isDone && (
                              <Button
                                onClick={() => handleLaunchAction(item)}
                                className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
                              >
                                {getActionButtonText(item.actionType)}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(list.kitItems || []).map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-white dark:hover:bg-gray-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={item.isPacked}
                              onChange={() => handleToggleItem("KIT", item.id, item.isPacked)}
                              className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`text-sm ${
                                    item.isPacked
                                      ? "line-through text-gray-400 dark:text-gray-600"
                                      : "text-gray-900 dark:text-white"
                                  }`}
                                >
                                  {item.label}
                                </p>
                                {item.quantity !== 1 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ×{item.quantity}
                                  </span>
                                )}
                                {item.perPerson && (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                                    per person
                                  </span>
                                )}
                                {item.category && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Milestone Creation Dialog */}
      {milestoneDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create Milestone
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add a milestone to the trip timeline
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Milestone Title *
                </label>
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g., Book flights"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  disabled={creatingMilestone}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  disabled={creatingMilestone}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setMilestoneDialog(null);
                  setMilestoneTitle("");
                  setMilestoneDate("");
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200"
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
      {confirmCompletionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Mark Task as Complete?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Would you like to mark "{confirmCompletionItem.label}" as complete?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => handleConfirmCompletion(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200"
              >
                No, Keep Open
              </Button>
              <Button
                onClick={() => handleConfirmCompletion(true)}
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
