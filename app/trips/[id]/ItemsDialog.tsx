"use client";

import { useState, useEffect } from "react";
import { SpendStatus, SpendItemSource } from "@/lib/generated/prisma";
import { useAuth } from "@/lib/auth/AuthContext";

interface SpendItem {
  id: string;
  spendId: string;
  name: string;
  description: string | null;
  cost: number;
  assignedUserId: string | null;
  assignedUser: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
  source: SpendItemSource;
  photoId: string | null;
  createdById: string;
  createdBy: {
    id: string;
    email: string;
    displayName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface ItemsSummary {
  items: SpendItem[];
  total: number;
  spendTotal: number;
  difference: number;
  percentAssigned: number;
}

interface ItemsDialogProps {
  spend: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    status: SpendStatus;
    receiptImageData?: string | null;
    paidBy: {
      id: string;
      email: string;
      displayName: string | null;
    };
  } | null;
  trip: {
    id: string;
    baseCurrency: string;
    spendStatus?: SpendStatus;
  };
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshTrip?: () => void;
  canUserEdit?: boolean;
}

export default function ItemsDialog({
  spend,
  trip,
  currentUserId,
  isOpen,
  onClose,
  onRefreshTrip,
  canUserEdit = false,
}: ItemsDialogProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<SpendItem[]>([]);
  const [summary, setSummary] = useState<ItemsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SpendItem | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Check if user can edit
  const isTripSpendingClosed = (trip.spendStatus || SpendStatus.OPEN) === SpendStatus.CLOSED;
  const isSpendClosed = spend?.status === SpendStatus.CLOSED;
  const canEdit = canUserEdit && !isSpendClosed && !isTripSpendingClosed;

  // Fetch items when dialog opens
  useEffect(() => {
    if (isOpen && spend && user) {
      fetchItems();
    }
  }, [isOpen, spend?.id, user]);

  const fetchItems = async () => {
    if (!spend || !user) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spend.id}/items`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load items");
      }

      const data = await response.json();
      setItems(data.items || []);
      setSummary(data);
    } catch (err) {
      console.error("Error fetching items:", err);
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setShowItemForm(true);
  };

  const handleEditItem = (item: SpendItem) => {
    setEditingItem(item);
    setShowItemForm(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!spend || !user) return;

    const confirmed = window.confirm("Delete this item? This cannot be undone.");
    if (!confirmed) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/spends/${spend.id}/items/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete item");
      }

      // Refresh items list
      await fetchItems();
      // Refresh parent trip data to update assignments
      if (onRefreshTrip) {
        onRefreshTrip();
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      alert(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleItemSaved = () => {
    setShowItemForm(false);
    setEditingItem(null);
    fetchItems();
    // Refresh parent trip data to update assignments
    if (onRefreshTrip) {
      onRefreshTrip();
    }
  };

  if (!isOpen || !spend) return null;

  // Show photo viewer if open
  if (viewingPhotoUrl) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <div className="relative max-w-4xl w-full max-h-[90vh]">
          <button
            onClick={() => setViewingPhotoUrl(null)}
            className="absolute top-4 right-4 tap-target p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={viewingPhotoUrl}
            alt="Receipt"
            className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      </div>
    );
  }

  // Show item form if open
  if (showItemForm) {
    return (
      <ItemForm
        spend={spend}
        trip={trip}
        item={editingItem}
        isOpen={showItemForm}
        onClose={() => {
          setShowItemForm(false);
          setEditingItem(null);
        }}
        onSaved={handleItemSaved}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Items
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate mt-1">
                {spend.description}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="tap-target ml-4 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Strip */}
          {summary && (
            <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Items total:
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {spend.currency} {summary.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Spend total:
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {spend.currency} {summary.spendTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-800">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Difference:
                  </span>
                  <span className={`text-sm font-bold ${
                    Math.abs(summary.difference) < 0.01
                      ? "text-green-600 dark:text-green-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {spend.currency} {summary.difference.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Assigned:
                  </span>
                  <span className={`text-sm font-semibold ${
                    Math.abs(summary.percentAssigned - 100) < 0.1
                      ? "text-green-600 dark:text-green-400"
                      : summary.percentAssigned > 100
                      ? "text-red-600 dark:text-red-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {summary.percentAssigned.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warning if difference != 0 */}
          {summary && Math.abs(summary.difference) >= 0.01 && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Note:</strong> Items total doesn't match spend total. Add or adjust items before finalizing.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-8 text-center">
              <p className="text-zinc-600 dark:text-zinc-400">Loading items...</p>
            </div>
          )}

          {/* Items List */}
          {!loading && items.length === 0 && (
            <div className="py-8 text-center">
              <svg
                className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                No items yet
              </p>
              {canEdit && (
                <button
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add First Item
                </button>
              )}
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="space-y-3 mb-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative p-4 rounded-lg border bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </h4>
                        {item.assignedUser && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {item.assignedUser.displayName || item.assignedUser.email}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">
                          {item.description}
                        </p>
                      )}
                      {item.source === "PHOTO" && spend.receiptImageData && (
                        <button
                          onClick={() => setViewingPhotoUrl(spend.receiptImageData || null)}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          View receipt photo
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                          {spend.currency} {item.cost.toFixed(2)}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Edit item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                            title="Delete item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-700">
            {canEdit && items.length > 0 && (
              <button
                onClick={handleAddItem}
                className="tap-target w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            )}

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Item Form Component (inline for now)
interface ItemFormProps {
  spend: {
    id: string;
    currency: string;
  };
  trip: {
    id: string;
  };
  item: SpendItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function ItemForm({ spend, item, isOpen, onClose, onSaved }: ItemFormProps) {
  const { user } = useAuth();
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [cost, setCost] = useState(item?.cost?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || "");
      setCost(item.cost.toString());
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSaving(true);

    try {
      const idToken = await user.getIdToken();
      const costNumber = parseFloat(cost);

      if (isNaN(costNumber) || costNumber < 0) {
        throw new Error("Cost must be a non-negative number");
      }

      const url = item
        ? `/api/spends/${spend.id}/items/${item.id}`
        : `/api/spends/${spend.id}/items`;

      const method = item ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          cost: costNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${item ? "update" : "create"} item`);
      }

      onSaved();
    } catch (err) {
      console.error(`Error ${item ? "updating" : "creating"} item:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${item ? "update" : "create"} item`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-lg w-full"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {item ? "Edit Item" : "Add Item"}
            </h2>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Item Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                placeholder="e.g., Beer, Pizza slice"
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {name.length}/80 characters
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Additional details..."
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {description.length}/280 characters
              </p>
            </div>

            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Cost ({spend.currency}) *
              </label>
              <input
                id="cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 tap-target px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !cost}
              className="flex-1 tap-target px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {saving ? "Saving..." : item ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
