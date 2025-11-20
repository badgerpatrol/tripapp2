"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { detectCurrency } from "@/lib/menu";

export interface ScannedReceiptItem {
  name: string;
  description?: string;
  costMinor: number;
  currency: string;
  quantity: number;
}

interface Trip {
  id: string;
  name: string;
  baseCurrency: string;
}

interface HomeReceiptScanDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HomeReceiptScanDialog({
  isOpen,
  onClose,
}: HomeReceiptScanDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Trip selection state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("new");
  const [newTripName, setNewTripName] = useState("");
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Fetch trips when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      fetchTrips();
      // Set default new trip name with current date/time
      const now = new Date();
      const defaultName = `Spend ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setNewTripName(defaultName);
    }
  }, [isOpen, user]);

  const fetchTrips = async () => {
    if (!user) return;

    setLoadingTrips(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/trips", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }

      const data = await response.json();
      setTrips(data.trips || []);
    } catch (err) {
      console.error("Error fetching trips:", err);
      setError("Failed to load trips");
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
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
    setError(null);
    startCamera();
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

  const extractReceiptData = async () => {
    if (!capturedImage || !user) return;
    if (selectedTripId !== "new" && !selectedTripId) {
      setError("Please select a trip");
      return;
    }
    if (selectedTripId === "new" && !newTripName.trim()) {
      setError("Please enter a trip name");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      let tripId = selectedTripId;
      let tripCurrency = "USD";

      // Create new trip if selected
      if (selectedTripId === "new") {
        const createTripResponse = await fetch("/api/trips", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: newTripName.trim(),
            baseCurrency: "USD",
            status: "PLANNING",
          }),
        });

        if (!createTripResponse.ok) {
          throw new Error("Failed to create trip");
        }

        const tripData = await createTripResponse.json();
        tripId = tripData.trip.id;
        tripCurrency = tripData.trip.baseCurrency;
      } else {
        const selectedTrip = trips.find(t => t.id === selectedTripId);
        if (selectedTrip) {
          tripCurrency = selectedTrip.baseCurrency;
        }
      }

      // Parse receipt
      const parseResponse = await fetch("/api/ai/receipt-parse", {
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

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to parse receipt");
      }

      const parseData = await parseResponse.json();

      if (!parseData.items || parseData.items.length === 0) {
        throw new Error("No receipt items found. Please try again with a clearer image.");
      }

      // Calculate total
      const totalAmount = parseData.items.reduce(
        (sum: number, item: ScannedReceiptItem) => sum + (item.costMinor * item.quantity),
        0
      ) / 100;

      // Normalize currency to ensure it's a valid 3-letter ISO code
      const rawCurrency = parseData.items[0]?.currency || tripCurrency;
      const normalizedCurrency = rawCurrency.length === 3
        ? rawCurrency
        : detectCurrency(rawCurrency) || tripCurrency;

      // Create spend
      const createSpendResponse = await fetch("/api/spends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tripId,
          description: "Receipt Scan",
          amount: totalAmount,
          currency: normalizedCurrency,
          fxRate: 1.0,
          date: new Date(),
          receiptImageData: capturedImage,
        }),
      });

      if (!createSpendResponse.ok) {
        throw new Error("Failed to create spend");
      }

      const spendData = await createSpendResponse.json();
      const spendId = spendData.spend.id;

      // Generate a unique photoId for this receipt scan
      const photoId = crypto.randomUUID();

      // Create spend items
      for (const item of parseData.items) {
        for (let i = 0; i < item.quantity; i++) {
          const itemResponse = await fetch(`/api/spends/${spendId}/items`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              name: item.name,
              description: item.description || undefined,
              cost: item.costMinor / 100,
              source: "PHOTO",
              photoId: photoId,
            }),
          });

          if (!itemResponse.ok) {
            throw new Error("Failed to create spend item");
          }
        }
      }

      // Success - navigate to trip
      handleClose();
      router.push(`/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process receipt");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    setIsProcessing(false);
    setSelectedTripId("new");
    setNewTripName("");
    onClose();
  };

  if (!isOpen) return null;

  const canProceed = capturedImage && ((selectedTripId === "new" && newTripName.trim()) || (selectedTripId !== "new" && selectedTripId));

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Scan Receipt
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {capturedImage
                  ? "Select a trip and extract receipt data"
                  : "Take a clear photo of the receipt"}
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

          {/* Trip Selection - Show before extracting data */}
          {capturedImage && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Add to Trip *
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                disabled={isProcessing || loadingTrips}
                className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50"
              >
                <option value="new">Create New Trip</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>

              {selectedTripId === "new" && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    New Trip Name *
                  </label>
                  <input
                    type="text"
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    disabled={isProcessing}
                    placeholder="Spend 1/1/2024 12:00 PM"
                    className="tap-target w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          )}

          {/* Camera/Image Display */}
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
                  alt="Captured receipt"
                  className="w-full h-auto"
                />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {!capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={isCameraActive ? capturePhoto : startCamera}
                  className="tap-target w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
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
                <label className="tap-target w-full px-6 py-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center gap-2">
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
                  onClick={extractReceiptData}
                  disabled={isProcessing || !canProceed}
                  className="tap-target flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isProcessing ? "Processing..." : "Extract & Create Spend"}
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          {!capturedImage && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Tips for best results:
              </h4>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Ensure the entire receipt is visible and in focus</li>
                <li>• Use good lighting to avoid shadows</li>
                <li>• Keep the receipt flat and straight</li>
                <li>• Make sure item names and prices are clearly readable</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
