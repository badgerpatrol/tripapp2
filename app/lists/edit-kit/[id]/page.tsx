"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Visibility } from "@/lib/generated/prisma";
import KitPhotoScanSheet, { KitItemToAdd } from "@/components/lists/KitPhotoScanSheet";

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
  // Inventory fields
  date: string;
  needsRepair: boolean;
  conditionNotes: string;
  lost: boolean;
  lastSeenText: string;
  lastSeenDate: string;
}

interface ListTemplate {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  tags: string[];
  type: string;
  inventory: boolean;
  kitItems?: Array<{
    id: string;
    label: string;
    notes: string | null;
    quantity: number;
    category: string | null;
    weightGrams: number | null;
    cost: number | null;
    url: string | null;
    perPerson: boolean;
    required: boolean;
    orderIndex: number;
    date: string | null;
    needsRepair: boolean;
    conditionNotes: string | null;
    lost: boolean;
    lastSeenText: string | null;
    lastSeenDate: string | null;
  }>;
}

function EditKitListPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const templateId = params?.id as string;
  const returnTo = searchParams.get("returnTo") || `/lists/${templateId}`;
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [tags, setTags] = useState<string>("");
  const [inventory, setInventory] = useState(false);
  const [items, setItems] = useState<KitItem[]>([]);
  const [isPhotoScanOpen, setIsPhotoScanOpen] = useState(false);

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

        // Populate form
        setTitle(template.title);
        setDescription(template.description || "");
        setVisibility(template.visibility);
        setTags(template.tags.join(", "));
        setInventory(template.inventory || false);

        // Populate items
        if (template.kitItems && template.kitItems.length > 0) {
          setItems(
            template.kitItems.map((item) => ({
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
              date: item.date || "",
              needsRepair: item.needsRepair || false,
              conditionNotes: item.conditionNotes || "",
              lost: item.lost || false,
              lastSeenText: item.lastSeenText || "",
              lastSeenDate: item.lastSeenDate || "",
            }))
          );
        } else {
          setItems([
            {
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
              date: "",
              needsRepair: false,
              conditionNotes: "",
              lost: false,
              lastSeenText: "",
              lastSeenDate: "",
            },
          ]);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching template:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [user, templateId]);

  const addItem = () => {
    setItems([
      ...items,
      {
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
        orderIndex: items.length,
        date: "",
        needsRepair: false,
        conditionNotes: "",
        lost: false,
        lastSeenText: "",
        lastSeenDate: "",
      },
    ]);
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

  const handlePhotoScanComplete = (scannedItems: KitItemToAdd[]) => {
    // Add scanned items to the end of the list with proper order indices and inventory fields
    const startIndex = items.length;
    const newItems = scannedItems.map((item, idx) => ({
      ...item,
      orderIndex: startIndex + idx,
      date: "",
      needsRepair: false,
      conditionNotes: "",
      lost: false,
      lastSeenText: "",
      lastSeenDate: "",
    }));
    setItems([...items, ...newItems]);
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

    if (validItems.length === 0) {
      setError("At least one item is required");
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
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        inventory,
        kitItems: validItems.map((item, idx) => ({
          id: item.id?.startsWith("kit-") ? undefined : item.id, // Keep DB IDs, remove temp IDs
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
          // Include inventory fields only if inventory mode is enabled
          ...(inventory && {
            date: item.date ? new Date(item.date).toISOString() : undefined,
            needsRepair: item.needsRepair,
            conditionNotes: item.conditionNotes.trim() || undefined,
            lost: item.lost,
            lastSeenText: item.lastSeenText.trim() || undefined,
            lastSeenDate: item.lastSeenDate ? new Date(item.lastSeenDate).toISOString() : undefined,
          }),
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
        throw new Error(data.error || "Failed to update kit list");
      }

      // Redirect back to where the user came from
      router.push(returnTo);
    } catch (err: any) {
      console.error("Error updating kit list:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push(returnTo)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Edit Kit List
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-14">
            Update your packing list template
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  List Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Camping Essentials"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this packing list"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., camping, hiking"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibility === "PUBLIC"}
                    onChange={(e) => setVisibility(e.target.checked ? "PUBLIC" : "PRIVATE")}
                    className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                    disabled={saving}
                  />
                  <span className="font-medium">Public</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    (Make this list visible to others)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Items Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Items ({items.filter((i) => i.label.trim()).length})
              </h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setIsPhotoScanOpen(true)}
                  className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  disabled={saving}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  Scan From Photo
                </Button>
                <Button
                  type="button"
                  onClick={addItem}
                  className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
                  disabled={saving}
                >
                  + Add Item
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-300 dark:hover:border-green-600 transition-colors"
                >
                  {/* Item Header */}
                  <div className="flex items-start gap-3">
                    {/* Drag Handle / Number */}
                    <div className="flex flex-col gap-1 pt-2">
                      <button
                        type="button"
                        onClick={() => moveItem(item.id!, "up")}
                        disabled={index === 0 || saving}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveItem(item.id!, "down")}
                        disabled={index === items.length - 1 || saving}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
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
                        value={item.label}
                        onChange={(e) => updateItem(item.id!, "label", e.target.value)}
                        placeholder="Item name *"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        disabled={saving}
                      />

                      {/* Description */}
                      <textarea
                        value={item.notes}
                        onChange={(e) => updateItem(item.id!, "notes", e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        disabled={saving}
                      />

                      {/* Row 1: Quantity and Category */}
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id!, "quantity", parseFloat(e.target.value) || 1)}
                          placeholder="Quantity"
                          min="0"
                          step="0.1"
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={saving}
                        />
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateItem(item.id!, "category", e.target.value)}
                          placeholder="Category (optional)"
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={saving}
                        />
                      </div>

                      {/* Row 2: Weight, Cost, URL */}
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="number"
                          value={item.weightGrams}
                          onChange={(e) => updateItem(item.id!, "weightGrams", e.target.value)}
                          placeholder="Weight (g)"
                          min="0"
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={saving}
                        />
                        <input
                          type="number"
                          value={item.cost}
                          onChange={(e) => updateItem(item.id!, "cost", e.target.value)}
                          placeholder="Cost"
                          min="0"
                          step="0.01"
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={saving}
                        />
                        <input
                          type="text"
                          value={item.url}
                          onChange={(e) => updateItem(item.id!, "url", e.target.value)}
                          placeholder="URL (optional)"
                          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                          disabled={saving}
                        />
                      </div>

                      {/* Checkboxes */}
                      <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.perPerson}
                            onChange={(e) => updateItem(item.id!, "perPerson", e.target.checked)}
                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                            disabled={saving}
                          />
                          Per person
                        </label>
                        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
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

                      {/* Inventory-specific fields - only show when inventory mode is enabled */}
                      {inventory && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Inventory Tracking
                          </h4>

                          {/* Date field */}
                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(item.id!, "date", e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                              disabled={saving}
                            />
                          </div>

                          {/* Needs Repair checkbox */}
                          <div>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.needsRepair}
                                onChange={(e) => updateItem(item.id!, "needsRepair", e.target.checked)}
                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500"
                                disabled={saving}
                              />
                              Needs Repair
                            </label>
                          </div>

                          {/* Condition Notes - only show when needsRepair is checked */}
                          {item.needsRepair && (
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Condition Notes
                              </label>
                              <textarea
                                value={item.conditionNotes}
                                onChange={(e) => updateItem(item.id!, "conditionNotes", e.target.value)}
                                placeholder="Describe the repair needed..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                disabled={saving}
                              />
                            </div>
                          )}

                          {/* Lost checkbox */}
                          <div>
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.lost}
                                onChange={(e) => updateItem(item.id!, "lost", e.target.checked)}
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                                disabled={saving}
                              />
                              Lost
                            </label>
                          </div>

                          {/* Last Seen fields - only show when lost is checked */}
                          {item.lost && (
                            <div className="space-y-3 pl-6 border-l-2 border-red-300 dark:border-red-700">
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Last Seen (Location/Description)
                                </label>
                                <input
                                  type="text"
                                  value={item.lastSeenText}
                                  onChange={(e) => updateItem(item.id!, "lastSeenText", e.target.value)}
                                  placeholder="e.g., Left at campsite near lake"
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                  disabled={saving}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Last Seen Date
                                </label>
                                <input
                                  type="date"
                                  value={item.lastSeenDate}
                                  onChange={(e) => updateItem(item.id!, "lastSeenDate", e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                  disabled={saving}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id!)}
                        className="mt-2 p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        disabled={saving}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              onClick={() => router.push(returnTo)}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200"
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

        {/* Photo Scan Dialog */}
        <KitPhotoScanSheet
          listId={templateId}
          isOpen={isPhotoScanOpen}
          onClose={() => setIsPhotoScanOpen(false)}
          onItemsSelected={handlePhotoScanComplete}
        />
      </div>
    </div>
  );
}

export default function EditKitListPage() {
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
      <EditKitListPageContent />
    </Suspense>
  );
}
