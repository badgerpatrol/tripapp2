"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import MenuScanSheet from "./MenuScanSheet";
import MenuUrlSheet from "./MenuUrlSheet";
import MenuPlaywrightSheet from "./MenuPlaywrightSheet";

interface ChoiceItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  maxPerUser: number | null;
  maxTotal: number | null;
  allergens: string[] | null;
  tags: string[] | null;
}

interface ManageChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  choiceId: string | null;
  tripId: string;
  tripCurrency: string;
  onSuccess: () => void;
  initialTab?: "details" | "items";
}

export default function ManageChoiceDialog({
  isOpen,
  onClose,
  choiceId,
  tripId,
  tripCurrency,
  onSuccess,
  initialTab = "details",
}: ManageChoiceDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<any>(null);
  const [items, setItems] = useState<ChoiceItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showMenuScan, setShowMenuScan] = useState(false);
  const [showMenuUrl, setShowMenuUrl] = useState(false);
  const [showMenuPlaywright, setShowMenuPlaywright] = useState(false);
  const [tab, setTab] = useState<"details" | "items">(initialTab);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: "",
    maxPerUser: "",
    maxTotal: "",
    allergens: "",
    tags: "",
  });

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [deadline, setDeadline] = useState("");

  // Track if details or status have been modified
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [statusDirty, setStatusDirty] = useState(false);

  // Track linked spend
  const [hasLinkedSpend, setHasLinkedSpend] = useState(false);
  const [linkedSpendId, setLinkedSpendId] = useState<string | null>(null);

  // New item form
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    maxPerUser: "",
    maxTotal: "",
    allergens: "",
    tags: "",
  });

  useEffect(() => {
    if (isOpen && choiceId) {
      fetchChoice();
      setTab(initialTab);
      setDetailsDirty(false);
      setStatusDirty(false);
    }
  }, [isOpen, choiceId, initialTab]);

  const fetchChoice = async () => {
    if (!user || !choiceId) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();

      // Fetch choice details
      const response = await fetch(`/api/choices/${choiceId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();

      // Fetch linked spend status
      const spendResponse = await fetch(`/api/choices/${choiceId}/linked-spend`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const spendData = await spendResponse.json();

      setChoice(data.choice);
      setItems(data.items);
      setName(data.choice.name);
      setDescription(data.choice.description || "");
      setPlace(data.choice.place || "");
      setStatus(data.choice.status);
      setDeadline(data.choice.deadline ? new Date(data.choice.deadline).toISOString().slice(0, 16) : "");
      setHasLinkedSpend(spendData.hasSpend || false);
      setLinkedSpendId(spendData.spendId || null);
      setDetailsDirty(false);
      setStatusDirty(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDetails = async () => {
    if (!user || !choiceId) return;

    setSaving(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      // Update basic details (name, description, place)
      const detailsResponse = await fetch(`/api/choices/${choiceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name,
          description: description || null,
          place: place || null,
        }),
      });

      if (!detailsResponse.ok) throw new Error("Failed to update choice");

      // Update status/deadline if dirty
      if (statusDirty) {
        const statusResponse = await fetch(`/api/choices/${choiceId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            status,
            deadline: deadline ? new Date(deadline).toISOString() : null,
          }),
        });

        if (!statusResponse.ok) throw new Error("Failed to update deadline");
      }

      setDetailsDirty(false);
      setStatusDirty(false);
      await fetchChoice();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user || !choiceId) return;

    // Prevent toggling if there's a linked spend and trying to open
    if (hasLinkedSpend && status === "CLOSED") {
      setError("Cannot reopen choice: A spend has been auto-generated. Delete the spend first.");
      return;
    }

    setSaving(true);
    setError(null);

    const newStatus = status === "OPEN" ? "CLOSED" : "OPEN";

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          status: newStatus,
          deadline: deadline ? new Date(deadline).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      setStatus(newStatus);
      setStatusDirty(false);
      await fetchChoice();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };


  const handleAddItem = async () => {
    if (!user || !choiceId) return;

    setSaving(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: newItem.name,
          description: newItem.description || undefined,
          price: newItem.price ? parseFloat(newItem.price) : undefined,
          maxPerUser: newItem.maxPerUser ? parseInt(newItem.maxPerUser) : undefined,
          maxTotal: newItem.maxTotal ? parseInt(newItem.maxTotal) : undefined,
          allergens: newItem.allergens ? newItem.allergens.split(",").map(a => a.trim()) : undefined,
          tags: newItem.tags ? newItem.tags.split(",").map(t => t.trim()) : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to add item");

      setNewItem({ name: "", description: "", price: "", maxPerUser: "", maxTotal: "", allergens: "", tags: "" });
      setShowAddItem(false);
      await fetchChoice();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user || !confirm("Deactivate this item?")) return;

    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/choice-items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      await fetchChoice();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selectedItems.size === 0) return;
    if (!confirm(`Deactivate ${selectedItems.size} item(s)?`)) return;

    try {
      const idToken = await user.getIdToken();

      // Delete all selected items
      await Promise.all(
        Array.from(selectedItems).map(itemId =>
          fetch(`/api/choice-items/${itemId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          })
        )
      );

      setSelectedItems(new Set());
      await fetchChoice();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  const handleStartEdit = (item: ChoiceItem) => {
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      description: item.description || "",
      price: item.price !== null ? String(item.price) : "",
      maxPerUser: item.maxPerUser !== null ? String(item.maxPerUser) : "",
      maxTotal: item.maxTotal !== null ? String(item.maxTotal) : "",
      allergens: item.allergens ? item.allergens.join(", ") : "",
      tags: item.tags ? item.tags.join(", ") : "",
    });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditForm({
      name: "",
      description: "",
      price: "",
      maxPerUser: "",
      maxTotal: "",
      allergens: "",
      tags: "",
    });
  };

  const handleUpdateItem = async () => {
    if (!user || !editingItem) return;

    setSaving(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choice-items/${editingItem}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || undefined,
          price: editForm.price ? parseFloat(editForm.price) : undefined,
          maxPerUser: editForm.maxPerUser ? parseInt(editForm.maxPerUser) : undefined,
          maxTotal: editForm.maxTotal ? parseInt(editForm.maxTotal) : undefined,
          allergens: editForm.allergens ? editForm.allergens.split(",").map(a => a.trim()) : undefined,
          tags: editForm.tags ? editForm.tags.split(",").map(t => t.trim()) : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to update item");

      handleCancelEdit();
      await fetchChoice();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !choiceId || !confirm("Delete this choice? This will permanently delete all menu items and selections. This action cannot be undone.")) return;

    try {
      const idToken = await user.getIdToken();
      await fetch(`/api/choices/${choiceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDoneWithSave = async () => {
    if (!user || !choiceId) return;

    setSaving(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      // Save details if dirty
      if (detailsDirty) {
        const detailsResponse = await fetch(`/api/choices/${choiceId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name,
            description: description || null,
            place: place || null,
          }),
        });

        if (!detailsResponse.ok) throw new Error("Failed to update choice details");
        setDetailsDirty(false);
      }

      // Save status if dirty
      if (statusDirty) {
        const statusResponse = await fetch(`/api/choices/${choiceId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            status,
            deadline: deadline ? new Date(deadline).toISOString() : null,
          }),
        });

        if (!statusResponse.ok) throw new Error("Failed to update status");
        setStatusDirty(false);
      }

      if (detailsDirty || statusDirty) {
        await fetchChoice();
        onSuccess();
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !choice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Manage Choice</h2>
            <button onClick={onClose} className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setTab("details")}
              className={`px-4 py-2 font-medium transition-colors ${
                tab === "details"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setTab("items")}
              className={`px-4 py-2 font-medium transition-colors ${
                tab === "items"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Menu Items ({items.length})
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              {/* Details Tab */}
              {tab === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setDetailsDirty(true);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setDetailsDirty(true);
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Place</label>
                    <input
                      type="text"
                      value={place}
                      onChange={(e) => {
                        setPlace(e.target.value);
                        setDetailsDirty(true);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">Choice Status</label>
                    <button
                      onClick={handleToggleStatus}
                      disabled={saving || (hasLinkedSpend && status === "CLOSED")}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                        hasLinkedSpend && status === "CLOSED"
                          ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                          : status === "OPEN"
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-zinc-500 hover:bg-zinc-600 text-white"
                      } ${saving ? "opacity-50 cursor-wait" : ""}`}
                    >
                      {saving ? (
                        "Updating..."
                      ) : hasLinkedSpend && status === "CLOSED" ? (
                        "Delete spend to reopen choice"
                      ) : status === "OPEN" ? (
                        "Open - Click to Close"
                      ) : (
                        "Closed - Click to Reopen"
                      )}
                    </button>
                    {hasLinkedSpend && status === "CLOSED" && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                        A spend has been auto-generated from this choice. Delete the spend to reopen.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Deadline (optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => {
                          setDeadline(e.target.value);
                          setStatusDirty(true);
                        }}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                      />
                      {deadline && (
                        <button
                          onClick={() => {
                            setDeadline("");
                            setStatusDirty(true);
                          }}
                          className="px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                          title="Remove deadline"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleUpdateDetails}
                      disabled={saving || !name}
                      className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white font-medium"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 rounded-lg border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Items Tab */}
              {tab === "items" && (
                <div className="space-y-4">
                  {/* Select All Checkbox and Bulk Delete */}
                  {items.length > 0 && (
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={items.length > 0 && selectedItems.size === items.length}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          Select All ({selectedItems.size} selected)
                        </span>
                      </label>
                      {selectedItems.size > 0 && (
                        <button
                          onClick={handleBulkDelete}
                          className="px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                        >
                          Delete Selected ({selectedItems.size})
                        </button>
                      )}
                    </div>
                  )}

                  {items.map(item => (
                    <div key={item.id}>
                      {editingItem === item.id ? (
                        // Edit Mode
                        <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3 bg-blue-50 dark:bg-blue-900/10">
                          <input
                            type="text"
                            placeholder="Item name *"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                          />
                          <input
                            type="text"
                            placeholder="Description"
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                          />
                          <input
                            type="number"
                            placeholder="Price"
                            value={editForm.price}
                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              placeholder="Max per user"
                              value={editForm.maxPerUser}
                              onChange={(e) => setEditForm({ ...editForm, maxPerUser: e.target.value })}
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                            />
                            <input
                              type="number"
                              placeholder="Max total"
                              value={editForm.maxTotal}
                              onChange={(e) => setEditForm({ ...editForm, maxTotal: e.target.value })}
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Allergens (comma separated)"
                            value={editForm.allergens}
                            onChange={(e) => setEditForm({ ...editForm, allergens: e.target.value })}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                          />
                          <input
                            type="text"
                            placeholder="Tags (comma separated)"
                            value={editForm.tags}
                            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleUpdateItem}
                              disabled={!editForm.name || saving}
                              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white rounded-lg font-medium"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => handleToggleSelectItem(item.id)}
                            className="w-4 h-4 mt-1 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            {item.price && <div className="text-sm text-zinc-600 dark:text-zinc-400">${Number(item.price).toFixed(2)}</div>}
                            {item.description && <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{item.description}</div>}
                            {item.maxPerUser && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Max per user: {item.maxPerUser}</div>}
                            {item.maxTotal && <div className="text-xs text-zinc-500 dark:text-zinc-400">Max total: {item.maxTotal}</div>}
                            {item.allergens && item.allergens.length > 0 && (
                              <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                Allergens: {item.allergens.join(", ")}
                              </div>
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {item.tags.map((tag, idx) => (
                                  <span key={idx} className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {showAddItem ? (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Item name *"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddItem(false)}
                          className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddItem}
                          disabled={!newItem.name || saving}
                          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white rounded-lg"
                        >
                          Add Item
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowAddItem(true)}
                        className="w-full px-4 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
                      >
                        + Add Menu Item
                      </button>
                      <button
                        onClick={() => setShowMenuScan(true)}
                        className="w-full px-4 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Scan Menu
                      </button>
                      <button
                        onClick={() => setShowMenuUrl(true)}
                        className="w-full px-4 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        Read from URL
                      </button>
                      <button
                        onClick={() => setShowMenuPlaywright(true)}
                        className="w-full px-4 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-600 dark:text-zinc-400 hover:border-purple-500 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Read from URL (JS)
                      </button>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      onClick={handleDoneWithSave}
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white font-medium"
                    >
                      {saving ? "Saving..." : "Done"}
                    </button>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {/* Menu Scan Sheet */}
      {choiceId && (
        <MenuScanSheet
          tripId={tripId}
          choiceId={choiceId}
          tripCurrency={tripCurrency}
          isOpen={showMenuScan}
          onClose={() => setShowMenuScan(false)}
          onItemsAdded={() => {
            setShowMenuScan(false);
            fetchChoice(); // Reload items after scanning
          }}
        />
      )}

      {/* Menu URL Sheet */}
      {choiceId && (
        <MenuUrlSheet
          tripId={tripId}
          choiceId={choiceId}
          tripCurrency={tripCurrency}
          isOpen={showMenuUrl}
          onClose={() => setShowMenuUrl(false)}
          onItemsAdded={() => {
            setShowMenuUrl(false);
            fetchChoice(); // Reload items after URL parsing
          }}
        />
      )}

      {/* Menu Playwright Sheet (for JS-heavy sites) */}
      {choiceId && (
        <MenuPlaywrightSheet
          tripId={tripId}
          choiceId={choiceId}
          tripCurrency={tripCurrency}
          isOpen={showMenuPlaywright}
          onClose={() => setShowMenuPlaywright(false)}
          onItemsAdded={() => {
            setShowMenuPlaywright(false);
            fetchChoice(); // Reload items after Playwright parsing
          }}
        />
      )}
    </div>
  );
}
