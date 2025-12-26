"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ListType, TodoActionType } from "@/lib/generated/prisma";
import { AddListDialog } from "./AddListDialog";
import { ListReportDialog } from "./ListReportDialog";
import { EditTodoListForm } from "./EditTodoListForm";
import { EditKitListForm } from "./EditKitListForm";

interface ItemTick {
  id: string;
  userId: string;
  isShared: boolean;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    photoURL: string | null;
  };
}

interface TodoItem {
  id: string;
  label: string;
  notes: string | null;
  actionType: TodoActionType | null;
  actionData: any | null;
  parameters: Record<string, any> | null;
  orderIndex: number;
  perPerson: boolean;
  ticks?: ItemTick[];
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
  cost: number | null;
  url: string | null;
  orderIndex: number;
  ticks?: ItemTick[];
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
  sourceTemplateId: string | null;
  hasTemplateUpdated?: boolean;
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
}

interface TripListsPanelProps {
  tripId: string;
  onOpenInviteDialog?: () => void;
  onOpenCreateChoice?: (choiceName?: string) => void;
  onOpenMilestoneDialog?: (itemId: string, itemLabel: string) => void;
  onActionComplete?: (itemId: string, label: string) => void;
  onRefreshLists?: () => void;
  inWorkflowMode?: boolean;
  onOpenList?: (listId: string, listTitle: string) => void;
  selectedListId?: string; // ID of a specific list to show (hides others and container title)
  isOrganizer?: boolean; // If false and no lists exist, component will not render
  hideContainer?: boolean; // If true, will not render the outer container wrapper (for use when wrapped externally)
  onListsLoaded?: (count: number) => void; // Callback when lists are loaded, reports the count
  listTypeFilter?: ListType; // If set, only show lists of this type (TODO or KIT)
}

export function TripListsPanel({ tripId, onOpenInviteDialog, onOpenCreateChoice, onOpenMilestoneDialog, onActionComplete, onRefreshLists, inWorkflowMode = false, onOpenList, selectedListId, isOrganizer = true, hideContainer = false, onListsLoaded, listTypeFilter }: TripListsPanelProps) {
  const { user } = useAuth();
  const [lists, setLists] = useState<ListInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  // When listTypeFilter is set, force the type filter to that value; otherwise allow user selection
  const [typeFilter, setTypeFilter] = useState<ListType | "ALL">(listTypeFilter || "ALL");
  const [completionStatusFilter, setCompletionStatusFilter] = useState<"all" | "open" | "done">("all");
  const [confirmCompletionItem, setConfirmCompletionItem] = useState<{itemId: string; label: string} | null>(null);
  const [isAddListDialogOpen, setIsAddListDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{listId: string; listTitle: string} | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [reportListId, setReportListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListType, setEditingListType] = useState<ListType | null>(null);
  const [quickAddListId, setQuickAddListId] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");

  // In workflow mode, lists are always expanded. In normal mode, they open the workflow modal
  const shouldExpandInline = inWorkflowMode;

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user, tripId, typeFilter, completionStatusFilter]);

  const fetchLists = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (completionStatusFilter !== "all") params.set("completionStatus", completionStatusFilter);

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
      const fetchedLists = data.instances || [];
      setLists(fetchedLists);

      // Notify parent of list count
      if (onListsLoaded) {
        onListsLoaded(fetchedLists.length);
      }

      // In workflow mode, expand the selected list or the first list by default
      if (inWorkflowMode && fetchedLists.length > 0 && !expandedListId) {
        if (selectedListId) {
          setExpandedListId(selectedListId);
        } else {
          setExpandedListId(fetchedLists[0].id);
        }
      }
    } catch (err: any) {
      console.error("Error fetching lists:", err);
      setError(err.message);
      // Notify parent that loading is complete (with 0 lists) even on error
      if (onListsLoaded) {
        onListsLoaded(0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (listType: ListType, itemId: string, currentState: boolean) => {
    if (!user) return;

    const newState = !currentState;

    // Create the new tick object for optimistic update
    const newTickObj: ItemTick = {
      id: `temp-${Date.now()}`,
      userId: user.uid,
      isShared: false, // Will be set correctly below based on item
      createdAt: new Date().toISOString(),
      user: {
        id: user.uid,
        displayName: user.displayName || user.email || "You",
        photoURL: user.photoURL || null,
      },
    };

    // Optimistically update the UI immediately - only update the specific item
    setLists(prevLists => prevLists.map(list => {
      if (list.type === "TODO" && listType === "TODO" && list.todoItems) {
        const itemExists = list.todoItems.some(item => item.id === itemId);
        if (!itemExists) return list;

        return {
          ...list,
          todoItems: list.todoItems.map(item => {
            if (item.id === itemId) {
              const tickWithShared = { ...newTickObj, isShared: !item.perPerson };
              const newTicks = newState
                ? [...(item.ticks || []), tickWithShared]
                : (item.ticks || []).filter(t => t.userId !== user.uid);
              return {
                ...item,
                ticks: newTicks,
              };
            }
            return item;
          }),
        };
      } else if (list.type === "KIT" && listType === "KIT" && list.kitItems) {
        const itemExists = list.kitItems.some(item => item.id === itemId);
        if (!itemExists) return list;

        return {
          ...list,
          kitItems: list.kitItems.map(item => {
            if (item.id === itemId) {
              const tickWithShared = { ...newTickObj, isShared: !item.perPerson };
              const newTicks = newState
                ? [...(item.ticks || []), tickWithShared]
                : (item.ticks || []).filter(t => t.userId !== user.uid);
              return {
                ...item,
                ticks: newTicks,
              };
            }
            return item;
          }),
        };
      }
      return list;
    }));

    // Send API request in background - don't await or refetch on success
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/items/${listType}/${itemId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          state: newState,
        }),
      });

      if (!response.ok) {
        // Revert on error by toggling back
        console.error("Failed to toggle item, reverting...");
        setLists(prevLists => prevLists.map(list => {
          if (list.type === "TODO" && listType === "TODO" && list.todoItems) {
            return {
              ...list,
              todoItems: list.todoItems.map(item => {
                if (item.id === itemId) {
                  // Revert: if we tried to tick, remove the tick; if we tried to untick, add it back
                  const revertedTicks = newState
                    ? (item.ticks || []).filter(t => t.userId !== user.uid)
                    : [...(item.ticks || []), newTickObj];
                  return {
                    ...item,
                    ticks: revertedTicks,
                  };
                }
                return item;
              }),
            };
          } else if (list.type === "KIT" && listType === "KIT" && list.kitItems) {
            return {
              ...list,
              kitItems: list.kitItems.map(item => {
                if (item.id === itemId) {
                  const revertedTicks = newState
                    ? (item.ticks || []).filter(t => t.userId !== user.uid)
                    : [...(item.ticks || []), newTickObj];
                  return {
                    ...item,
                    ticks: revertedTicks,
                  };
                }
                return item;
              }),
            };
          }
          return list;
        }));
      }
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
          }
          if (onActionComplete) {
            onActionComplete(item.id, item.label);
          }
          break;
        case "CREATE_CHOICE":
          if (onOpenCreateChoice) {
            // Use choice name from parameters if available
            const choiceName = item.parameters?.choiceName || "";
            onOpenCreateChoice(choiceName);
          }
          if (onActionComplete) {
            onActionComplete(item.id, item.label);
          }
          break;
        case "SET_MILESTONE":
          if (onOpenMilestoneDialog) {
            // Use milestone name from parameters if available, otherwise fall back to item label
            const milestoneName = item.parameters?.milestoneName || item.label;
            onOpenMilestoneDialog(item.id, milestoneName);
          }
          if (onActionComplete) {
            onActionComplete(item.id, item.label);
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
      // Notify parent to refresh if needed
      if (onRefreshLists) {
        onRefreshLists();
      }
    }

    setConfirmCompletionItem(null);
  };

  const handleDeleteList = async () => {
    if (!user || !deleteConfirmation) return;

    setDeleting(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/instances/${deleteConfirmation.listId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete list");
      }

      // Close confirmation and refresh lists
      setDeleteConfirmation(null);
      await fetchLists();
    } catch (err) {
      console.error("Error deleting list:", err);
      alert("Failed to delete list. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickAddItem = async (listId: string, listType: ListType) => {
    if (!user || !quickAddValue.trim()) return;

    const label = quickAddValue.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistically update the UI immediately
    setLists(prevLists => prevLists.map(list => {
      if (list.id !== listId) return list;

      if (listType === "TODO") {
        const newItem: TodoItem = {
          id: tempId,
          label,
          notes: null,
          actionType: null,
          actionData: null,
          parameters: null,
          orderIndex: 0,
          perPerson: false,
          ticks: [],
        };
        // Shift existing items and add new one at top
        const updatedItems = (list.todoItems || []).map(item => ({
          ...item,
          orderIndex: item.orderIndex + 1,
        }));
        return {
          ...list,
          todoItems: [newItem, ...updatedItems],
        };
      } else {
        const newItem: KitItem = {
          id: tempId,
          label,
          notes: null,
          quantity: 1,
          perPerson: false,
          required: true,
          weightGrams: null,
          category: null,
          cost: null,
          url: null,
          orderIndex: 0,
          ticks: [],
        };
        // Shift existing items and add new one at top
        const updatedItems = (list.kitItems || []).map(item => ({
          ...item,
          orderIndex: item.orderIndex + 1,
        }));
        return {
          ...list,
          kitItems: [newItem, ...updatedItems],
        };
      }
    }));

    // Clear input and close quick add immediately
    setQuickAddValue("");
    setQuickAddListId(null);

    // Send API request in background
    try {
      const token = await user.getIdToken();

      const endpoint = listType === "TODO"
        ? `/api/lists/templates/${listId}/todo-items`
        : `/api/lists/templates/${listId}/kit-items`;

      const body = listType === "TODO"
        ? { label, orderIndex: 0 }
        : { label, quantity: 1, orderIndex: 0 };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Revert on error
        console.error("Failed to add item, reverting...");
        setLists(prevLists => prevLists.map(list => {
          if (list.id !== listId) return list;
          if (listType === "TODO") {
            return {
              ...list,
              todoItems: (list.todoItems || []).filter(item => item.id !== tempId).map(item => ({
                ...item,
                orderIndex: item.orderIndex - 1,
              })),
            };
          } else {
            return {
              ...list,
              kitItems: (list.kitItems || []).filter(item => item.id !== tempId).map(item => ({
                ...item,
                orderIndex: item.orderIndex - 1,
              })),
            };
          }
        }));
      } else {
        // Update the temp ID with the real ID from the server
        const data = await response.json();
        if (data.item?.id) {
          setLists(prevLists => prevLists.map(list => {
            if (list.id !== listId) return list;
            if (listType === "TODO") {
              return {
                ...list,
                todoItems: (list.todoItems || []).map(item =>
                  item.id === tempId ? { ...item, id: data.item.id } : item
                ),
              };
            } else {
              return {
                ...list,
                kitItems: (list.kitItems || []).map(item =>
                  item.id === tempId ? { ...item, id: data.item.id } : item
                ),
              };
            }
          }));
        }
      }
    } catch (err) {
      console.error("Error adding item:", err);
      // Revert on error
      setLists(prevLists => prevLists.map(list => {
        if (list.id !== listId) return list;
        if (listType === "TODO") {
          return {
            ...list,
            todoItems: (list.todoItems || []).filter(item => item.id !== tempId).map(item => ({
              ...item,
              orderIndex: item.orderIndex - 1,
            })),
          };
        } else {
          return {
            ...list,
            kitItems: (list.kitItems || []).filter(item => item.id !== tempId).map(item => ({
              ...item,
              orderIndex: item.orderIndex - 1,
            })),
          };
        }
      }));
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

  // If a specific list is selected, filter to show only that list
  const displayedLists = selectedListId
    ? lists.filter(list => list.id === selectedListId)
    : lists;

  // When showing a single list or hideContainer is true, hide the container wrapper
  const showContainer = !selectedListId && !hideContainer;

  // Only show filters when there are 2 or more lists
  const shouldShowFilters = lists.length >= 2;

  // For non-organizers, don't render if there are no lists and loading is complete
  if (!isOrganizer && !loading && lists.length === 0) {
    return null;
  }

  const content = (
    <>
      {/* Header - only show when displaying all lists */}
      {showContainer && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Lists</h2>
          </div>
        </div>
      )}

      {/* Action buttons row */}
      {!inWorkflowMode && isOrganizer && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button
            onClick={() => setIsAddListDialogOpen(true)}
            className="tap-target px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap"
          >
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add List</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      )}

      {/* Filter dropdowns - collapsible */}
      {!inWorkflowMode && shouldShowFilters && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Filters & Sort</span>
            <button
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className="tap-target p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
              aria-label={filtersCollapsed ? "Expand filters" : "Collapse filters"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {filtersCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                )}
              </svg>
            </button>
          </div>
          {!filtersCollapsed && (
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
              <div className={`grid grid-cols-1 ${!listTypeFilter ? 'sm:grid-cols-2' : ''} gap-4`}>
                {/* Only show type filter when listTypeFilter is not set */}
                {!listTypeFilter && (
                  <div>
                    <label htmlFor="list-type-filter" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Filter by Type
                    </label>
                    <select
                      id="list-type-filter"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as ListType | "ALL")}
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      <option value="ALL">All Lists</option>
                      <option value="TODO">TODO Lists</option>
                      <option value="KIT">Kit Lists</option>
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="list-completion-filter" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Filter by Status
                  </label>
                  <select
                    id="list-completion-filter"
                    value={completionStatusFilter}
                    onChange={(e) => setCompletionStatusFilter(e.target.value as "all" | "open" | "done")}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayedLists.length === 0 && (
        <div className="text-center py-8">
          <p className="text-zinc-500 dark:text-zinc-400">
            No lists yet. Add one to get started!
          </p>
        </div>
      )}

      {/* Lists */}
      {!loading && displayedLists.length > 0 && (
        <div className="space-y-4">
          {displayedLists.map((list) => {
            const isExpanded = expandedListId === list.id;
            const items = list.type === "TODO" ? list.todoItems || [] : list.kitItems || [];

            // Calculate separate personal and shared completion stats
            const allItems = list.type === "TODO" ? list.todoItems || [] : list.kitItems || [];

            // Personal items (perPerson = true) - check if current user has ticked
            const personalItems = allItems.filter(item => item.perPerson);
            const personalCompleted = personalItems.filter(item =>
              item.ticks?.some(t => t.userId === user?.uid)
            ).length;
            const personalTotal = personalItems.length;
            const personalPercentage = personalTotal > 0 ? Math.round((personalCompleted / personalTotal) * 100) : 0;

            // Shared items (perPerson = false) - check if anyone has ticked
            const sharedItems = allItems.filter(item => !item.perPerson);
            const sharedCompleted = sharedItems.filter(item =>
              item.ticks && item.ticks.length > 0
            ).length;
            const sharedTotal = sharedItems.length;
            const sharedPercentage = sharedTotal > 0 ? Math.round((sharedCompleted / sharedTotal) * 100) : 0;

            return (
              <div
                key={list.id}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
              >
                {/* List Header */}
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      if (shouldExpandInline) {
                        setExpandedListId(isExpanded ? null : list.id);
                      } else if (onOpenList) {
                        onOpenList(list.id, list.title);
                      }
                    }}
                    className="flex-1 p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getTypeIcon(list.type)}</span>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-zinc-900 dark:text-white">
                            {list.title}
                          </h3>
                          {list.hasTemplateUpdated && (
                            <span
                              className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                              title="The original template has been modified since this list was added to the trip"
                            >
                              Original list has changed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {/* Personal Progress Bar */}
                      {personalTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12 text-right">You</span>
                          <div className="w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all bg-blue-600"
                              style={{ width: `${personalPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8">{personalCompleted}/{personalTotal}</span>
                        </div>
                      )}
                      {/* Shared Progress Bar */}
                      {sharedTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12 text-right">Shared</span>
                          <div className="w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all bg-green-600"
                              style={{ width: `${sharedPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 w-8">{sharedCompleted}/{sharedTotal}</span>
                        </div>
                      )}
                    </div>
                  </button>

                {/* Report Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReportListId(list.id);
                  }}
                  className="p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                  title="View report"
                >
                  <svg
                    className="w-5 h-5 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </button>

                {/* Delete Button */}
                {!inWorkflowMode && isOrganizer && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmation({ listId: list.id, listTitle: list.title });
                    }}
                    className="p-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                    title="Delete list"
                  >
                    <svg
                      className="w-5 h-5 text-zinc-400 group-hover:text-red-600 dark:group-hover:text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}

                {/* Edit Button - styled as a visible button */}
                {isOrganizer && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingListId(list.id);
                      setEditingListType(list.type);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 m-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                    title="Edit list"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit
                  </button>
                )}
              </div>

                {/* Expanded Items - only in workflow mode */}
                {isExpanded && shouldExpandInline && (
                  <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-900/50">
                    {/* Quick Add Item */}
                    {isOrganizer && (
                      <div className="mb-4">
                        {quickAddListId === list.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={quickAddValue}
                              onChange={(e) => setQuickAddValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && quickAddValue.trim()) {
                                  handleQuickAddItem(list.id, list.type);
                                } else if (e.key === "Escape") {
                                  setQuickAddListId(null);
                                  setQuickAddValue("");
                                }
                              }}
                              placeholder={list.type === "TODO" ? "New task..." : "New item..."}
                              className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleQuickAddItem(list.id, list.type)}
                              disabled={!quickAddValue.trim()}
                              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => {
                                setQuickAddListId(null);
                                setQuickAddValue("");
                              }}
                              className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setQuickAddListId(list.id)}
                            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add {list.type === "TODO" ? "task" : "item"}
                          </button>
                        )}
                      </div>
                    )}

                    {list.type === "TODO" ? (
                      <div className="space-y-2">
                        {(list.todoItems || []).map((item) => {
                          // Check if current user has ticked this item
                          const userTick = item.ticks?.find(t => t.userId === user?.uid);
                          const isTickedByUser = !!userTick;
                          const isSharedItem = !item.perPerson;
                          // For shared items, check if someone else has ticked it
                          const otherUserTick = isSharedItem ? item.ticks?.find(t => t.userId !== user?.uid) : null;
                          const isTickedByOther = !!otherUserTick;
                          // Determine if checkbox should be disabled (shared item ticked by someone else)
                          const isDisabled = isSharedItem && isTickedByOther && !isTickedByUser;

                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-3 p-2 rounded hover:bg-white dark:hover:bg-zinc-800 ${isDisabled ? "opacity-60" : ""}`}
                            >
                              <label className="flex items-start gap-3 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isTickedByUser}
                                  onChange={() => handleToggleItem("TODO", item.id, isTickedByUser)}
                                  disabled={isDisabled}
                                  className={`mt-1 w-4 h-4 rounded focus:ring-blue-500 ${isDisabled ? "text-zinc-400 cursor-not-allowed" : "text-blue-600"}`}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm text-zinc-900 dark:text-white">
                                      {item.label}
                                    </p>
                                    {item.perPerson && (
                                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                                        per person
                                      </span>
                                    )}
                                  </div>
                                  {item.notes && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                      {item.notes}
                                    </p>
                                  )}
                                  {/* Always show status for shared items */}
                                  {isSharedItem && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                      {item.ticks && item.ticks.length > 0
                                        ? `Done by: ${item.ticks.map(t => t.user.displayName).join(", ")}`
                                        : "No one yet"}
                                    </p>
                                  )}
                                </div>
                              </label>
                              {item.actionType && !isTickedByUser && !isDisabled && (
                                <Button
                                  onClick={() => handleLaunchAction(item)}
                                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                                >
                                  {getActionButtonText(item.actionType)}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(list.kitItems || []).map((item) => {
                          // Check if current user has ticked this item
                          const userTick = item.ticks?.find(t => t.userId === user?.uid);
                          const isTickedByUser = !!userTick;
                          const isSharedItem = !item.perPerson;
                          // For shared items, check if someone else has ticked it
                          const otherUserTick = isSharedItem ? item.ticks?.find(t => t.userId !== user?.uid) : null;
                          const isTickedByOther = !!otherUserTick;
                          // Determine if checkbox should be disabled (shared item ticked by someone else)
                          const isDisabled = isSharedItem && isTickedByOther && !isTickedByUser;

                          return (
                            <label
                              key={item.id}
                              className={`flex items-start gap-3 p-2 rounded hover:bg-white dark:hover:bg-zinc-800 cursor-pointer ${isDisabled ? "opacity-60" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isTickedByUser}
                                onChange={() => handleToggleItem("KIT", item.id, isTickedByUser)}
                                disabled={isDisabled}
                                className={`mt-1 w-4 h-4 rounded focus:ring-green-500 ${isDisabled ? "text-zinc-400 cursor-not-allowed" : "text-green-600"}`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-zinc-900 dark:text-white">
                                    {item.label}
                                  </p>
                                  {item.quantity !== 1 && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      ×{item.quantity}
                                    </span>
                                  )}
                                  {item.perPerson && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                                      per person
                                    </span>
                                  )}
                                  {item.category && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    {item.notes}
                                  </p>
                                )}
                                {/* Always show status for shared items */}
                                {isSharedItem && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    {item.ticks && item.ticks.length > 0
                                      ? `Packed by: ${item.ticks.map(t => t.user.displayName).join(", ")}`
                                      : "No one yet"}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  {item.weightGrams && (
                                    <span>{item.weightGrams}g</span>
                                  )}
                                  {item.cost && (
                                    <span>${Number(item.cost).toFixed(2)}</span>
                                  )}
                                  {item.url && (
                                    <a
                                      href={item.url.startsWith('http://') || item.url.startsWith('https://') ? item.url : `https://${item.url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      link
                                    </a>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Confirmation Dialog */}
      {confirmCompletionItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Mark Task as Complete?
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Would you like to mark "{confirmCompletionItem.label}" as complete?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => handleConfirmCompletion(false)}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
              >
                No, Keep Open
              </Button>
              <Button
                onClick={() => handleConfirmCompletion(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Yes, Mark Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Delete List?
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Are you sure you want to delete "<strong>{deleteConfirmation.listTitle}</strong>"? This will permanently remove the list and all its items from this trip. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteList}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete List"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add List Dialog */}
      <AddListDialog
        isOpen={isAddListDialogOpen}
        onClose={() => setIsAddListDialogOpen(false)}
        tripId={tripId}
        onSuccess={() => {
          setIsAddListDialogOpen(false);
          fetchLists(); // Refresh the lists after adding
        }}
        listTypeFilter={listTypeFilter}
      />

      {/* List Report Dialog */}
      {reportListId && (() => {
        const reportList = lists.find(l => l.id === reportListId);
        if (!reportList) return null;
        return (
          <ListReportDialog
            isOpen={true}
            onClose={() => setReportListId(null)}
            listTitle={reportList.title}
            listType={reportList.type}
            todoItems={reportList.type === "TODO" ? reportList.todoItems : undefined}
            kitItems={reportList.type === "KIT" ? reportList.kitItems : undefined}
            currentUserId={user?.uid}
          />
        );
      })()}

      {/* Edit List Dialog */}
      {editingListId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
            {editingListType === "TODO" ? (
              <EditTodoListForm
                listId={editingListId}
                onClose={() => {
                  setEditingListId(null);
                  setEditingListType(null);
                }}
                onSaved={() => {
                  setEditingListId(null);
                  setEditingListType(null);
                  fetchLists(); // Refresh the lists after editing
                }}
                isTripList={true}
              />
            ) : (
              <EditKitListForm
                listId={editingListId}
                onClose={() => {
                  setEditingListId(null);
                  setEditingListType(null);
                }}
                onSaved={() => {
                  setEditingListId(null);
                  setEditingListType(null);
                  fetchLists(); // Refresh the lists after editing
                }}
                isTripList={true}
              />
            )}
          </div>
        </div>
      )}
    </>
  );

  return showContainer ? (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6 md:p-8 mb-6">
      {content}
    </div>
  ) : (
    content
  );
}
