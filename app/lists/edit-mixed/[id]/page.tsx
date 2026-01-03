"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ListType } from "@/lib/generated/prisma";
import { EditKitItemDialog } from "@/components/lists/EditKitItemDialog";
import { EditTodoItemDialog } from "@/components/lists/EditTodoItemDialog";
import InlineMixedItemAdd from "@/components/lists/InlineMixedItemAdd";

interface TodoItem {
  id: string;
  label: string;
  notes: string | null;
  perPerson: boolean;
  orderIndex: number;
}

interface KitItem {
  id: string;
  label: string;
  notes: string | null;
  quantity: number;
  category: string | null;
  weightGrams: number | null;
  cost: number | null;
  url: string | null;
  orderIndex: number;
  perPerson: boolean;
  required: boolean;
}

interface ListTemplate {
  id: string;
  title: string;
  description: string | null;
  type: ListType;
  listType: ListType;
  displayMode: string | null;
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
}

function EditMixedListPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const listId = params?.id as string;
  const returnTo = searchParams.get("returnTo") || `/lists/${listId}`;
  const { user, loading: authLoading } = useAuth();
  const [list, setList] = useState<ListTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [editKitItemDialog, setEditKitItemDialog] = useState<{
    isOpen: boolean;
    item: KitItem | null;
  }>({
    isOpen: false,
    item: null,
  });
  const [editTodoItemDialog, setEditTodoItemDialog] = useState<{
    isOpen: boolean;
    item: TodoItem | null;
  }>({
    isOpen: false,
    item: null,
  });

  useEffect(() => {
    if (!user || !listId) return;

    const fetchList = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/lists/templates/${listId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch list");
        }

        const data = await response.json();
        setList(data.template);
      } catch (err: any) {
        console.error("Error fetching list:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [user, listId]);

  const refreshList = async () => {
    if (!user || !listId) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/templates/${listId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setList(data.template);
      }
    } catch (err) {
      console.error("Error refreshing list:", err);
    }
  };

  // Combine items for display based on displayMode
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
      return [...todoItems, ...kitItems];
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "List not found"}</p>
          <Button onClick={() => router.push(returnTo)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const allItems = getAllItems();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(returnTo)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
            >
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{list.title}</h1>
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span>{allItems.length} items</span>
                {list.displayMode === "interleaved" && <span>(interleaved)</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {list.description && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <p className="text-zinc-600 dark:text-zinc-400">{list.description}</p>
        </div>
      )}

      {/* Items List */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-200 dark:divide-zinc-700">
          {/* Inline Add */}
          <div className="px-4 py-3">
            <InlineMixedItemAdd
              templateId={listId}
              templateTitle={list.title}
              onItemAdded={refreshList}
            />
          </div>

          {allItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              No items in this list yet.
            </div>
          ) : (
            <>
              {list.displayMode !== "interleaved" && (list.todoItems?.length ?? 0) > 0 && (
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">Tasks</span>
                </div>
              )}
              {allItems.map((item, index) => {
                const showKitHeader = list.displayMode !== "interleaved" &&
                  item.itemType === "KIT" &&
                  (list.kitItems?.length ?? 0) > 0 &&
                  (list.todoItems?.length ?? 0) > 0 &&
                  list.kitItems?.[0]?.id === item.id;

                return (
                  <div key={item.id}>
                    {showKitHeader && (
                      <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20">
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">Items</span>
                      </div>
                    )}
                    <div
                      onClick={() => {
                        if (item.itemType === "TODO") {
                          setEditTodoItemDialog({ isOpen: true, item: item as TodoItem });
                        } else {
                          setEditKitItemDialog({ isOpen: true, item: item as KitItem });
                        }
                      }}
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    >
                      {/* Type badge */}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          item.itemType === "TODO"
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                            : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        }`}
                      >
                        {item.itemType === "TODO" ? "Task" : "Item"}
                      </span>

                      {/* Label */}
                      <span className="flex-1 text-zinc-900 dark:text-white">{item.label}</span>

                      {/* Additional info */}
                      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {item.itemType === "KIT" && (item as KitItem).quantity > 1 && (
                          <span>x{(item as KitItem).quantity}</span>
                        )}
                        {item.perPerson && (
                          <span className="text-xs bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">per person</span>
                        )}
                      </div>

                      {/* Chevron */}
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Edit Dialogs */}
      {editKitItemDialog.item && (
        <EditKitItemDialog
          isOpen={editKitItemDialog.isOpen}
          item={editKitItemDialog.item}
          templateId={listId}
          onClose={() => setEditKitItemDialog({ isOpen: false, item: null })}
          onSaved={() => {
            setEditKitItemDialog({ isOpen: false, item: null });
            refreshList();
          }}
          onDeleted={() => {
            setEditKitItemDialog({ isOpen: false, item: null });
            refreshList();
          }}
        />
      )}

      {editTodoItemDialog.item && (
        <EditTodoItemDialog
          isOpen={editTodoItemDialog.isOpen}
          item={editTodoItemDialog.item}
          templateId={listId}
          onClose={() => setEditTodoItemDialog({ isOpen: false, item: null })}
          onSaved={() => {
            setEditTodoItemDialog({ isOpen: false, item: null });
            refreshList();
          }}
          onDeleted={() => {
            setEditTodoItemDialog({ isOpen: false, item: null });
            refreshList();
          }}
        />
      )}
    </div>
  );
}

export default function EditMixedListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <EditMixedListPageContent />
    </Suspense>
  );
}
