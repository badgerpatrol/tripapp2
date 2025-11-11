"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface ChoiceItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  tags: string[] | null;
  maxPerUser: number | null;
  maxTotal: number | null;
  allergens: string[] | null;
  isActive: boolean;
}

interface SelectionLine {
  id: string;
  itemId: string;
  quantity: number;
  note: string | null;
  item?: ChoiceItem;
}

interface ChoiceDetail {
  choice: {
    id: string;
    name: string;
    description: string | null;
    datetime: string | null;
    place: string | null;
    status: string;
    deadline: string | null;
    createdById: string;
  };
  items: ChoiceItem[];
  mySelections: SelectionLine[];
  myTotal?: number;
}

interface ChoiceDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  choiceId: string | null;
  userId: string;
  canManage: boolean;
  onManage?: () => void;
}

export default function ChoiceDetailDialog({
  isOpen,
  onClose,
  choiceId,
  userId,
  canManage,
  onManage,
}: ChoiceDetailDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChoiceDetail | null>(null);
  const [selections, setSelections] = useState<Record<string, { quantity: number; note: string }>>({});
  const [overallNote, setOverallNote] = useState("");

  useEffect(() => {
    if (isOpen && choiceId) {
      fetchChoiceDetail();
    }
  }, [isOpen, choiceId]);

  const fetchChoiceDetail = async () => {
    if (!user || !choiceId) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch choice details");
      }

      const data: ChoiceDetail = await response.json();
      setDetail(data);

      // Initialize selections from existing user selections
      const initialSelections: Record<string, { quantity: number; note: string }> = {};
      data.mySelections.forEach(line => {
        initialSelections[line.itemId] = {
          quantity: line.quantity,
          note: line.note || "",
        };
      });
      setSelections(initialSelections);

      // Get overall note
      const noteResponse = await fetch(`/api/choices/${choiceId}/my-note`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (noteResponse.ok) {
        const noteData = await noteResponse.json();
        setOverallNote(noteData.note || "");
      }
    } catch (err: any) {
      console.error("Error fetching choice:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      const newSelections = { ...selections };
      delete newSelections[itemId];
      setSelections(newSelections);
    } else {
      setSelections({
        ...selections,
        [itemId]: {
          quantity,
          note: selections[itemId]?.note || "",
        },
      });
    }
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setSelections({
      ...selections,
      [itemId]: {
        quantity: selections[itemId]?.quantity || 1,
        note,
      },
    });
  };

  const handleSubmitSelections = async () => {
    if (!user || !choiceId) return;

    setSaving(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      // Convert selections to API format
      const lines = Object.entries(selections)
        .filter(([_, sel]) => sel.quantity > 0)
        .map(([itemId, sel]) => ({
          itemId,
          quantity: sel.quantity,
          note: sel.note || undefined,
        }));

      if (lines.length === 0) {
        // Delete selections if no items selected
        await fetch(`/api/choices/${choiceId}/selections`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
      } else {
        // Create or update selections
        const response = await fetch(`/api/choices/${choiceId}/selections`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ lines }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to save selections");
        }
      }

      // Save overall note
      if (overallNote.trim()) {
        await fetch(`/api/choices/${choiceId}/my-note`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ note: overallNote }),
        });
      }

      // Refresh data
      await fetchChoiceDetail();

      // Close the dialog after successful save
      onClose();
    } catch (err: any) {
      console.error("Error saving selections:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !detail) return null;

  const isClosed = detail.choice.status === "CLOSED" ||
    (detail.choice.deadline && new Date(detail.choice.deadline) < new Date());

  const calculateTotal = () => {
    return Object.entries(selections).reduce((sum, [itemId, sel]) => {
      const item = detail.items.find(i => i.id === itemId);
      if (item && item.price) {
        return sum + (item.price * sel.quantity);
      }
      return sum;
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {detail.choice.name}
              </h2>
              {detail.choice.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {detail.choice.description}
                </p>
              )}
              {detail.choice.place && (
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                  📍 {detail.choice.place}
                </p>
              )}
              {detail.choice.datetime && (
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                  🕐 {new Date(detail.choice.datetime).toLocaleString()}
                </p>
              )}
              {isClosed && (
                <span className="inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  Closed
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {canManage && onManage && (
                <button
                  onClick={onManage}
                  className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
                  title="Manage choice"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-zinc-500">Loading...</div>
          ) : (
            <>
              {/* Menu Items */}
              <div className="space-y-3 mb-6">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Menu</h3>
                {detail.items.length === 0 ? (
                  <p className="text-sm text-zinc-500">No items available yet</p>
                ) : (
                  detail.items.map(item => (
                    <div key={item.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</span>
                            {item.price && (
                              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                ${Number(item.price).toFixed(2)}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{item.description}</p>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {item.tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {!isClosed && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleQuantityChange(item.id, (selections[item.id]?.quantity || 0) - 1)}
                              className="tap-target w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-300"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-medium text-zinc-900 dark:text-zinc-100">
                              {selections[item.id]?.quantity || 0}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.id, (selections[item.id]?.quantity || 0) + 1)}
                              className="tap-target w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      {selections[item.id] && selections[item.id].quantity > 0 && !isClosed && (
                        <input
                          type="text"
                          placeholder="Add note (e.g., no nuts)"
                          value={selections[item.id].note}
                          onChange={(e) => handleNoteChange(item.id, e.target.value)}
                          className="mt-2 w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Overall Note */}
              {!isClosed && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Dietary Notes / Special Requests
                  </label>
                  <textarea
                    value={overallNote}
                    onChange={(e) => setOverallNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special dietary requirements or notes..."
                  />
                </div>
              )}

              {/* Total */}
              {Object.keys(selections).length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Your Total:</span>
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                {!isClosed && (
                  <button
                    onClick={handleSubmitSelections}
                    disabled={saving}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Selection"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
