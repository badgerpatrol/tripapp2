"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ListType, Visibility } from "@/lib/generated/prisma";

interface CreateTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TodoItem {
  label: string;
  notes: string;
  actionType: string | null;
  actionData: Record<string, any> | null;
  orderIndex: number;
}

interface KitItem {
  label: string;
  notes: string;
  quantity: string;
  perPerson: boolean;
  required: boolean;
  weightGrams: number | null;
  category: string | null;
  cost: number | null;
  url: string | null;
  orderIndex: number;
}

export function CreateTemplateDialog({ isOpen, onClose, onSuccess }: CreateTemplateDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<ListType>("TODO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [tags, setTags] = useState<string>("");

  // Items state
  const [todoItems, setTodoItems] = useState<TodoItem[]>([
    { label: "", notes: "", actionType: null, actionData: null, orderIndex: 0 },
  ]);
  const [kitItems, setKitItems] = useState<KitItem[]>([
    { label: "", notes: "", quantity: "1", perPerson: false, required: true, weightGrams: null, category: null, cost: null, url: null, orderIndex: 0 },
  ]);

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const items = type === "TODO" ? todoItems : kitItems;
    const validItems = items.filter((item) => item.label.trim());

    if (validItems.length === 0) {
      setError("At least one item is required");
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

      const payload: any = {
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      };

      if (type === "TODO") {
        payload.todoItems = validItems.map((item, idx) => ({
          label: item.label.trim(),
          notes: item.notes.trim() || undefined,
          actionType: (item as TodoItem).actionType || undefined,
          actionData: (item as TodoItem).actionData || undefined,
          orderIndex: idx,
        }));
      } else {
        payload.kitItems = validItems.map((item, idx) => ({
          label: item.label.trim(),
          notes: item.notes.trim() || undefined,
          quantity: parseFloat((item as KitItem).quantity) || 1,
          perPerson: (item as KitItem).perPerson || false,
          required: (item as KitItem).required ?? true,
          weightGrams: (item as KitItem).weightGrams || undefined,
          category: (item as KitItem).category?.trim() || undefined,
          cost: (item as KitItem).cost || undefined,
          url: (item as KitItem).url?.trim() || undefined,
          orderIndex: idx,
        }));
      }

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
        throw new Error(data.error || "Failed to create template");
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error creating template:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setType("TODO");
    setTitle("");
    setDescription("");
    setVisibility("PRIVATE");
    setTags("");
    setTodoItems([{ label: "", notes: "", actionType: null, actionData: null, orderIndex: 0 }]);
    setKitItems([{ label: "", notes: "", quantity: "1", perPerson: false, required: true, weightGrams: null, category: null, cost: null, url: null, orderIndex: 0 }]);
    setError(null);
  };

  const addTodoItem = () => {
    setTodoItems([
      ...todoItems,
      { label: "", notes: "", actionType: null, actionData: null, orderIndex: todoItems.length },
    ]);
  };

  const removeTodoItem = (index: number) => {
    if (todoItems.length > 1) {
      setTodoItems(todoItems.filter((_, i) => i !== index));
    }
  };

  const updateTodoItem = (index: number, field: keyof TodoItem, value: any) => {
    const updated = [...todoItems];
    updated[index] = { ...updated[index], [field]: value };
    setTodoItems(updated);
  };

  const addKitItem = () => {
    setKitItems([
      ...kitItems,
      { label: "", notes: "", quantity: "1", perPerson: false, required: true, weightGrams: null, category: null, cost: null, url: null, orderIndex: kitItems.length },
    ]);
  };

  const removeKitItem = (index: number) => {
    if (kitItems.length > 1) {
      setKitItems(kitItems.filter((_, i) => i !== index));
    }
  };

  const updateKitItem = (index: number, field: keyof KitItem, value: any) => {
    const updated = [...kitItems];
    updated[index] = { ...updated[index], [field]: value };
    setKitItems(updated);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Template"
      size="lg"
      footer={
        <>
          <Button onClick={onClose} className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
            {loading ? "Creating..." : "Create Template"}
          </Button>
        </>
      }
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">List Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ListType)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              disabled={loading}
            >
              <option value="TODO">TODO List</option>
              <option value="KIT">Packing List</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Pre-Trip Essentials"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              disabled={loading}
            >
              <option value="PRIVATE">Private (only you)</option>
              <option value="PUBLIC">Public (publish to gallery)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., hiking, camping, winter"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              disabled={loading}
            />
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              {type === "TODO" ? "Tasks" : "Items"} *
            </h3>
            <Button
              onClick={type === "TODO" ? addTodoItem : addKitItem}
              className="text-xs px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
              disabled={loading}
            >
              + Add {type === "TODO" ? "Task" : "Item"}
            </Button>
          </div>

          <div className="space-y-3">
            {type === "TODO" ? (
              <>
                {todoItems.map((item, index) => (
                  <div key={index} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateTodoItem(index, "label", e.target.value)}
                        placeholder="Task label"
                        className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                      {todoItems.length > 1 && (
                        <button
                          onClick={() => removeTodoItem(index)}
                          className="px-2 text-red-600 hover:text-red-700 dark:text-red-400"
                          disabled={loading}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateTodoItem(index, "notes", e.target.value)}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={loading}
                    />
                  </div>
                ))}
              </>
            ) : (
              <>
                {kitItems.map((item, index) => (
                  <div key={index} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateKitItem(index, "label", e.target.value)}
                        placeholder="Item name"
                        className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                      {kitItems.length > 1 && (
                        <button
                          onClick={() => removeKitItem(index)}
                          className="px-2 text-red-600 hover:text-red-700 dark:text-red-400"
                          disabled={loading}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateKitItem(index, "notes", e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      disabled={loading}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateKitItem(index, "quantity", e.target.value)}
                        placeholder="Quantity"
                        min="0"
                        step="0.1"
                        className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                      <input
                        type="text"
                        value={item.category || ""}
                        onChange={(e) => updateKitItem(index, "category", e.target.value)}
                        placeholder="Category (optional)"
                        className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={item.weightGrams || ""}
                        onChange={(e) => updateKitItem(index, "weightGrams", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="Weight (g)"
                        min="0"
                        className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                      <input
                        type="number"
                        value={item.cost || ""}
                        onChange={(e) => updateKitItem(index, "cost", e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Cost ($)"
                        min="0"
                        step="0.01"
                        className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                      <input
                        type="url"
                        value={item.url || ""}
                        onChange={(e) => updateKitItem(index, "url", e.target.value)}
                        placeholder="URL (optional)"
                        className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex gap-3 text-sm">
                      <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={item.perPerson}
                          onChange={(e) => updateKitItem(index, "perPerson", e.target.checked)}
                          className="rounded"
                          disabled={loading}
                        />
                        Per person
                      </label>
                      <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) => updateKitItem(index, "required", e.target.checked)}
                          className="rounded"
                          disabled={loading}
                        />
                        Required
                      </label>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
