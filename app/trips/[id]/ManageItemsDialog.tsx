"use client";

import { useState } from "react";

interface SpendItem {
  id: string;
  name: string;
  description?: string;
  cost: number;
}

interface ManageItemsDialogProps {
  items: SpendItem[];
  currency: string;
  isOpen: boolean;
  onClose: (items: SpendItem[]) => void;
}

export default function ManageItemsDialog({
  items: initialItems,
  currency,
  isOpen,
  onClose,
}: ManageItemsDialogProps) {
  const [items, setItems] = useState<SpendItem[]>(initialItems);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<SpendItem | null>(null);

  // Calculate total
  const itemsTotal = items.reduce((sum, item) => sum + item.cost, 0);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose(items);
  };

  const handleAddItem = (item: Omit<SpendItem, "id">) => {
    setItems([...items, { ...item, id: crypto.randomUUID() }]);
    setShowItemForm(false);
  };

  const handleUpdateItem = (updatedItem: SpendItem) => {
    setItems(items.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Manage Items
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Add individual items to calculate the total spend amount
              </p>
            </div>
            <button
              onClick={handleClose}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Strip */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Total from Items</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {currency} {itemsTotal.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Items</div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {items.length}
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3 mb-6">
            {items.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No items yet</p>
                <p className="text-sm mt-1">Add items to calculate the total amount</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-1">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {currency} {item.cost.toFixed(2)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowItemForm(false);
                        }}
                        className="tap-target p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="tap-target p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Item Form */}
          {(showItemForm || editingItem) && (
            <ItemForm
              item={editingItem || undefined}
              currency={currency}
              onSave={editingItem ? handleUpdateItem : handleAddItem}
              onCancel={() => {
                setShowItemForm(false);
                setEditingItem(null);
              }}
            />
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse md:flex-row gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            {!showItemForm && !editingItem && (
              <button
                type="button"
                onClick={() => setShowItemForm(true)}
                className="tap-target flex-1 px-6 py-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
            >
              Done ({items.length} {items.length === 1 ? "item" : "items"}, {currency} {itemsTotal.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Item Form Component
function ItemForm({
  item,
  currency,
  onSave,
  onCancel,
}: {
  item?: SpendItem;
  currency: string;
  onSave: (item: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [cost, setCost] = useState(item?.cost.toString() || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Item name is required");
      return;
    }

    const costNum = parseFloat(cost);
    if (isNaN(costNum) || costNum <= 0) {
      setError("Cost must be a positive number");
      return;
    }

    if (item) {
      // Update existing item
      onSave({
        ...item,
        name: name.trim(),
        description: description.trim() || undefined,
        cost: costNum,
      });
    } else {
      // Add new item
      onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        cost: costNum,
      });
    }
  };

  return (
    <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        {item ? "Edit Item" : "Add New Item"}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Item Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Coffee, Taxi fare"
            maxLength={80}
            required
            className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details..."
            maxLength={280}
            className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Cost ({currency}) *
          </label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
            className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="tap-target flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="tap-target flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            {item ? "Update" : "Add"} Item
          </button>
        </div>
      </form>
    </div>
  );
}
