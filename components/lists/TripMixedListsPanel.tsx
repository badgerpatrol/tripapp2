"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ListType, TodoActionType } from "@/lib/generated/prisma";
import QuickAddMixedItemSheet from "./QuickAddMixedItemSheet";
import { useLongPress } from "@/hooks/useLongPress";

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
  hasTemplateUpdated?: boolean;
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
}

interface TripMixedListsPanelProps {
  tripId: string;
  isOrganizer?: boolean;
  onListsLoaded?: (count: number) => void;
  onListsData?: (ids: string[], sourceTemplateIds: string[]) => void;
  onOpenList?: (listId: string, listTitle: string) => void;
}

// Wrapper component for list header with long press support
interface ListHeaderButtonProps {
  list: ListInstance;
  onClick: () => void;
  onLongPress: (list: ListInstance) => void;
  children: React.ReactNode;
}

function ListHeaderButton({ list, onClick, onLongPress, children }: ListHeaderButtonProps) {
  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress(list),
    onClick: () => onClick(),
  });

  return (
    <button
      {...longPressHandlers}
      className="flex-1 min-w-0 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
    >
      {children}
    </button>
  );
}

export function TripMixedListsPanel({ tripId, isOrganizer = true, onListsLoaded, onListsData, onOpenList }: TripMixedListsPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [lists, setLists] = useState<ListInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick add sheet state (for long press on list headers)
  const [quickAddSheet, setQuickAddSheet] = useState<{
    isOpen: boolean;
    list: ListInstance | null;
  }>({ isOpen: false, list: null });

  const fetchLists = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ type: "LIST" });

      const response = await fetch(`/api/trips/${tripId}/lists?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch lists");
      }

      const data = await response.json();
      const mixedLists = (data.instances || []).filter((l: ListInstance) => l.type === "LIST");
      setLists(mixedLists);
      onListsLoaded?.(mixedLists.length);

      // Provide list IDs and source template IDs for duplicate detection
      const ids = mixedLists.map((l: ListInstance) => l.id);
      const sourceIds = mixedLists
        .map((l: ListInstance) => l.sourceTemplateId)
        .filter((id: string | null): id is string => id !== null);
      onListsData?.(ids, sourceIds);
    } catch (err: any) {
      console.error("Error fetching mixed lists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tripId]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Get all items for a list to calculate completion stats
  const getListItems = (list: ListInstance) => {
    const todoItems = list.todoItems || [];
    const kitItems = list.kitItems || [];
    return [...todoItems, ...kitItems];
  };

  // Check if an item is completed (has tick from current user)
  const isItemCompleted = (item: TodoItem | KitItem) => {
    if (!user) return false;
    return item.ticks?.some(tick => tick.userId === user.uid) || false;
  };

  if (!isOrganizer && lists.length === 0 && !loading) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 dark:text-zinc-400">
          No lists yet. Add one to get started!
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Lists */}
      <div className="space-y-4">
        {lists.map((list) => {
          const allItems = getListItems(list);

          // Calculate separate personal and shared completion stats
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
              {/* List Header with Edit Button */}
              <div className="flex items-center min-w-0 overflow-hidden">
                <ListHeaderButton
                  list={list}
                  onClick={() => onOpenList?.(list.id, list.title)}
                  onLongPress={(list) => setQuickAddSheet({ isOpen: true, list })}
                >
                  <div className="flex flex-col gap-2 w-full">
                    {/* Title at top */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-zinc-900 dark:text-white truncate">
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

                    {/* Progress bars below title */}
                    <div className="flex flex-col gap-1.5">
                      {/* Personal Progress Bar */}
                      {personalTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12">You</span>
                          <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all bg-blue-600"
                              style={{ width: `${personalPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{personalCompleted}/{personalTotal}</span>
                        </div>
                      )}
                      {/* Shared Progress Bar */}
                      {sharedTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12">Shared</span>
                          <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all bg-green-600"
                              style={{ width: `${sharedPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{sharedCompleted}/{sharedTotal}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </ListHeaderButton>

                {/* Edit Button */}
                {isOrganizer && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/lists/edit-mixed/${list.id}?returnTo=/trips/${tripId}`);
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 m-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
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
            </div>
          );
        })}
      </div>

      {/* Quick Add Mixed Item Sheet (for long press on list headers) */}
      {quickAddSheet.list && (
        <QuickAddMixedItemSheet
          isOpen={quickAddSheet.isOpen}
          onClose={() => setQuickAddSheet({ isOpen: false, list: null })}
          templateId={quickAddSheet.list.id}
          templateTitle={quickAddSheet.list.title}
          onItemAdded={() => {
            fetchLists();
          }}
        />
      )}
    </>
  );
}
