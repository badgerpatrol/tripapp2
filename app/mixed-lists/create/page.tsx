"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Visibility, TodoActionType } from "@/lib/generated/prisma";

interface TodoItem {
  id: string;
  itemType: "TODO";
  label: string;
  notes: string;
  perPerson: boolean;
  actionType: TodoActionType | null;
}

interface KitItem {
  id: string;
  itemType: "KIT";
  label: string;
  notes: string;
  quantity: number;
  perPerson: boolean;
  required: boolean;
  category: string;
}

type ListItem = TodoItem | KitItem;

export default function CreateMixedListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [displayMode, setDisplayMode] = useState<"grouped" | "interleaved">("grouped");
  const [tags, setTags] = useState<string>("");
  const [items, setItems] = useState<ListItem[]>([]);

  // Which type to add next
  const [addItemType, setAddItemType] = useState<"TODO" | "KIT">("TODO");

  const addItem = () => {
    if (addItemType === "TODO") {
      setItems([
        {
          id: crypto.randomUUID(),
          itemType: "TODO",
          label: "",
          notes: "",
          perPerson: false,
          actionType: null,
        },
        ...items,
      ]);
    } else {
      setItems([
        {
          id: crypto.randomUUID(),
          itemType: "KIT",
          label: "",
          notes: "",
          quantity: 1,
          perPerson: false,
          required: true,
          category: "",
        },
        ...items,
      ]);
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
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

    if (!user) return;

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const validItems = items.filter((item) => item.label.trim());

    // Separate into TODO and KIT items
    const todoItems = validItems
      .filter((item): item is TodoItem => item.itemType === "TODO")
      .map((item, idx) => ({
        label: item.label.trim(),
        notes: item.notes.trim() || undefined,
        perPerson: item.perPerson,
        actionType: item.actionType || undefined,
        orderIndex: idx,
      }));

    const kitItems = validItems
      .filter((item): item is KitItem => item.itemType === "KIT")
      .map((item, idx) => ({
        label: item.label.trim(),
        notes: item.notes.trim() || undefined,
        quantity: item.quantity,
        perPerson: item.perPerson,
        required: item.required,
        category: item.category.trim() || undefined,
        orderIndex: idx,
      }));

    if (todoItems.length === 0 && kitItems.length === 0) {
      setError("Add at least one item to the list");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        type: "LIST",
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        displayMode,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        todoItems: todoItems.length > 0 ? todoItems : undefined,
        kitItems: kitItems.length > 0 ? kitItems : undefined,
      };

      const response = await fetch("/api/lists/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create list");
      }

      // Redirect to mixed-lists page
      router.push("/mixed-lists");
    } catch (err: any) {
      console.error("Error creating list:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push("/mixed-lists")}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Create Mixed List
            </h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 ml-14">
            Build a list with both tasks and items
          </p>
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
                  placeholder="e.g., Weekend Trip Prep"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
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
                  placeholder="Brief description of this list"
                  rows={3}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Display Mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="displayMode"
                      value="grouped"
                      checked={displayMode === "grouped"}
                      onChange={() => setDisplayMode("grouped")}
                      className="w-4 h-4 text-blue-600"
                      disabled={loading}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Grouped (tasks then items)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="displayMode"
                      value="interleaved"
                      checked={displayMode === "interleaved"}
                      onChange={() => setDisplayMode("interleaved")}
                      className="w-4 h-4 text-blue-600"
                      disabled={loading}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Interleaved (by order)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., camping, weekend"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="visibility-public"
                  checked={visibility === "PUBLIC"}
                  onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                  className="w-4 h-4 text-blue-600 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 rounded focus:ring-blue-500"
                  disabled={loading}
                />
                <label htmlFor="visibility-public" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Public
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-end pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Button
                type="button"
                onClick={() => router.push("/mixed-lists")}
                className="px-6 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create List"}
              </Button>
            </div>
          </div>

          {/* Items Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Items ({items.filter((i) => i.label.trim()).length})
              </h2>
              <div className="flex items-center gap-2">
                {/* Item type toggle */}
                <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAddItemType("TODO")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      addItemType === "TODO"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddItemType("KIT")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      addItemType === "KIT"
                        ? "bg-green-600 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Item
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={addItem}
                  className={`text-sm px-4 py-2 text-white ${
                    addItemType === "TODO" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                  }`}
                  disabled={loading}
                >
                  + Add {addItemType === "TODO" ? "Task" : "Item"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.length === 0 ? (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No items yet. Add tasks or items to your list.
                </p>
              ) : (
                items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      item.itemType === "TODO"
                        ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
                        : "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-start gap-3">
                      {/* Move buttons and type indicator */}
                      <div className="flex flex-col gap-1 pt-2">
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, "up")}
                          disabled={index === 0 || loading}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <span className={`text-xs font-medium text-center px-1.5 py-0.5 rounded ${
                          item.itemType === "TODO"
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                            : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        }`}>
                          {item.itemType === "TODO" ? "Task" : "Item"}
                        </span>
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, "down")}
                          disabled={index === items.length - 1 || loading}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Item Input */}
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateItem(item.id, "label", e.target.value)}
                          placeholder={item.itemType === "TODO" ? "Task description" : "Item name"}
                          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          disabled={loading}
                        />

                        <textarea
                          value={item.notes}
                          onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                          placeholder="Optional notes"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          disabled={loading}
                        />

                        {/* Type-specific fields */}
                        {item.itemType === "KIT" && (
                          <div className="flex gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-zinc-600 dark:text-zinc-400">Qty:</label>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                                className="w-20 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                disabled={loading}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-zinc-600 dark:text-zinc-400">Category:</label>
                              <input
                                type="text"
                                value={item.category}
                                onChange={(e) => updateItem(item.id, "category", e.target.value)}
                                placeholder="e.g., Clothing"
                                className="w-32 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                disabled={loading}
                              />
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                              <input
                                type="checkbox"
                                checked={item.required}
                                onChange={(e) => updateItem(item.id, "required", e.target.checked)}
                                className="w-3.5 h-3.5"
                                disabled={loading}
                              />
                              Required
                            </label>
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={item.perPerson}
                              onChange={(e) => updateItem(item.id, "perPerson", e.target.checked)}
                              className="w-3.5 h-3.5"
                              disabled={loading}
                            />
                            Per person
                          </label>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                        disabled={loading}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
