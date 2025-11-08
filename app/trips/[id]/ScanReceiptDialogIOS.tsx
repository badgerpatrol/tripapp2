"use client";

import { useState, useRef, useEffect } from "react";

interface ScannedItem {
  name: string;
  cost: number;
  description?: string;
}

interface ScanReceiptDialogIOSProps {
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onItemsScanned: (items: ScannedItem[]) => void;
}

export default function ScanReceiptDialogIOS({
  currency,
  isOpen,
  onClose,
  onItemsScanned,
}: ScanReceiptDialogIOSProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      // On iOS, prefer file input for better camera integration
      if (isIOS()) {
        // Don't auto-start camera on iOS, use file input instead
        return;
      } else {
        startCamera();
      }
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  };

  const startCamera = async () => {
    try {
      setError(null);

      // iOS-specific camera constraints for better quality
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "environment", // Use back camera
          width: { ideal: 1920, max: 4096 },
          height: { ideal: 1080, max: 4096 },
          aspectRatio: { ideal: 16 / 9 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // iOS-specific: Force video to play inline
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');

        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError("Unable to access camera. Please check permissions or use the upload option.");
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

    // Set canvas to video dimensions for full resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw the video frame
    ctx.drawImage(video, 0, 0);

    // Apply image preprocessing for better OCR
    preprocessImage(canvas, ctx);

    // Convert to JPEG with quality optimization
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(imageData);
    stopCamera();
  };

  /**
   * Preprocess image for better OCR results
   * - Increases contrast
   * - Sharpens text
   * - Reduces noise
   */
  const preprocessImage = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Increase contrast and brightness for better text recognition
    const contrast = 1.2;
    const brightness = 10;

    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast
      data[i] = ((data[i] - 128) * contrast + 128) + brightness;     // Red
      data[i + 1] = ((data[i + 1] - 128) * contrast + 128) + brightness; // Green
      data[i + 2] = ((data[i + 2] - 128) * contrast + 128) + brightness; // Blue

      // Clamp values
      data[i] = Math.min(255, Math.max(0, data[i]));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1]));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2]));
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setError(null);
    if (!isIOS()) {
      startCamera();
    }
  };

  const processReceipt = async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Compress image further for mobile upload
      const compressedImage = await compressImage(capturedImage);

      const response = await fetch("/api/receipt/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: compressedImage,
          currency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to process receipt");
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("No items found on receipt. Please try again with better lighting.");
      }

      // Pass the scanned items back to the parent
      onItemsScanned(data.items);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process receipt");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Compress image for faster mobile upload
   */
  const compressImage = async (base64Image: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');

        // Resize large images to max 2048px on longest side
        const maxSize = 2048;
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with moderate quality
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } else {
          resolve(base64Image);
        }
      };
      img.src = base64Image;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;

      // Apply preprocessing to uploaded images too
      const processed = await preprocessUploadedImage(imageData);
      setCapturedImage(processed);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  const preprocessUploadedImage = async (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          preprocessImage(canvas, ctx);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(imageData);
        }
      };
      img.src = imageData;
    });
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setError(null);
    setIsProcessing(false);
    onClose();
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-0 md:p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-none md:rounded-xl shadow-xl w-full h-full md:max-w-2xl md:h-auto md:max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Scan Receipt
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {capturedImage
                  ? "Review and process your receipt"
                  : isIOS()
                    ? "Take or upload a clear photo of your receipt"
                    : "Take a clear photo of your receipt"}
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
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Camera/Image Display */}
          <div className="mb-4 md:mb-6">
            {!capturedImage ? (
              <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] md:aspect-[4/3]">
                {!isIOS() ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ WebkitPlaysinline: true } as any}
                    />
                    {!isCameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white px-4">
                          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-sm">Initializing camera...</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white px-4">
                      <svg className="w-20 h-20 mx-auto mb-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-base font-medium mb-2">Use your camera to scan</p>
                      <p className="text-sm opacity-75">Tap the button below to take or upload a photo</p>
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
                {isIOS() ? (
                  <>
                    {/* iOS: Primary action is native camera/photo picker */}
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="tap-target w-full px-6 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold transition-colors flex items-center justify-center gap-2 text-base"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      Take or Choose Photo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!isCameraActive}
                      className="tap-target w-full px-6 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col-reverse md:flex-row gap-3">
                <button
                  type="button"
                  onClick={retakePhoto}
                  disabled={isProcessing}
                  className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 dark:active:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={processReceipt}
                  disabled={isProcessing}
                  className="tap-target flex-1 px-6 py-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isProcessing ? "Processing..." : "Process Receipt"}
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 md:mt-6 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Tips for best results:
            </h4>
            <ul className="text-xs md:text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Ensure the entire receipt is visible and in focus</li>
              <li>• Use good lighting to avoid shadows</li>
              <li>• Keep the receipt flat and straight</li>
              <li>• Make sure item names and prices are clearly readable</li>
              {isIOS() && <li>• For best results, hold your phone steady when capturing</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
