"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { KitItemToAdd } from "./KitPhotoScanSheet";

interface InventoryList {
  id: string;
  title: string;
  description: string | null;
  kitItems: InventoryItem[];
}

interface InventoryItem {
  id: string;
  label: string;
  notes: string | null;
  quantity: number;
  category: string | null;
  weightGrams: number | null;
  cost: number | null;
  url: string | null;
}

interface AddFromInventorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsSelected: (items: KitItemToAdd[]) => void;
}

export default function AddFromInventorySheet({
  isOpen,
  onClose,
  onItemsSelected,
}: AddFromInventorySheetProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventoryLists, setInventoryLists] = useState<InventoryList[]>([]);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Map<string, InventoryItem>>(new Map());

  useEffect(() => {
    if (isOpen && user) {
      fetchInventoryLists();
    }
  }, [isOpen, user]);

  const fetchInventoryLists = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/lists/templates", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch inventory lists");
      }

      const data = await response.json();
      // Filter to only inventory KIT lists
      const inventoryKits = (data.templates || []).filter(
        (t: any) => t.type === "KIT" && t.inventory
      );
      setInventoryLists(inventoryKits);
    } catch (err: any) {
      console.error("Error fetching inventory lists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleList = (listId: string) => {
    setExpandedListId(expandedListId === listId ? null : listId);
  };

  const toggleItem = (item: InventoryItem) => {
    const newSelected = new Map(selectedItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.set(item.id, item);
    }
    setSelectedItems(newSelected);
  };

  const selectAllFromList = (list: InventoryList) => {
    const newSelected = new Map(selectedItems);
    list.kitItems.forEach((item) => {
      newSelected.set(item.id, item);
    });
    setSelectedItems(newSelected);
  };

  const deselectAllFromList = (list: InventoryList) => {
    const newSelected = new Map(selectedItems);
    list.kitItems.forEach((item) => {
      newSelected.delete(item.id);
    });
    setSelectedItems(newSelected);
  };

  const isAllSelectedFromList = (list: InventoryList) => {
    return list.kitItems.every((item) => selectedItems.has(item.id));
  };

  const getSelectedCountFromList = (list: InventoryList) => {
    return list.kitItems.filter((item) => selectedItems.has(item.id)).length;
  };

  const addSelectedItems = () => {
    const itemsToAdd: KitItemToAdd[] = Array.from(selectedItems.values()).map((item) => ({
      id: crypto.randomUUID(),
      label: item.label,
      notes: item.notes || "",
      quantity: item.quantity,
      category: item.category || "",
      weightGrams: item.weightGrams ? String(item.weightGrams) : "",
      cost: item.cost ? String(item.cost) : "",
      url: item.url || "",
      perPerson: false,
      required: true,
    }));

    onItemsSelected(itemsToAdd);
    handleClose();
  };

  const handleClose = () => {
    setSelectedItems(new Map());
    setExpandedListId(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 md:p-8 flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Add From Inventory
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {selectedItems.size > 0
                  ? `${selectedItems.size} item${selectedItems.size !== 1 ? "s" : ""} selected`
                  : "Select items from your inventory lists"}
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

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : inventoryLists.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-2">
                No inventory lists found
              </p>
              <p className="text-zinc-400 dark:text-zinc-500 text-sm">
                Create an inventory list first to add items from it
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {inventoryLists.map((list) => (
                <div
                  key={list.id}
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
                >
                  {/* List Header */}
                  <button
                    onClick={() => toggleList(list.id)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📦</span>
                      <div className="text-left">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {list.title}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {list.kitItems.length} item{list.kitItems.length !== 1 ? "s" : ""}
                          {getSelectedCountFromList(list) > 0 && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">
                              ({getSelectedCountFromList(list)} selected)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-zinc-400 transition-transform ${
                        expandedListId === list.id ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded Items */}
                  {expandedListId === list.id && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700">
                      {/* Select/Deselect All for this list */}
                      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() =>
                            isAllSelectedFromList(list)
                              ? deselectAllFromList(list)
                              : selectAllFromList(list)
                          }
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          {isAllSelectedFromList(list) ? "Deselect All" : "Select All"}
                        </button>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {getSelectedCountFromList(list)} of {list.kitItems.length}
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-700 max-h-[300px] overflow-y-auto">
                        {list.kitItems.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleItem(item)}
                              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {item.label}
                              </div>
                              {item.notes && (
                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                                  {item.notes}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                                {item.quantity > 1 && <span>Qty: {item.quantity}</span>}
                                {item.category && <span>{item.category}</span>}
                                {item.weightGrams && <span>{item.weightGrams}g</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 md:p-8 border-t border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <div className="flex flex-col-reverse md:flex-row gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addSelectedItems}
              disabled={selectedItems.size === 0}
              className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Add {selectedItems.size} Item{selectedItems.size !== 1 ? "s" : ""} to List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
