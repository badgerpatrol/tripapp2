"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export interface ScannedKitItem {
  name: string;
  description?: string;
  year?: string;
  makeModel?: string;
  weightGrams?: number;
}

export interface KitItemToAdd {
  id: string;
  label: string;
  notes: string;
  quantity: number;
  category: string;
  weightGrams: string;
  cost: string;
  url: string;
  perPerson: boolean;
  required: boolean;
}

interface KitPhotoScanSheetProps {
  listId: string;
  isOpen: boolean;
  onClose: () => void;
  onItemsSelected: (items: KitItemToAdd[]) => void;
}

export default function KitPhotoScanSheet({
  listId,
  isOpen,
  onClose,
  onItemsSelected,
}: KitPhotoScanSheetProps) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedKitItem[] | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [hint, setHint] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Reset selected items when scanned items change
  useEffect(() => {
    if (scannedItems) {
      // Select all items by default
      setSelectedItems(new Set(scannedItems.map((_, index) => index)));
    }
  }, [scannedItems]);

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
    setSelectedItems(new Set());
    setError(null);
    setHint("");
    startCamera();
  };

  const parsePhoto = async () => {
    if (!capturedImage || !user) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Get auth token from Firebase user
      const idToken = await user.getIdToken();

      const response = await fetch("/api/ai/kit-photo-parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          listId,
          image: capturedImage,
          hint: hint.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to parse photo");
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("No items found in photo. Please try again with a different image.");
      }

      setScannedItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse photo");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (!scannedItems) return;

    if (selectedItems.size === scannedItems.length) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all
      setSelectedItems(new Set(scannedItems.map((_, index) => index)));
    }
  };

  const addSelectedItems = () => {
    if (!scannedItems || selectedItems.size === 0) return;

    const itemsToAdd: KitItemToAdd[] = Array.from(selectedItems)
      .map((index) => {
        const item = scannedItems[index];
        if (!item) return null;

        // Build description with available details
        const descriptionParts: string[] = [];
        if (item.description) descriptionParts.push(item.description);
        if (item.makeModel) descriptionParts.push(`Make/Model: ${item.makeModel}`);
        if (item.year) descriptionParts.push(`Year: ${item.year}`);

        const notes = descriptionParts.join(" | ");

        return {
          id: crypto.randomUUID(),
          label: item.name,
          notes,
          quantity: 1,
          category: "",
          weightGrams: item.weightGrams ? String(item.weightGrams) : "",
          cost: "",
          url: "",
          perPerson: false,
          required: true,
        };
      })
      .filter((item): item is KitItemToAdd => item !== null);

    onItemsSelected(itemsToAdd);
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setScannedItems(null);
    setSelectedItems(new Set());
    setError(null);
    setHint("");
    setIsProcessing(false);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);
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
                Scan From Photo
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {scannedItems
                  ? `Found ${scannedItems.length} items (${selectedItems.size} selected)`
                  : capturedImage
                  ? "Identify items in the photo"
                  : "Take a clear photo of your gear or items"}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
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

          {/* Scanned Items with Checkboxes */}
          {scannedItems && (
            <div className="mb-6">
              {/* Show the photo for reference */}
              {capturedImage && (
                <div className="mb-4">
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <img
                      src={capturedImage}
                      alt="Scanned photo"
                      className="w-full h-auto max-h-[300px] object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Select All / Deselect All Button */}
              <div className="mb-3 flex justify-between items-center">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {selectedItems.size === scannedItems.length ? "Deselect All" : "Select All"}
                </button>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedItems.size} of {scannedItems.length} selected
                </span>
              </div>

              {/* Items List */}
              <div className="max-h-[300px] overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {scannedItems.map((item, index) => (
                    <label
                      key={index}
                      className="flex items-start gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedItems.has(index)}
                        onChange={() => toggleItem(index)}
                        className="mt-1 w-4 h-4 rounded text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.description}
                          </div>
                        )}
                        {(item.makeModel || item.year || item.weightGrams) && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 space-y-0.5">
                            {item.makeModel && (
                              <div>Make/Model: {item.makeModel}</div>
                            )}
                            {item.year && (
                              <div>Year: {item.year}</div>
                            )}
                            {item.weightGrams && (
                              <div>Weight: {item.weightGrams}g</div>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
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
                        <p className="text-sm font-medium">Permission needed</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured photo"
                    className="w-full h-auto"
                  />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Hint text field - shown after image is captured/uploaded */}
          {capturedImage && !scannedItems && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Kit type hint (optional)
              </label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="e.g., hiking gear, camping equipment, ski kit..."
                className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Help the AI understand what type of items to look for
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {!capturedImage && !scannedItems ? (
              <>
                <button
                  type="button"
                  onClick={isCameraActive ? capturePhoto : startCamera}
                  className="tap-target w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  {isCameraActive ? "Take Photo" : "Enable Camera"}
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
                <label className="tap-target w-full px-6 py-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:border-green-500 hover:text-green-600 dark:hover:border-green-500 dark:hover:text-green-400 transition-colors cursor-pointer flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
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
                  className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Scan Different Photo
                </button>
                <button
                  type="button"
                  onClick={addSelectedItems}
                  disabled={selectedItems.size === 0}
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Add {selectedItems.size} Item{selectedItems.size !== 1 ? "s" : ""} to List
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
                  onClick={parsePhoto}
                  disabled={isProcessing}
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isProcessing ? "Identifying Items..." : "Identify Items"}
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          {!scannedItems && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                Tips for best results:
              </h4>
              <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                <li>• Include all items you want to identify in the photo</li>
                <li>• Use good lighting to make items clearly visible</li>
                <li>• Spread items out so they're easy to distinguish</li>
                <li>• Take the photo from directly above for best clarity</li>
                <li>• You can select which items to add after scanning</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
