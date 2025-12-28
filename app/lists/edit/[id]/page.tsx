"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Visibility, TodoActionType } from "@/lib/generated/prisma";

interface TodoItem {
  id: string;
  label: string;
  notes: string;
  perPerson: boolean;
  actionType: TodoActionType | null;
  actionData: Record<string, any> | null;
  parameters: Record<string, any> | null;
  orderIndex: number;
}

interface ListTemplate {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  tags: string[];
  type: string;
  todoItems?: TodoItem[];
}

function EditListPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const templateId = params?.id as string;
  const returnTo = searchParams.get("returnTo") || `/lists/${templateId}`;
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [tags, setTags] = useState<string>("");
  const [items, setItems] = useState<TodoItem[]>([]);

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
        const template: ListTemplate = data.template;

        setTitle(template.title);
        setDescription(template.description || "");
        setVisibility(template.visibility);
        setTags(template.tags.join(", "));

        // Sort items by orderIndex and add temporary IDs for UI
        const sortedItems = (template.todoItems || [])
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(item => ({
            ...item,
            notes: item.notes || "",
          }));
        setItems(sortedItems);
      } catch (err: any) {
        console.error("Error fetching template:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [user, templateId]);

  const addItem = () => {
    setItems([
      {
        id: `new-${crypto.randomUUID()}`,
        label: "",
        notes: "",
        perPerson: false,
        actionType: null,
        actionData: null,
        parameters: null,
        orderIndex: 0
      },
      ...items,
    ]);
    // Focus the new item's input after render
    setTimeout(() => {
      newItemInputRef.current?.focus();
    }, 50);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof TodoItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // When actionType changes, initialize or clear parameters
        if (field === 'actionType') {
          if (value === 'SET_MILESTONE') {
            updated.parameters = updated.parameters || {};
            if (!updated.parameters.milestoneName) {
              updated.parameters.milestoneName = '';
            }
          } else if (value === 'CREATE_CHOICE') {
            updated.parameters = updated.parameters || {};
            if (!updated.parameters.choiceName) {
              updated.parameters.choiceName = '';
            }
          } else if (value === null || value === '') {
            updated.parameters = null;
          }
        }

        return updated;
      })
    );
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === items.length - 1) return;

    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !templateId) return;

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const validItems = items.filter((item) => item.label.trim());

    if (validItems.length === 0) {
      setError("At least one task is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        tags: tagsArray.length > 0 ? tagsArray : [],
        todoItems: validItems.map((item, idx) => ({
          id: item.id.startsWith('new-') ? undefined : item.id,
          label: item.label.trim(),
          notes: item.notes.trim() || undefined,
          perPerson: item.perPerson,
          actionType: item.actionType || undefined,
          actionData: item.actionData || undefined,
          parameters: item.parameters || undefined,
          orderIndex: idx,
        })),
      };

      const response = await fetch(`/api/lists/templates/${templateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update TODO list");
      }

      // Redirect to list view page
      router.push(returnTo);
    } catch (err: any) {
      console.error("Error updating TODO list:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setDeleting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/templates/${templateId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete list");
      }

      // Navigate to lists page after deletion
      router.push("/lists");
    } catch (err: any) {
      console.error("Error deleting list:", err);
      setError(err.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 overflow-x-hidden">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-hidden">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push(returnTo)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Edit Checklist
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Basic Info Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  List Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Pre-Trip Planning Tasks"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this checklist"
                  rows={3}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., planning, essentials"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibility === "PUBLIC"}
                    onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    disabled={saving}
                  />
                  <span className="font-medium">Public</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    (Make this list visible to others)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <Button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-xs sm:text-sm px-1 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
              disabled={saving || deleting}
            >
              Delete
            </Button>
            <Button
              type="button"
              onClick={() => router.push(returnTo)}
              className="w-full text-xs sm:text-sm px-1 sm:px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200 flex items-center justify-center"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full text-xs sm:text-sm px-1 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>

          {/* Tasks Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6 overflow-hidden">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Tasks ({items.filter((i) => i.label.trim()).length})
            </h2>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                type="button"
                onClick={addItem}
                className="min-w-[80px] flex-1 text-xs sm:text-sm px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 sm:gap-2"
                disabled={saving}
              >
                <span>+ Add Task</span>
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors overflow-hidden"
                >
                  {/* Item Header - Controls Row */}
                  <div className="flex items-center justify-between mb-3">
                    {/* Left side: Position controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 w-6 text-center">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveItem(item.id, "up")}
                        disabled={index === 0 || saving}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(item.id, "down")}
                        disabled={index === items.length - 1 || saving}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Right side: Delete button */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      disabled={saving}
                      title="Delete task"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Item Input Fields - Full Width */}
                  <div className="space-y-3">
                    {/* Task Name */}
                    <input
                      type="text"
                      ref={index === 0 ? newItemInputRef : undefined}
                      value={item.label}
                      onChange={(e) => updateItem(item.id, "label", e.target.value)}
                      placeholder="Task description *"
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />

                    {/* Notes */}
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                      placeholder="Notes (optional)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />

                    {/* Shared/Per Person Toggle */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex-1 flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, "perPerson", false)}
                          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            !item.perPerson
                              ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          }`}
                          disabled={saving}
                        >
                          Shared
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, "perPerson", true)}
                          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            item.perPerson
                              ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                          }`}
                          disabled={saving}
                        >
                          Per Person
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No tasks yet. Click "+ Add Task" to add one.
                </p>
              )}
            </div>
          </div>
        </form>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
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
                    Delete
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Are you sure you want to delete "{title}"? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
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
    </div>
  );
}

export default function EditListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <EditListPageContent />
    </Suspense>
  );
}
