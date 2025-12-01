"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ListType, Visibility } from "@/lib/generated/prisma";
import { ForkTemplateDialog } from "@/components/lists/ForkTemplateDialog";
import { CopyToTripDialog } from "@/components/lists/CopyToTripDialog";

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; template: ListTemplate | null }>({
    isOpen: false,
    template: null,
  });
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async (template: ListTemplate) => {
    if (!user) return;

    setDeleting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/templates/${template.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      setToast({ message: "Template deleted successfully!", type: "success" });
      setTimeout(() => router.push("/lists"), 1000);
    } catch (err: any) {
      console.error("Error deleting template:", err);
      setError(err.message);
    } finally {
      setDeleting(false);
      setDeleteConfirm({ isOpen: false, template: null });
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

        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push(returnTo)}
            className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* Header Card */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getTypeIcon(template.type)}</span>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                  {template.title}
                </h1>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(template.type)}`}>
                    {template.type}
                  </span>
                  {template.visibility === "PUBLIC" && (
                    <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>🌐</span> Public
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {template.description && (
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              {template.description}
            </p>
          )}

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            {isOwner && (
              <>
                <Button
                  onClick={() => {
                    const editPath = template.type === "KIT"
                      ? `/lists/edit-kit/${template.id}?returnTo=${encodeURIComponent(returnTo)}`
                      : `/lists/edit/${template.id}?returnTo=${encodeURIComponent(returnTo)}`;
                    router.push(editPath);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => setDeleteConfirm({ isOpen: true, template })}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </>
            )}
            {!isOwner && (
              <Button
                onClick={() => setForkDialog({ isOpen: true, template })}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Copy
              </Button>
            )}
            <Button
              onClick={() => setCopyDialog({ isOpen: true, template })}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Use in Trip
            </Button>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            {template.type === "TODO" ? "Tasks" : "Items"} (
            {template.type === "TODO"
              ? template.todoItems?.length || 0
              : template.kitItems?.length || 0}
            )
          </h2>

          {template.type === "TODO" && template.todoItems && template.todoItems.length > 0 ? (
            <div className="space-y-3">
              {template.todoItems
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-zinc-900 dark:text-white font-medium">
                          {item.label}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : template.type === "KIT" && template.kitItems && template.kitItems.length > 0 ? (
            <div className="space-y-3">
              {template.kitItems
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, index) => (
                  <div
                    key={item.id}
                    className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-zinc-900 dark:text-white font-medium">
                            {item.label}
                          </p>
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">
                            × {item.quantity}
                          </span>
                          {!template.inventory && (
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              item.perPerson
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                            }`}>
                              {item.perPerson ? "per person" : "shared"}
                            </span>
                          )}
                          {!template.inventory && (
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              item.required
                                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                            }`}>
                              {item.required ? "mandatory" : "optional"}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {item.category && (
                            <span>Category: {item.category}</span>
                          )}
                          {item.weightGrams && (
                            <span>Weight: {item.weightGrams}g</span>
                          )}
                          {item.cost && (
                            <span>Cost: ${Number(item.cost).toFixed(2)}</span>
                          )}
                        </div>
                        {item.url && (
                          <a
                            href={item.url.startsWith('http://') || item.url.startsWith('https://') ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                          >
                            {item.url}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && deleteConfirm.template && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Delete Template
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Are you sure you want to delete "{deleteConfirm.template.title}"? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setDeleteConfirm({ isOpen: false, template: null })}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirm.template!)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
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
