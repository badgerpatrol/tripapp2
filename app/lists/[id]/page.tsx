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
import InlineItemAdd from "@/components/lists/InlineItemAdd";

interface ListTemplate {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  type: ListType;
  listType: ListType;
  visibility: Visibility;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  todoItems?: Array<{
    id: string;
    label: string;
    notes: string | null;
    perPerson: boolean;
    orderIndex: number;
  }>;
  kitItems?: Array<{
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
  }>;
  inventory?: boolean;
}

function ViewListPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const templateId = params?.id as string;
  const returnTo = searchParams.get("returnTo") || "/lists";
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
  const [editItemDialog, setEditItemDialog] = useState<{
    isOpen: boolean;
    item: NonNullable<ListTemplate["kitItems"]>[number] | null;
  }>({
    isOpen: false,
    item: null,
  });
  const [editTodoItemDialog, setEditTodoItemDialog] = useState<{
    isOpen: boolean;
    item: NonNullable<ListTemplate["todoItems"]>[number] | null;
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

  const handleForkSuccess = () => {
    setToast({ message: "Template forked successfully!", type: "success" });
  };

  const handleCopySuccess = () => {
    setToast({ message: "Template copied to trip!", type: "success" });
  };

  const isOwner = user && template && user.uid === template.ownerId;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading template...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error || "Template not found"}</p>
          </div>
          <Button
            onClick={() => router.push(returnTo)}
            className="mt-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800"
            }`}
          >
            <p
              className={
                toast.type === "success"
                  ? "text-green-800 dark:text-green-200"
                  : "text-red-800 dark:text-red-200"
              }
            >
              {toast.message}
            </p>
          </div>
        )}

        {/* Compact Header with Back Button and Title */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push(returnTo)}
            className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">
              {template.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <Button
                onClick={() => {
                  const currentPageWithReturn = returnTo !== "/lists"
                    ? `/lists/${template.id}?returnTo=${encodeURIComponent(returnTo)}`
                    : `/lists/${template.id}`;
                  const editPath = template.type === "KIT"
                    ? `/lists/edit-kit/${template.id}?returnTo=${encodeURIComponent(currentPageWithReturn)}`
                    : `/lists/edit/${template.id}?returnTo=${encodeURIComponent(currentPageWithReturn)}`;
                  router.push(editPath);
                }}
                className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
              >
                Edit
              </Button>
            )}
            {!isOwner && (
              <Button
                onClick={() => setForkDialog({ isOpen: true, template })}
                className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
              >
                Copy
              </Button>
            )}
            <Button
              onClick={() => setCopyDialog({ isOpen: true, template })}
              className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
            >
              Use
            </Button>
          </div>
        </div>

        {/* Description and Tags - Compact */}
        {(template.description || (template.tags && template.tags.length > 0)) && (
          <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {template.description && <p className="mb-2">{template.description}</p>}
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Items List */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-6">
          {/* Inline Add Item */}
          {isOwner && (
            <div className="mb-4">
              <InlineItemAdd
                listType={template.type}
                templateId={template.id}
                templateTitle={template.title}
                isInventory={template.inventory || false}
                onItemAdded={() => {
                  // Refresh the template data
                  const fetchTemplate = async () => {
                    if (!user) return;
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
                  fetchTemplate();
                  setToast({ message: template.type === "TODO" ? "Task added" : "Item added", type: "success" });
                }}
              />
            </div>
          )}

          {template.type === "TODO" && template.todoItems && template.todoItems.length > 0 ? (
            <div className="-mx-6">
              {template.todoItems
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, index, arr) => (
                  <div
                    key={item.id}
                    onClick={isOwner ? () => setEditTodoItemDialog({ isOpen: true, item }) : undefined}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 ${index !== arr.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""} ${isOwner ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-800" : ""}`}
                  >
                    <span className="text-zinc-900 dark:text-white font-medium truncate">
                      {item.label}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                      {item.perPerson ? "per person" : "shared"}
                    </span>
                  </div>
                ))}
            </div>
          ) : template.type === "KIT" && template.kitItems && template.kitItems.length > 0 ? (
            <div className="-mx-6">
              {template.kitItems
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, index, arr) => {
                  // Build inline tags
                  const tags: { text: string; className: string }[] = [];

                  if (!template.inventory) {
                    tags.push({
                      text: item.perPerson ? "per person" : "shared",
                      className: "text-zinc-400 dark:text-zinc-500"
                    });
                    tags.push({
                      text: item.required ? "mandatory" : "optional",
                      className: item.required
                        ? "text-green-600/70 dark:text-green-400/70"
                        : "text-zinc-400 dark:text-zinc-500"
                    });
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={isOwner ? () => setEditItemDialog({ isOpen: true, item }) : undefined}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 ${index !== arr.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""} ${isOwner ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-800" : ""}`}
                    >
                      <span className="text-zinc-900 dark:text-white font-medium truncate">
                        {item.label}
                        {item.quantity > 1 && (
                          <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
                            ×{item.quantity}
                          </span>
                        )}
                      </span>
                      {tags.length > 0 && (
                        <span className="text-xs shrink-0">
                          {tags.map((tag, i) => (
                            <span key={i}>
                              {i > 0 && <span className="text-zinc-300 dark:text-zinc-600 mx-1">·</span>}
                              <span className={tag.className}>{tag.text}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
              No items in this list yet.
            </p>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {forkDialog.template && (
        <ForkTemplateDialog
          isOpen={forkDialog.isOpen}
          onClose={() => setForkDialog({ isOpen: false, template: null })}
          template={forkDialog.template}
          onSuccess={handleForkSuccess}
        />
      )}

      {copyDialog.template && (
        <CopyToTripDialog
          isOpen={copyDialog.isOpen}
          onClose={() => setCopyDialog({ isOpen: false, template: null })}
          template={copyDialog.template}
          onSuccess={handleCopySuccess}
        />
      )}

      {/* Edit Kit Item Dialog */}
      {editItemDialog.item && template && (
        <EditKitItemDialog
          isOpen={editItemDialog.isOpen}
          templateId={template.id}
          item={editItemDialog.item}
          onClose={() => setEditItemDialog({ isOpen: false, item: null })}
          onSaved={() => {
            setEditItemDialog({ isOpen: false, item: null });
            // Refresh the template data
            const fetchTemplate = async () => {
              if (!user) return;
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
            fetchTemplate();
            setToast({ message: "Item updated", type: "success" });
          }}
          onDeleted={() => {
            setEditItemDialog({ isOpen: false, item: null });
            // Refresh the template data
            const fetchTemplate = async () => {
              if (!user) return;
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
            fetchTemplate();
            setToast({ message: "Item deleted", type: "success" });
          }}
        />
      )}

      {/* Edit Todo Item Dialog */}
      {editTodoItemDialog.item && template && (
        <EditTodoItemDialog
          isOpen={editTodoItemDialog.isOpen}
          templateId={template.id}
          item={editTodoItemDialog.item}
          onClose={() => setEditTodoItemDialog({ isOpen: false, item: null })}
          onSaved={() => {
            setEditTodoItemDialog({ isOpen: false, item: null });
            // Refresh the template data
            const fetchTemplate = async () => {
              if (!user) return;
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
            fetchTemplate();
            setToast({ message: "Task updated", type: "success" });
          }}
          onDeleted={() => {
            setEditTodoItemDialog({ isOpen: false, item: null });
            // Refresh the template data
            const fetchTemplate = async () => {
              if (!user) return;
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
            fetchTemplate();
            setToast({ message: "Task deleted", type: "success" });
          }}
        />
      )}

    </div>
  );
}

export default function ViewListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ViewListPageContent />
    </Suspense>
  );
}
