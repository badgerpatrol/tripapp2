"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ListType, TodoActionType } from "@/lib/generated/prisma";
import InlineMixedItemAdd from "./InlineMixedItemAdd";
import { useToastStore } from "@/lib/stores/toastStore";

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
  displayMode: string | null;
  createdAt: string;
  updatedAt: string;
  sourceTemplateId: string | null;
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
}

interface MixedListWorkflowModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  listTitle?: string;
  selectedListId?: string;
  isOrganizer?: boolean;
}

export function MixedListWorkflowModal({
  tripId,
  isOpen,
  onClose,
  listTitle = "",
  selectedListId,
  isOrganizer = true,
}: MixedListWorkflowModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  const [list, setList] = useState<ListInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!user || !selectedListId) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ type: "LIST" });

      const response = await fetch(`/api/trips/${tripId}/lists?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch list");
      }

      const data = await response.json();
      const mixedLists = (data.instances || []).filter((l: ListInstance) => l.type === "LIST");
      const foundList = mixedLists.find((l: ListInstance) => l.id === selectedListId);

      if (foundList) {
        setList(foundList);
      } else {
        setError("List not found");
      }
    } catch (err: any) {
      console.error("Error fetching list:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, tripId, selectedListId]);

  useEffect(() => {
    if (isOpen && selectedListId) {
      fetchList();
    }
  }, [isOpen, selectedListId, fetchList]);

  const toggleItem = async (listType: "TODO" | "KIT", itemId: string, currentState: boolean) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/items/${listType}/${itemId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state: !currentState }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle item");
      }

      // Refresh list
      fetchList();
    } catch (err: any) {
      console.error("Error toggling item:", err);
      addToast({ message: err.message, type: "error" });
    }
  };

  // Get all items for display, sorted appropriately
  const getAllItems = () => {
    if (!list) return [];

    const todoItems = (list.todoItems || []).map(item => ({
      ...item,
      itemType: "TODO" as const,
    }));
    const kitItems = (list.kitItems || []).map(item => ({
      ...item,
      itemType: "KIT" as const,
    }));

    if (list.displayMode === "interleaved") {
      return [...todoItems, ...kitItems].sort((a, b) => a.orderIndex - b.orderIndex);
    } else {
      // Grouped: TODO items first, then KIT items
      return [...todoItems, ...kitItems];
    }
  };

  // Check if an item is completed (has tick from current user)
  const isItemCompleted = (item: TodoItem | KitItem) => {
    if (!user) return false;
    return item.ticks?.some(tick => tick.userId === user.uid) || false;
  };

  if (!isOpen) return null;

  const allItems = getAllItems();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-hidden box-border">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ maxWidth: 'min(56rem, calc(100vw - 2rem))' }}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between min-w-0 overflow-hidden">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white truncate">
              {listTitle || list?.title || "Mixed List"}
            </h2>
          </div>
          {/* Edit Button */}
          {selectedListId && isOrganizer && (
            <button
              onClick={() => {
                router.push(`/lists/edit-mixed/${selectedListId}?returnTo=/trips/${tripId}`);
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 min-w-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          ) : list ? (
            <div className="space-y-4">
              {/* Inline Add for organizers */}
              {isOrganizer && (
                <div className="mb-4">
                  <InlineMixedItemAdd
                    templateId={list.id}
                    templateTitle={list.title}
                    onItemAdded={fetchList}
                  />
                </div>
              )}

              {/* Section headers for grouped mode */}
              {list.displayMode !== "interleaved" && (list.todoItems?.length ?? 0) > 0 && (
                <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">Tasks</span>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2">
                {allItems.map((item) => {
                  const completed = isItemCompleted(item);
                  const showKitHeader = list.displayMode !== "interleaved" &&
                    item.itemType === "KIT" &&
                    (list.kitItems?.length ?? 0) > 0 &&
                    (list.todoItems?.length ?? 0) > 0 &&
                    list.kitItems?.[0]?.id === item.id;

                  return (
                    <div key={item.id}>
                      {showKitHeader && (
                        <div className="px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded mb-2">
                          <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">Items</span>
                        </div>
                      )}
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer border border-zinc-200 dark:border-zinc-700"
                        onClick={() => toggleItem(item.itemType, item.id, completed)}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                            completed
                              ? "bg-green-600 border-green-600"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {completed && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Type badge */}
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                            item.itemType === "TODO"
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                              : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          }`}
                        >
                          {item.itemType === "TODO" ? "Task" : "Item"}
                        </span>

                        {/* Label */}
                        <span className={`flex-1 ${completed ? "line-through text-zinc-400" : "text-zinc-900 dark:text-white"}`}>
                          {item.label}
                        </span>

                        {/* Additional info */}
                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                          {item.itemType === "KIT" && (item as KitItem).quantity > 1 && (
                            <span>x{(item as KitItem).quantity}</span>
                          )}
                          {item.perPerson && (
                            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded">pp</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {allItems.length === 0 && (
                <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                  No items in this list yet. Add one above!
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex justify-between items-center">
            <Button
              onClick={onClose}
              variant="primary"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
