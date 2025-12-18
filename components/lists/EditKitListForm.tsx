"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Visibility } from "@/lib/generated/prisma";

interface KitItem {
  id?: string;
  label: string;
  notes: string;
  quantity: number;
  category: string;
  weightGrams: string;
  cost: string;
  url: string;
  perPerson: boolean;
  required: boolean;
  orderIndex: number;
}

interface EditKitListFormProps {
  listId: string;
  onClose: () => void;
  onSaved: () => void;
  isTripList?: boolean; // If true, hide visibility/tags fields
}

export function EditKitListForm({ listId, onClose, onSaved, isTripList = false }: EditKitListFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [tags, setTags] = useState<string>("");
  const [items, setItems] = useState<KitItem[]>([]);

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

        if (template.kitItems && template.kitItems.length > 0) {
          const loadedItems = template.kitItems.map((item: any) => ({
            id: item.id,
            label: item.label,
            notes: item.notes || "",
            quantity: item.quantity,
            category: item.category || "",
            weightGrams: item.weightGrams?.toString() || "",
            cost: item.cost?.toString() || "",
            url: item.url || "",
            perPerson: item.perPerson,
            required: item.required,
            orderIndex: item.orderIndex,
          }));
          setItems(loadedItems);
        } else {
          setItems([createEmptyItem()]);
        }
      } catch (err: any) {
        console.error("Error fetching list:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [user, listId]);

  const createEmptyItem = (): KitItem => ({
    id: crypto.randomUUID(),
    label: "",
    notes: "",
    quantity: 1,
    category: "",
    weightGrams: "",
    cost: "",
    url: "",
    perPerson: false,
    required: true,
    orderIndex: 0,
  });

  const addItem = () => {
    setItems([createEmptyItem(), ...items]);
    setTimeout(() => {
      newItemInputRef.current?.focus();
    }, 50);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof KitItem, value: any) => {
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
        kitItems: validItems.map((item, idx) => ({
          id: item.id?.startsWith("kit-") ? undefined : item.id,
          label: item.label.trim(),
          notes: item.notes.trim() || undefined,
          quantity: item.quantity || 1,
          category: item.category.trim() || undefined,
          weightGrams: item.weightGrams ? parseInt(item.weightGrams) : undefined,
          cost: item.cost ? parseFloat(item.cost) : undefined,
          url: item.url.trim() || undefined,
          perPerson: item.perPerson,
          required: item.required,
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
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
          Edit Kit List
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
            placeholder="e.g., Camping Essentials"
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
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
            placeholder="Brief description of this kit list"
            rows={2}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
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
                placeholder="e.g., camping, hiking"
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="visibility-public-kit"
                checked={visibility === "PUBLIC"}
                onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                className="w-4 h-4 text-green-600 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 rounded focus:ring-green-500"
                disabled={saving}
              />
              <label htmlFor="visibility-public-kit" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Public
              </label>
            </div>
          </>
        )}
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
            Items ({items.filter((i) => i.label.trim()).length})
          </h3>
          <Button
            type="button"
            onClick={addItem}
            className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
            disabled={saving}
          >
            + Add Item
          </Button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-green-300 dark:hover:border-green-600 transition-colors bg-white dark:bg-zinc-800"
            >
              <div className="flex items-start gap-3">
                {/* Move controls */}
                <div className="flex flex-col gap-1 pt-2">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id!, "up")}
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
                    onClick={() => moveItem(item.id!, "down")}
                    disabled={index === items.length - 1 || saving}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Item fields */}
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    ref={index === 0 ? newItemInputRef : undefined}
                    value={item.label}
                    onChange={(e) => updateItem(item.id!, "label", e.target.value)}
                    placeholder="Item name *"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    disabled={saving}
                  />

                  <textarea
                    value={item.notes}
                    onChange={(e) => updateItem(item.id!, "notes", e.target.value)}
                    placeholder="Notes (optional)"
                    rows={1}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    disabled={saving}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id!, "quantity", parseFloat(e.target.value) || 1)}
                      placeholder="Qty"
                      min="0"
                      step="0.1"
                      className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={saving}
                    />
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => updateItem(item.id!, "category", e.target.value)}
                      placeholder="Category"
                      className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={saving}
                    />
                    <input
                      type="number"
                      value={item.weightGrams}
                      onChange={(e) => updateItem(item.id!, "weightGrams", e.target.value)}
                      placeholder="Weight (g)"
                      min="0"
                      className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={saving}
                    />
                    <input
                      type="number"
                      value={item.cost}
                      onChange={(e) => updateItem(item.id!, "cost", e.target.value)}
                      placeholder="Cost"
                      min="0"
                      step="0.01"
                      className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={saving}
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.perPerson}
                        onChange={(e) => updateItem(item.id!, "perPerson", e.target.checked)}
                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                        disabled={saving}
                      />
                      Per person
                    </label>
                    <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) => updateItem(item.id!, "required", e.target.checked)}
                        className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                        disabled={saving}
                      />
                      Required
                    </label>
                  </div>

                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => updateItem(item.id!, "url", e.target.value)}
                    placeholder="URL (optional)"
                    className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    disabled={saving}
                  />
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id!)}
                  className="mt-2 p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  disabled={saving || items.length <= 1}
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
              No items yet. Click "+ Add Item" to add one.
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
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
