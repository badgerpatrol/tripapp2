"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface CreateTransportRequirementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  onSuccess: () => void;
}

export default function CreateTransportRequirementDialog({
  isOpen,
  onClose,
  tripId,
  onSuccess,
}: CreateTransportRequirementDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fromLocation: "",
    toLocation: "",
    earliestTime: "",
    latestTime: "",
    peopleCount: "1",
    gearDescription: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      const requestBody: any = {
        fromLocation: formData.fromLocation,
        toLocation: formData.toLocation,
        peopleCount: parseInt(formData.peopleCount, 10) || 1,
      };

      if (formData.earliestTime) {
        requestBody.earliestTime = new Date(formData.earliestTime).toISOString();
      }
      if (formData.latestTime) {
        requestBody.latestTime = new Date(formData.latestTime).toISOString();
      }
      if (formData.gearDescription) {
        requestBody.gearDescription = formData.gearDescription;
      }
      if (formData.notes) {
        requestBody.notes = formData.notes;
      }

      const response = await fetch(`/api/trips/${tripId}/transport/requirements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create transport requirement");
      }

      // Reset form
      setFormData({
        fromLocation: "",
        toLocation: "",
        earliestTime: "",
        latestTime: "",
        peopleCount: "1",
        gearDescription: "",
        notes: "",
      });

      onClose();
      onSuccess();
    } catch (err: any) {
      console.error("Error creating transport requirement:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              I Need a Lift
            </h2>
            <button
              onClick={onClose}
              className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors"
            >
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                From *
              </label>
              <input
                type="text"
                required
                value={formData.fromLocation}
                onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Manchester, UK"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                To *
              </label>
              <input
                type="text"
                required
                value={formData.toLocation}
                onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Chamonix, France"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Earliest Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.earliestTime}
                  onChange={(e) => setFormData({ ...formData, earliestTime: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Latest Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.latestTime}
                  onChange={(e) => setFormData({ ...formData, latestTime: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Number of People
              </label>
              <input
                type="number"
                min="1"
                value={formData.peopleCount}
                onChange={(e) => setFormData({ ...formData, peopleCount: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Gear to Transport
              </label>
              <input
                type="text"
                value={formData.gearDescription}
                onChange={(e) => setFormData({ ...formData, gearDescription: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 1 pair of skis, 1 large suitcase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional details..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.fromLocation || !formData.toLocation}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white font-medium transition-colors disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Request Lift"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
