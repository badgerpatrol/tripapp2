"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

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
  onSuccess: () => void;
  initialTab?: "details" | "items" | "status";
}

export default function ManageChoiceDialog({
  isOpen,
  onClose,
  choiceId,
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
  const [tab, setTab] = useState<"details" | "items" | "status">(initialTab);

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
      const response = await fetch(`/api/choices/${choiceId}`, {
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

      if (!response.ok) throw new Error("Failed to update choice");

      setDetailsDirty(false);
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

  const handleUpdateDeadline = async () => {
    if (!user || !choiceId) return;

    setSaving(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/status`, {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update deadline");
      }

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
            <button
              onClick={() => setTab("status")}
              className={`px-4 py-2 font-medium transition-colors ${
                tab === "status"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Status & Deadline
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
                  {items.map(item => (
                    <div key={item.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 flex items-start justify-between">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        {item.price && <div className="text-sm text-zinc-600">${Number(item.price).toFixed(2)}</div>}
                        {item.description && <div className="text-sm text-zinc-500 mt-1">{item.description}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Deactivate"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="w-full px-4 py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
                    >
                      + Add Menu Item
                    </button>
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

              {/* Status Tab */}
              {tab === "status" && (
                <div className="space-y-4">
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
                        "Spend Ready"
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
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => {
                        setDeadline(e.target.value);
                        setStatusDirty(true);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700"
                    />
                    {statusDirty && (
                      <button
                        onClick={handleUpdateDeadline}
                        disabled={saving}
                        className="w-full mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white font-medium"
                      >
                        {saving ? "Saving..." : "Update Deadline"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
