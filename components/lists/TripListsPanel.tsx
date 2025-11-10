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
          // For milestones, navigate to the route
          if (deepLink?.route) {
            window.location.href = deepLink.route;
          }
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
                          <label
                            key={item.id}
                            className="flex items-start gap-3 p-2 rounded hover:bg-white dark:hover:bg-gray-800 cursor-pointer"
                          >
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
    </div>
  );
}
