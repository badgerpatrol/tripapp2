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
  isInventory?: boolean;
  initialLabel?: string;
}

export default function QuickAddItemSheet({
  isOpen,
  onClose,
  templateId,
  templateTitle,
  onItemAdded,
  isInventory = false,
  initialLabel = "",
}: QuickAddItemSheetProps) {
  const { user } = useAuth();
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [required, setRequired] = useState(true);
  const [perPerson, setPerPerson] = useState(false);
  // Shared fields (used by both kit and inventory)
  const [category, setCategory] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [cost, setCost] = useState("");
  const [url, setUrl] = useState("");
  const [date, setDate] = useState("");
  const [needsRepair, setNeedsRepair] = useState(false);
  const [conditionNotes, setConditionNotes] = useState("");
  const [lost, setLost] = useState(false);
  const [lastSeenText, setLastSeenText] = useState("");
  const [lastSeenDate, setLastSeenDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and set initial label when sheet opens
  useEffect(() => {
    if (isOpen) {
      if (initialLabel) {
        setLabel(initialLabel);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialLabel]);

  // Reset form when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setLabel("");
      setNotes("");
      setQuantity("1");
      setRequired(true);
      setPerPerson(false);
      setCategory("");
      setWeightGrams("");
      setCost("");
      setUrl("");
      setDate("");
      setNeedsRepair(false);
      setConditionNotes("");
      setLost(false);
      setLastSeenText("");
      setLastSeenDate("");
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

      // Build the payload based on whether this is an inventory list
      const payload: Record<string, unknown> = {
        label: label.trim(),
        quantity: parseFloat(quantity) || 1,
      };

      if (isInventory) {
        // Inventory-specific fields
        if (category.trim()) payload.category = category.trim();
        if (weightGrams) payload.weightGrams = parseInt(weightGrams);
        if (cost) payload.cost = parseFloat(cost);
        if (url.trim()) payload.url = url.trim();
        if (date) payload.date = new Date(date).toISOString();
        payload.needsRepair = needsRepair;
        if (needsRepair && conditionNotes.trim()) payload.conditionNotes = conditionNotes.trim();
        payload.lost = lost;
        if (lost) {
          if (lastSeenText.trim()) payload.lastSeenText = lastSeenText.trim();
          if (lastSeenDate) payload.lastSeenDate = new Date(lastSeenDate).toISOString();
        }
      } else {
        // Kit list fields
        payload.required = required;
        payload.perPerson = perPerson;
        if (notes.trim()) payload.notes = notes.trim();
        if (category.trim()) payload.category = category.trim();
        if (weightGrams) payload.weightGrams = parseInt(weightGrams);
        if (cost) payload.cost = parseFloat(cost);
        if (url.trim()) payload.url = url.trim();
      }

      const response = await fetch(`/api/lists/templates/${templateId}/kit-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add item");
      }

      onItemAdded();
      // Reset form for next item instead of closing
      setLabel("");
      setNotes("");
      setQuantity("1");
      setRequired(true);
      setPerPerson(false);
      setCategory("");
      setWeightGrams("");
      setCost("");
      setUrl("");
      setDate("");
      setNeedsRepair(false);
      setConditionNotes("");
      setLost(false);
      setLastSeenText("");
      setLastSeenDate("");
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
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sheet - full width on mobile for inventory */}
      <div className={`relative mt-auto w-full bg-white dark:bg-zinc-800 rounded-t-2xl shadow-xl flex flex-col max-h-[85vh] ${isInventory ? "" : "sm:max-w-md sm:mx-auto sm:rounded-2xl sm:my-auto"}`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate min-w-0">
            Add Item to "{templateTitle}"
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

        {/* Scrollable form content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
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
              className="w-full px-3 py-2 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
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
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              step="0.1"
              className="w-full px-3 py-2 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
              disabled={saving}
            />
          </div>

          {/* Kit list fields - hide for inventory */}
          {!isInventory && (
            <>
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              {/* Weight and Cost - 2 column grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Weight (g)
                  </label>
                  <input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Cost
                  </label>
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
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
            </>
          )}

          {/* Inventory-specific fields */}
          {isInventory && (
            <>
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Shelter"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              {/* Weight and Cost - 2 column grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Weight (g)
                  </label>
                  <input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Cost
                  </label>
                  <input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Date Acquired - full width */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Date Acquired
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-w-0 appearance-none box-border px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full min-w-0 box-border px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              {/* Needs Repair section */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsRepair}
                    onChange={(e) => setNeedsRepair(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                    disabled={saving}
                  />
                  Needs Repair
                </label>
                {needsRepair && (
                  <div className="pl-6">
                    <textarea
                      value={conditionNotes}
                      onChange={(e) => setConditionNotes(e.target.value)}
                      placeholder="Describe the repair needed..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Lost section */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lost}
                    onChange={(e) => setLost(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                    disabled={saving}
                  />
                  Lost
                </label>
                {lost && (
                  <div className="pl-6 space-y-2">
                    <input
                      type="text"
                      value={lastSeenText}
                      onChange={(e) => setLastSeenText(e.target.value)}
                      placeholder="Last seen location..."
                      className="w-full min-w-0 box-border px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      disabled={saving}
                    />
                    <input
                      type="date"
                      value={lastSeenDate}
                      onChange={(e) => setLastSeenDate(e.target.value)}
                      className="w-full min-w-0 appearance-none box-border px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      disabled={saving}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Fixed footer buttons */}
        <div className="flex gap-3 p-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-200"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
            disabled={saving || !label.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
