"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export interface ScannedMenuItem {
  name: string;
  description?: string;
  priceMinor?: number;
  course?: string;
  currency: string;
}

interface MenuScanSheetProps {
  tripId: string;
  choiceId: string;
  tripCurrency: string;
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: () => void;
}

export default function MenuScanSheet({
  tripId,
  choiceId,
  tripCurrency,
  isOpen,
  onClose,
  onItemsAdded,
}: MenuScanSheetProps) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedMenuItem[] | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
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
      setError("Unable to access camera. Please check permissions.");
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
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
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setScannedItems(null);
    setError(null);
    startCamera();
  };

  const parseMenu = async () => {
    if (!capturedImage || !user) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Get auth token from Firebase user
      const idToken = await user.getIdToken();

      const response = await fetch("/api/ai/menu-parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tripId,
          image: capturedImage,
          currencyHint: tripCurrency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to parse menu");
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("No menu items found. Please try again with a clearer image.");
      }

      setScannedItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse menu");
    } finally {
      setIsProcessing(false);
    }
  };

  const addItemsToChoice = async () => {
    if (!scannedItems || scannedItems.length === 0 || !user) return;

    setIsSaving(true);
    setError(null);

    try {
      // Get auth token from Firebase user
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/choices/${choiceId}/items/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: scannedItems.map((item, index) => ({
            name: item.name,
            description: item.description,
            priceMinor: item.priceMinor,
            course: item.course,
            sortIndex: index,
            isActive: true,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add items");
      }

      // Success!
      onItemsAdded();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add items");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setScannedItems(null);
    setError(null);
    setIsProcessing(false);
    setIsSaving(false);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";

    if (!isImage && !isPDF) {
      setError("Please select an image or PDF file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      setCapturedImage(fileData);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Scan Menu
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {scannedItems
                  ? `Found ${scannedItems.length} items`
                  : capturedImage
                  ? "Extract menu items from file"
                  : "Take a photo or upload an image/PDF of the menu"}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing || isSaving}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
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

          {/* Scanned Items Preview */}
          {scannedItems && (
            <div className="mb-6 max-h-[300px] overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
              <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {scannedItems.map((item, index) => (
                  <div key={index} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        {item.description}
                      </div>
                    )}
                    {item.priceMinor !== undefined && (
                      <div className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                        {(item.priceMinor / 100).toFixed(2)} {item.currency}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Camera/Image Display */}
          {!scannedItems && (
            <div className="mb-6">
              {!capturedImage ? (
                <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isCameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-white">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm">Initializing camera...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured menu"
                    className="w-full h-auto"
                  />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {!capturedImage && !scannedItems ? (
              <>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!isCameraActive}
                  className="tap-target w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  Take Photo
                </button>
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
                <label className="tap-target w-full px-6 py-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Image/PDF
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </>
            ) : scannedItems ? (
              <div className="flex flex-col-reverse md:flex-row gap-3">
                <button
                  type="button"
                  onClick={retakePhoto}
                  disabled={isSaving}
                  className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Scan Different Menu
                </button>
                <button
                  type="button"
                  onClick={addItemsToChoice}
                  disabled={isSaving}
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isSaving ? "Adding Items..." : "Add to Choice"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col-reverse md:flex-row gap-3">
                <button
                  type="button"
                  onClick={retakePhoto}
                  disabled={isProcessing}
                  className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={parseMenu}
                  disabled={isProcessing}
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isProcessing ? "Reading Menu..." : "Extract Items"}
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          {!scannedItems && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Tips for best results:
              </h4>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Ensure the entire menu page is visible and in focus</li>
                <li>• Use good lighting to avoid shadows</li>
                <li>• Keep the menu flat and straight</li>
                <li>• Make sure item names and prices are clearly readable</li>
                <li>• If the menu has multiple pages, scan them separately</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
