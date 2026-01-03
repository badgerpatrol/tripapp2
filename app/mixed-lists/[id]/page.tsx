"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ListType, Visibility } from "@/lib/generated/prisma";
import { ForkTemplateDialog } from "@/components/lists/ForkTemplateDialog";
import { CopyToTripDialog } from "@/components/lists/CopyToTripDialog";
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
  ownerId: string;
  title: string;
  description: string | null;
  type: ListType;
  listType: ListType;
  visibility: Visibility;
  displayMode: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
  inventory?: boolean;
}

function ViewMixedListPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const templateId = params?.id as string;
  const returnTo = searchParams.get("returnTo") || "/mixed-lists";
  const { user, loading: authLoading } = useAuth();
  const [template, setTemplate] = useState<ListTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Dialog states
  const [forkDialog, setForkDialog] = useState<{ isOpen: boolean; template: ListTemplate | null }>({
    isOpen: false,
    template: null,
  });
  const [copyDialog, setCopyDialog] = useState<{ isOpen: boolean; template: ListTemplate | null }>({
    isOpen: false,
    template: null,
  });
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
    if (!user || !templateId) return;

    const fetchTemplate = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/lists/templates/${templateId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch template");
        }

        const data = await response.json();
        setTemplate(data.template);
      } catch (err: any) {
        console.error("Error fetching template:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [user, templateId]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const refreshTemplate = async () => {
    if (!user || !templateId) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplate(data.template);
      }
    } catch (err) {
      console.error("Error refreshing template:", err);
    }
  };

  const isOwner = template && user && template.ownerId === user.uid;

  // Combine items for display based on displayMode
  const getAllItems = () => {
    if (!template) return [];

    const todoItems = (template.todoItems || []).map(item => ({
      ...item,
      itemType: "TODO" as const,
    }));
    const kitItems = (template.kitItems || []).map(item => ({
      ...item,
      itemType: "KIT" as const,
    }));

    if (template.displayMode === "interleaved") {
      // Sort all items by orderIndex
      return [...todoItems, ...kitItems].sort((a, b) => a.orderIndex - b.orderIndex);
    } else {
      // Grouped: TODO items first, then KIT items
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

  if (error || !template) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "Template not found"}</p>
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
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{template.title}</h1>
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span>{allItems.length} items</span>
                {template.displayMode === "interleaved" && <span>(interleaved)</span>}
                {template.visibility === "PUBLIC" && (
                  <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                    Public
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCopyDialog({ isOpen: true, template })}
                className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add to Trip
              </Button>
              {!isOwner && (
                <Button
                  onClick={() => setForkDialog({ isOpen: true, template })}
                  className="text-sm px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
                >
                  Fork
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Description */}
      {template.description && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <p className="text-zinc-600 dark:text-zinc-400">{template.description}</p>
        </div>
      )}

      {/* Items List */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-200 dark:divide-zinc-700">
          {/* Inline Add for owners */}
          {isOwner && (
            <div className="px-4 py-3">
              <InlineMixedItemAdd
                templateId={templateId}
                templateTitle={template.title}
                onItemAdded={refreshTemplate}
              />
            </div>
          )}

          {allItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              No items in this list yet.
            </div>
          ) : (
            <>
              {template.displayMode !== "interleaved" && (template.todoItems?.length ?? 0) > 0 && (
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">Tasks</span>
              </div>
            )}
            {allItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!isOwner) return;
                  if (item.itemType === "TODO") {
                    setEditTodoItemDialog({ isOpen: true, item: item as TodoItem });
                  } else {
                    setEditKitItemDialog({ isOpen: true, item: item as KitItem });
                  }
                }}
                className={`px-4 py-3 flex items-center gap-3 ${isOwner ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50" : ""}`}
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

                {/* Chevron for editable items */}
                {isOwner && (
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
              {template.displayMode !== "interleaved" && (template.kitItems?.length ?? 0) > 0 && (template.todoItems?.length ?? 0) > 0 && (
                <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20">
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">Items</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {forkDialog.template && (
        <ForkTemplateDialog
          isOpen={forkDialog.isOpen}
          template={forkDialog.template}
          onClose={() => setForkDialog({ isOpen: false, template: null })}
          onSuccess={() => {
            setForkDialog({ isOpen: false, template: null });
            setToast({ message: "List forked successfully!", type: "success" });
          }}
        />
      )}

      {copyDialog.template && (
        <CopyToTripDialog
          isOpen={copyDialog.isOpen}
          template={copyDialog.template}
          onClose={() => setCopyDialog({ isOpen: false, template: null })}
          onSuccess={() => {
            setCopyDialog({ isOpen: false, template: null });
            setToast({ message: "List added to trip!", type: "success" });
          }}
        />
      )}

      {editKitItemDialog.item && (
        <EditKitItemDialog
          isOpen={editKitItemDialog.isOpen}
          item={editKitItemDialog.item}
          templateId={templateId}
          onClose={() => setEditKitItemDialog({ isOpen: false, item: null })}
          onSaved={() => {
            setEditKitItemDialog({ isOpen: false, item: null });
            refreshTemplate();
          }}
          onDeleted={() => {
            setEditKitItemDialog({ isOpen: false, item: null });
            refreshTemplate();
          }}
        />
      )}

      {editTodoItemDialog.item && (
        <EditTodoItemDialog
          isOpen={editTodoItemDialog.isOpen}
          item={editTodoItemDialog.item}
          templateId={templateId}
          onClose={() => setEditTodoItemDialog({ isOpen: false, item: null })}
          onSaved={() => {
            setEditTodoItemDialog({ isOpen: false, item: null });
            refreshTemplate();
          }}
          onDeleted={() => {
            setEditTodoItemDialog({ isOpen: false, item: null });
            refreshTemplate();
          }}
        />
      )}
    </div>
  );
}

export default function ViewMixedListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <ViewMixedListPageContent />
    </Suspense>
  );
}
