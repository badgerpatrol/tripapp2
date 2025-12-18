"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
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

interface EditTodoListFormProps {
  listId: string;
  onClose: () => void;
  onSaved: () => void;
  isTripList?: boolean; // If true, hide visibility/tags fields
}

export function EditTodoListForm({ listId, onClose, onSaved, isTripList = false }: EditTodoListFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [tags, setTags] = useState<string>("");
  const [items, setItems] = useState<TodoItem[]>([]);

  useEffect(() => {
    if (!user || !listId) return;

    const fetchTemplate = async () => {
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
        const template = data.template;

        setTitle(template.title);
        setDescription(template.description || "");
        setVisibility(template.visibility);
        setTags((template.tags || []).join(", "));

        const sortedItems = (template.todoItems || [])
          .sort((a: TodoItem, b: TodoItem) => a.orderIndex - b.orderIndex)
          .map((item: TodoItem) => ({
            ...item,
            notes: item.notes || "",
          }));
        setItems(sortedItems);
      } catch (err: any) {
        console.error("Error fetching list:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [user, listId]);

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
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof TodoItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

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

  const updateParameter = (itemId: string, paramName: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          parameters: {
            ...(item.parameters || {}),
            [paramName]: value
          }
        };
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

    if (!user || !listId) return;

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const validItems = items.filter((item) => item.label.trim());

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

      const response = await fetch(`/api/lists/templates/${listId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update list");
      }

      onSaved();
    } catch (err: any) {
      console.error("Error updating list:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading list...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Edit Checklist
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Basic Info */}
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
            rows={2}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          />
        </div>

        {!isTripList && (
          <>
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

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="visibility-public"
                checked={visibility === "PUBLIC"}
                onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 rounded focus:ring-blue-500"
                disabled={saving}
              />
              <label htmlFor="visibility-public" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Public
              </label>
            </div>
          </>
        )}
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
            Tasks ({items.filter((i) => i.label.trim()).length})
          </h3>
          <Button
            type="button"
            onClick={addItem}
            className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={saving}
          >
            + Add Task
          </Button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-zinc-800"
            >
              <div className="flex items-start gap-3">
                {/* Move controls */}
                <div className="flex flex-col gap-1 pt-2">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, "up")}
                    disabled={index === 0 || saving}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-center">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, "down")}
                    disabled={index === items.length - 1 || saving}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Task fields */}
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateItem(item.id, "label", e.target.value)}
                    placeholder="Task description"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  />

                  <textarea
                    value={item.notes}
                    onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                    placeholder="Optional notes"
                    rows={1}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  />

                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.perPerson}
                        onChange={(e) => updateItem(item.id, "perPerson", e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        disabled={saving}
                      />
                      Per person
                    </label>

                    <select
                      value={item.actionType || ""}
                      onChange={(e) => updateItem(item.id, "actionType", e.target.value || null)}
                      className="px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={saving}
                    >
                      <option value="">No action</option>
                      <option value="CREATE_CHOICE">Create Choice</option>
                      <option value="SET_MILESTONE">Set Milestone</option>
                      <option value="INVITE_USERS">Invite Users</option>
                    </select>
                  </div>

                  {item.actionType === "SET_MILESTONE" && (
                    <input
                      type="text"
                      value={item.parameters?.milestoneName || ""}
                      onChange={(e) => updateParameter(item.id, "milestoneName", e.target.value)}
                      placeholder="Milestone name"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                  )}

                  {item.actionType === "CREATE_CHOICE" && (
                    <input
                      type="text"
                      value={item.parameters?.choiceName || ""}
                      onChange={(e) => updateParameter(item.id, "choiceName", e.target.value)}
                      placeholder="Choice name"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="mt-2 p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  disabled={saving}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
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

      {/* Actions */}
      <div className="flex gap-4 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <Button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
