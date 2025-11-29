"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";

interface EditTripDialogProps {
  trip: {
    id: string;
    name: string;
    description: string | null;
    baseCurrency: string;
    startDate: string | null;
    endDate: string | null;
    signUpMode?: boolean;
    signUpPassword?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTripDialog({
  trip,
  isOpen,
  onClose,
  onSuccess,
}: EditTripDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: trip.name,
    description: trip.description || "",
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate ? trip.startDate.split("T")[0] : "",
    endDate: trip.endDate ? trip.endDate.split("T")[0] : "",
    signUpMode: trip.signUpMode || false,
    signUpPassword: trip.signUpPassword || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to edit a trip");
      }

      // Validate dates
      if (formData.startDate && formData.endDate) {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        if (end < start) {
          throw new Error("End date must be after start date");
        }
      }

      const idToken = await user.getIdToken();

      // Prepare the payload
      const payload: any = {
        name: formData.name,
        description: formData.description || null,
        baseCurrency: formData.baseCurrency,
        signUpMode: formData.signUpMode,
      };

      // Only include dates if they are set
      if (formData.startDate) {
        payload.startDate = new Date(formData.startDate).toISOString();
      } else {
        payload.startDate = null;
      }

      if (formData.endDate) {
        payload.endDate = new Date(formData.endDate).toISOString();
      } else {
        payload.endDate = null;
      }

      // Include sign-up password if sign-up mode is enabled and password is provided
      if (formData.signUpMode && formData.signUpPassword.trim()) {
        payload.signUpPassword = formData.signUpPassword.trim();
      }

      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));

        // Format validation details if present
        let errorMessage = errorData.error || `Failed to update trip (${response.status})`;
        if (errorData.details && Array.isArray(errorData.details)) {
          const detailMessages = errorData.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ');
          errorMessage = `${errorMessage}: ${detailMessages}`;
        }

        throw new Error(errorMessage);
      }

      // Success!
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating trip:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update trip. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCopyUrl = async () => {
    const tripUrl = `${window.location.origin}/t/${trip.id}`;
    try {
      await navigator.clipboard.writeText(tripUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);

    try {
      if (!user) {
        throw new Error("You must be logged in to delete a trip");
      }

      const idToken = await user.getIdToken();

      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `Failed to delete trip (${response.status})`
        );
      }

      // Success! Navigate to trips list
      router.push("/trips");
    } catch (err) {
      console.error("Error deleting trip:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete trip. Please try again."
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Edit Trip Details
            </h2>
            <button
              onClick={onClose}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              disabled={isSubmitting}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Trip Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Trip Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                maxLength={200}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="e.g., Paris 2025"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="What's this trip about?"
              />
            </div>

            {/* Trip URL */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Direct Trip URL
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 font-mono text-sm overflow-x-auto whitespace-nowrap">
                  {typeof window !== 'undefined' && `${window.location.origin}/t/${trip.id}`}
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="tap-target px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 flex-shrink-0"
                >
                  {urlCopied ? (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Share this URL with trip members for direct access without the main navigation menu.
              </p>
            </div>

            {/* Base Currency */}
            <div>
              <label
                htmlFor="baseCurrency"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Base Currency *
              </label>
              <input
                type="text"
                id="baseCurrency"
                name="baseCurrency"
                value={formData.baseCurrency}
                onChange={handleChange}
                required
                maxLength={3}
                pattern="[A-Z]{3}"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="GBP"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                3-letter currency code (e.g., USD, EUR, GBP)
              </p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              <div className="min-w-0">
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full min-w-0 appearance-none px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 box-border"
                />
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full min-w-0 appearance-none px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 box-border"
                />
              </div>
            </div>

            {/* Info about dependent timeline items */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Timeline Auto-Updates
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Changing trip dates will automatically update RSVP deadline
                    and spending window timeline items.
                  </p>
                </div>
              </div>
            </div>

            {/* Sign-up Mode */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="signUpMode"
                  name="signUpMode"
                  checked={formData.signUpMode}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
                <div>
                  <label
                    htmlFor="signUpMode"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Enable Sign-up Mode
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Creates a shared viewer account that others can use to view this trip without individual invitations.
                  </p>
                </div>
              </div>

              {formData.signUpMode && (
                <div className="ml-7 space-y-3">
                  <div>
                    <label
                      htmlFor="signUpPassword"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                    >
                      Viewer Password
                    </label>
                    <input
                      type="text"
                      id="signUpPassword"
                      name="signUpPassword"
                      value={formData.signUpPassword}
                      onChange={handleChange}
                      placeholder={trip.signUpPassword ? "Current password shown" : "Leave empty for auto-generated"}
                      minLength={6}
                      className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Min 6 characters. Change the password or leave as-is.
                    </p>
                  </div>
                  {trip.signUpPassword && (
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="font-medium">Current password:</span>{" "}
                        <code className="bg-zinc-200 dark:bg-zinc-600 px-1 py-0.5 rounded">
                          {trip.signUpPassword}
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex gap-3">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Are you sure you want to delete this trip?
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      This action cannot be undone. All trip data including
                      spends, timeline, and member information will be
                      permanently deleted.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="tap-target px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="tap-target px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? "Deleting..." : "Delete Trip"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting || isDeleting}
                  className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting}
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting || showDeleteConfirm}
                className="tap-target w-full px-6 py-3 rounded-lg border-2 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Trip
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
