"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

interface QuickAddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateTitle: string;
  onItemAdded: () => void;
}

export default function QuickAddItemSheet({
  isOpen,
  onClose,
  templateId,
  templateTitle,
  onItemAdded,
}: QuickAddItemSheetProps) {
  const { user } = useAuth();
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [required, setRequired] = useState(true);
  const [perPerson, setPerPerson] = useState(false);
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
      setQuantity(1);
      setRequired(true);
      setPerPerson(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !label.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/templates/${templateId}/kit-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: label.trim(),
          quantity,
          required,
          perPerson,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add item");
      }

      onItemAdded();
      onClose();
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
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-xl p-6 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Add Item to "{templateTitle}"
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
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

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Item Name *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Sleeping bag"
              className="w-full px-4 py-2 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
              disabled={saving}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
              min="0"
              step="0.1"
              className="w-full px-4 py-2 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
              disabled={saving}
            />
          </div>

          {/* Mandatory/Optional toggle */}
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
            <button
              type="button"
              onClick={() => setRequired(true)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                required
                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              disabled={saving}
            >
              Mandatory
            </button>
            <button
              type="button"
              onClick={() => setRequired(false)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                !required
                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
              disabled={saving}
            >
              Optional
            </button>
          </div>

          {/* Shared/Per Person toggle */}
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
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
              disabled={saving || !label.trim()}
            >
              {saving ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
