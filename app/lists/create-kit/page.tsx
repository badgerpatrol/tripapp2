"use client";

import { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Visibility } from "@/lib/generated/prisma";
import KitPhotoScanSheet, { KitItemToAdd } from "@/components/lists/KitPhotoScanSheet";
import AddFromInventorySheet from "@/components/lists/AddFromInventorySheet";

interface KitItem {
  id: string;
  label: string;
  notes: string;
  quantity: number;
  category: string;
  weightGrams: string;
  cost: string;
  url: string;
  perPerson: boolean;
  required: boolean;
  // Inventory fields
  date: string;
  needsRepair: boolean;
  conditionNotes: string;
  lost: boolean;
  lastSeenText: string;
  lastSeenDate: string;
}

function CreateKitListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoScanOpen, setIsPhotoScanOpen] = useState(false);
  const [isInventorySheetOpen, setIsInventorySheetOpen] = useState(false);

  // Check if inventory mode is set via query parameter
  const inventoryParam = searchParams.get("inventory");
  const inventoryFromUrl = inventoryParam === "true";
  const nonInventoryFromUrl = inventoryParam === "false";
  const hideInventoryCheckbox = inventoryFromUrl || nonInventoryFromUrl;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [tags, setTags] = useState<string>("");
  const [inventory, setInventory] = useState(inventoryFromUrl);
  const [items, setItems] = useState<KitItem[]>([]);
  const newItemInputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    const newId = crypto.randomUUID();
    setItems([
      {
        id: newId,
        label: "",
        notes: "",
        quantity: 1,
        category: "",
        weightGrams: "",
        cost: "",
        url: "",
        perPerson: false,
        required: true,
        date: "",
        needsRepair: false,
        conditionNotes: "",
        lost: false,
        lastSeenText: "",
        lastSeenDate: "",
      },
      ...items,
    ]);
    // Focus the new item's input after render
    setTimeout(() => {
      newItemInputRef.current?.focus();
    }, 0);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
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

  const handlePhotoScanComplete = (scannedItems: KitItemToAdd[]) => {
    // Add scanned items to the top of the list with inventory fields
    const itemsWithInventoryFields = scannedItems.map(item => ({
      ...item,
      date: "",
      needsRepair: false,
      conditionNotes: "",
      lost: false,
      lastSeenText: "",
      lastSeenDate: "",
    }));
    setItems([...itemsWithInventoryFields, ...items]);
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

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const kitItems = validItems.map((item, idx) => {
        const baseItem = {
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
        };

        // Only add inventory fields if inventory mode is enabled
        if (inventory) {
          return {
            ...baseItem,
            date: item.date && item.date.trim() ? new Date(item.date).toISOString() : undefined,
            needsRepair: item.needsRepair || false,
            conditionNotes: item.conditionNotes && item.conditionNotes.trim() ? item.conditionNotes.trim() : undefined,
            lost: item.lost || false,
            lastSeenText: item.lastSeenText && item.lastSeenText.trim() ? item.lastSeenText.trim() : undefined,
            lastSeenDate: item.lastSeenDate && item.lastSeenDate.trim() ? new Date(item.lastSeenDate).toISOString() : undefined,
          };
        }

        return baseItem;
      });

      const payload = {
        type: "KIT",
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        inventory,
        kitItems,
      };

      console.log("Sending payload:", payload);

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
        console.error("API Error:", data);
        throw new Error(data.error || "Failed to create kit list");
      }

      // Redirect to kit page - inventory lists go to Inventory tab
      if (inventory) {
        router.push("/kit?section=inventory");
      } else {
        router.push("/kit");
      }
    } catch (err: any) {
      console.error("Error creating kit list:", err);
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
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
              onClick={() => router.push("/kit")}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              {inventoryFromUrl ? "Create" : "Create"}
            </h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 ml-14">
            {inventoryFromUrl
              ? "Track your gear condition, repairs, and losses"
              : "Build a reusable packing list template for your trips"}
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
                  placeholder="e.g., Camping Essentials"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
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
                  placeholder="Brief description of this packing list"
                  rows={3}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={loading}
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
                  placeholder="e.g., camping, hiking"
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
              </div>

              {!inventory && (
                <div>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibility === "PUBLIC"}
                      onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                      disabled={loading}
                    />
                    <span className="font-medium">Public</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      (Make this list visible to others)
                    </span>
                  </label>
                </div>
              )}

              {!hideInventoryCheckbox && (
                <div>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inventory}
                      onChange={(e) => setInventory(e.target.checked)}
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                      disabled={loading}
                    />
                    <span className="font-medium">Inventory Mode</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      (Track condition, repairs, and loss)
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              onClick={() => router.push("/kit")}
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
              {loading ? "Creating..." : inventoryFromUrl ? "Create" : "Create"}
            </Button>
          </div>

          {/* Items Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Items ({items.filter((i) => i.label.trim()).length})
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => setIsPhotoScanOpen(true)}
                  className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  Scan Photo
                </Button>
                {!inventory && (
                  <Button
                    type="button"
                    onClick={() => setIsInventorySheetOpen(true)}
                    className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    From Inventory
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={addItem}
                  className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={loading}
                >
                  + Add Item
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-green-300 dark:hover:border-green-600 transition-colors"
                >
                  {/* Item Header */}
                  <div className="flex items-start gap-3">
                    {/* Drag Handle / Number */}
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
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-center">
                        {index + 1}
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

                    {/* Item Input Fields */}
                    <div className="flex-1 space-y-3">
                      {/* Item Name */}
                      <input
                        type="text"
                        ref={index === 0 ? newItemInputRef : undefined}
                        value={item.label}
                        onChange={(e) => updateItem(item.id, "label", e.target.value)}
                        placeholder="Item name *"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        disabled={loading}
                      />

                      {/* Description */}
                      <textarea
                        value={item.notes}
                        onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        disabled={loading}
                      />

                      {/* Row 1: Quantity and Category */}
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                          placeholder="Quantity"
                          min="0"
                          step="0.1"
                          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateItem(item.id, "category", e.target.value)}
                          placeholder="Category (optional)"
                          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                      </div>

                      {/* Row 2: Weight, Cost, URL */}
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="number"
                          value={item.weightGrams}
                          onChange={(e) => updateItem(item.id, "weightGrams", e.target.value)}
                          placeholder="Weight (g)"
                          min="0"
                          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                        <input
                          type="number"
                          value={item.cost}
                          onChange={(e) => updateItem(item.id, "cost", e.target.value)}
                          placeholder="Cost"
                          min="0"
                          step="0.01"
                          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                        <input
                          type="text"
                          value={item.url}
                          onChange={(e) => updateItem(item.id, "url", e.target.value)}
                          placeholder="URL (optional)"
                          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                      </div>

                      {/* Toggles - hide for inventory lists */}
                      {!inventory && (
                        <div className="flex gap-3">
                          {/* Mandatory/Optional toggle */}
                          <div className="flex-1 flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "required", true)}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                                item.required
                                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                              }`}
                              disabled={loading}
                            >
                              Mandatory
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "required", false)}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                                !item.required
                                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                              }`}
                              disabled={loading}
                            >
                              Optional
                            </button>
                          </div>

                          {/* Shared/Per Person toggle */}
                          <div className="flex-1 flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "perPerson", false)}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                                !item.perPerson
                                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                              }`}
                              disabled={loading}
                            >
                              Shared
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "perPerson", true)}
                              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                                item.perPerson
                                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                              }`}
                              disabled={loading}
                            >
                              Per Person
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inventory-specific fields - only show when inventory mode is enabled */}
                      {inventory && (
                        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Inventory Tracking
                          </h4>

                          {/* Date field */}
                          <div>
                            <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(item.id, "date", e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                              disabled={loading}
                            />
                          </div>

                          {/* Needs Repair checkbox */}
                          <div>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.needsRepair}
                                onChange={(e) => updateItem(item.id, "needsRepair", e.target.checked)}
                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                                disabled={loading}
                              />
                              Needs Repair
                            </label>
                          </div>

                          {/* Condition Notes - only show when needsRepair is checked */}
                          {item.needsRepair && (
                            <div>
                              <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                Condition Notes
                              </label>
                              <textarea
                                value={item.conditionNotes}
                                onChange={(e) => updateItem(item.id, "conditionNotes", e.target.value)}
                                placeholder="Describe the repair needed..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                disabled={loading}
                              />
                            </div>
                          )}

                          {/* Lost checkbox */}
                          <div>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.lost}
                                onChange={(e) => updateItem(item.id, "lost", e.target.checked)}
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                                disabled={loading}
                              />
                              Lost
                            </label>
                          </div>

                          {/* Last Seen fields - only show when lost is checked */}
                          {item.lost && (
                            <div className="space-y-3 pl-6 border-l-2 border-red-300 dark:border-red-700">
                              <div>
                                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                  Last Seen (Location/Description)
                                </label>
                                <input
                                  type="text"
                                  value={item.lastSeenText}
                                  onChange={(e) => updateItem(item.id, "lastSeenText", e.target.value)}
                                  placeholder="e.g., Left at campsite near lake"
                                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                  disabled={loading}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                  Last Seen Date
                                </label>
                                <input
                                  type="date"
                                  value={item.lastSeenDate}
                                  onChange={(e) => updateItem(item.id, "lastSeenDate", e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                  disabled={loading}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="mt-2 p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      disabled={loading}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Photo Scan Dialog */}
        <KitPhotoScanSheet
          listId="new-kit-list"
          isOpen={isPhotoScanOpen}
          onClose={() => setIsPhotoScanOpen(false)}
          onItemsSelected={handlePhotoScanComplete}
        />

        {/* Add From Inventory Dialog */}
        <AddFromInventorySheet
          isOpen={isInventorySheetOpen}
          onClose={() => setIsInventorySheetOpen(false)}
          onItemsSelected={handlePhotoScanComplete}
        />
      </div>
    </div>
  );
}

export default function CreateKitListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <CreateKitListPageContent />
    </Suspense>
  );
}
