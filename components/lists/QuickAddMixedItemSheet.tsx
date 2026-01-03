"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

type ItemType = "TODO" | "KIT";

interface QuickAddMixedItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateTitle: string;
  onItemAdded: () => void;
}

export default function QuickAddMixedItemSheet({
  isOpen,
  onClose,
  templateId,
  templateTitle,
  onItemAdded,
}: QuickAddMixedItemSheetProps) {
  const { user } = useAuth();
  const [itemType, setItemType] = useState<ItemType>("TODO");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [perPerson, setPerPerson] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset form when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setLabel("");
      setNotes("");
      setPerPerson(false);
      setQuantity(1);
      setError(null);
      // Keep item type selection for convenience
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !label.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const token = await user.getIdToken();

      if (itemType === "TODO") {
        const response = await fetch(`/api/lists/templates/${templateId}/todo-items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            label: label.trim(),
            notes: notes.trim() || undefined,
            perPerson,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to add task");
        }
      } else {
        const response = await fetch(`/api/lists/templates/${templateId}/kit-items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            label: label.trim(),
            notes: notes.trim() || undefined,
            perPerson,
            quantity,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to add item");
        }
      }

      onItemAdded();
      // Reset form for next item instead of closing
      setLabel("");
      setNotes("");
      setPerPerson(false);
      setQuantity(1);
      setError(null);
      // Refocus the input for the next item
      inputRef.current?.focus();
    } catch (err: any) {
      console.error("Error adding item:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md mx-4 sm:mx-auto bg-white dark:bg-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-6 animate-in slide-in-from-bottom duration-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate min-w-0">
            Add to "{templateTitle}"
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Item Type Toggle */}
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
            <button
              type="button"
              onClick={() => setItemType("TODO")}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                itemType === "TODO"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              disabled={saving}
            >
              Task
            </button>
            <button
              type="button"
              onClick={() => setItemType("KIT")}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                itemType === "KIT"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              disabled={saving}
            >
              Item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {itemType === "TODO" ? "Task Name" : "Item Name"} *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={itemType === "TODO" ? "e.g., Book flights" : "e.g., Sunscreen"}
              className="w-full px-4 py-2 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              disabled={saving}
              required
            />
          </div>

          {/* Quantity field - only for KIT items */}
          {itemType === "KIT" && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
            <button
              type="button"
              onClick={() => setPerPerson(false)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                !perPerson
                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              disabled={saving}
            >
              Shared
            </button>
            <button
              type="button"
              onClick={() => setPerPerson(true)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                perPerson
                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              disabled={saving}
            >
              Per Person
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={`flex-1 px-4 py-2 text-white ${
                itemType === "TODO"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
              disabled={saving || !label.trim()}
            >
              {saving ? "Adding..." : `Add ${itemType === "TODO" ? "Task" : "Item"}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
