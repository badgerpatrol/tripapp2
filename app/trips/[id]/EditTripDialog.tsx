"use client";

import { useState, useRef, useEffect } from "react";
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
    signInMode?: boolean;
    signUpPassword?: string | null;
    headerImageData?: string | null;
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
    signInMode: trip.signInMode || false,
    signUpPassword: trip.signUpPassword || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isClearingPassword, setIsClearingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Header image state
  const [headerImageData, setHeaderImageData] = useState<string | null>(trip.headerImageData || null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(trip.headerImageData || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoLibraryInputRef = useRef<HTMLInputElement>(null);

  // Camera state for live camera capture
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showCameraView, setShowCameraView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up camera stream when dialog closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setShowCameraView(false);
  };

  const startCamera = async () => {
    try {
      setError(null);
      setShowCameraView(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions or use photo library.");
      setShowCameraView(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.85);

    setHeaderImageData(imageData);
    setHeaderImagePreview(imageData);
    stopCamera();
  };

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setHeaderImageData(base64);
      setHeaderImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setHeaderImageData(null);
    setHeaderImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (photoLibraryInputRef.current) {
      photoLibraryInputRef.current.value = "";
    }
  };

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
        signInMode: formData.signInMode,
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

      // Include header image (null to remove, string to set)
      payload.headerImageData = headerImageData;

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

  const handleSetPassword = async () => {
    if (!formData.signUpPassword.trim() || formData.signUpPassword.trim().length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsSettingPassword(true);
    setPasswordMessage(null);

    try {
      if (!user) {
        throw new Error("You must be logged in");
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ signUpPassword: formData.signUpPassword.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to set password");
      }

      setPasswordMessage({ type: 'success', text: 'Password set successfully' });
      setTimeout(() => setPasswordMessage(null), 3000);
      onSuccess();
    } catch (err) {
      console.error("Error setting password:", err);
      setPasswordMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to set password' });
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleClearPassword = async () => {
    setIsClearingPassword(true);
    setPasswordMessage(null);

    try {
      if (!user) {
        throw new Error("You must be logged in");
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ signUpPassword: null }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to clear password");
      }

      setFormData(prev => ({ ...prev, signUpPassword: '' }));
      setPasswordMessage({ type: 'success', text: 'Password cleared - trip has no password' });
      setTimeout(() => setPasswordMessage(null), 3000);
      onSuccess();
    } catch (err) {
      console.error("Error clearing password:", err);
      setPasswordMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to clear password' });
    } finally {
      setIsClearingPassword(false);
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

            {/* Viewer Password */}
            <div className="space-y-3">
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
                  placeholder={trip.signUpPassword ? "Enter new password to change" : "No password set"}
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Set a password to require viewers to enter it before accessing the trip. Min 6 characters.
                </p>
              </div>

              {/* Current password display */}
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

              {/* Password action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSetPassword}
                  disabled={isSettingPassword || isClearingPassword || !formData.signUpPassword.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSettingPassword ? "Setting..." : "Set Password"}
                </button>
                <button
                  type="button"
                  onClick={handleClearPassword}
                  disabled={isSettingPassword || isClearingPassword || (!trip.signUpPassword && !formData.signUpPassword.trim())}
                  className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearingPassword ? "Clearing..." : "Clear Password"}
                </button>
              </div>

              {/* Password message */}
              {passwordMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  passwordMessage.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  {passwordMessage.text}
                </div>
              )}
            </div>

            {/* Sign-in Mode */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="signInMode"
                name="signInMode"
                checked={formData.signInMode}
                onChange={handleChange}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div>
                <label
                  htmlFor="signInMode"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Enable Sign-in Mode
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Show a list of invitees so visitors can identify themselves and sign in.
                </p>
              </div>
            </div>

            {/* Sign-up Mode */}
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
                  Allow new users to sign up for the trip with their own name.
                </p>
              </div>
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

            {/* Header Image */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Header Image
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Add a cover image that will appear at the top of your trip page
              </p>

              {/* Live Camera View */}
              {showCameraView && (
                <div className="relative">
                  <div className="relative h-48 rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!isCameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white">
                          <svg className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          </svg>
                          <p className="text-sm">Starting camera...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!isCameraActive}
                      className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      Capture
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {headerImagePreview && !showCameraView && (
                <div className="relative">
                  <div className="relative h-40 rounded-lg overflow-hidden">
                    <img
                      src={headerImagePreview}
                      alt="Header preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                    title="Remove image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Image Source Options */}
              {!headerImagePreview && !showCameraView && (
                <div className="flex flex-col gap-3">
                  {/* Take Photo button - opens live camera */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </button>

                  {/* Choose from Photo Library button */}
                  <button
                    type="button"
                    onClick={() => photoLibraryInputRef.current?.click()}
                    className="w-full px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Choose from Library
                  </button>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-300 dark:border-zinc-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        or
                      </span>
                    </div>
                  </div>

                  {/* Upload File button - opens file browser */}
                  <label className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload File
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Hidden photo library input - uses accept="image/*" to show photo picker on iOS */}
              <input
                ref={photoLibraryInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
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
