"use client";

import { useState, useRef, useEffect } from "react";
import { createWorker } from "tesseract.js";

interface ScannedItem {
  name: string;
  cost: number;
  description?: string;
}

interface ScanReceiptDialogOfflineProps {
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onItemsScanned: (items: ScannedItem[], receiptImage?: string) => void;
}

export default function ScanReceiptDialogOffline({
  currency,
  isOpen,
  onClose,
  onItemsScanned,
}: ScanReceiptDialogOfflineProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      setPermissionDenied(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920, max: 4096 },
          height: { ideal: 1080, max: 4096 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setPermissionDenied(true);
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);
    stopCamera();
  };

  const preprocessImage = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageData);
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data for processing
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale conversion
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

          // Increase contrast (threshold for better OCR)
          const contrast = 1.5;
          const adjusted = ((gray - 128) * contrast + 128);
          const final = adjusted > 128 ? Math.min(255, adjusted * 1.2) : Math.max(0, adjusted * 0.8);

          data[i] = final;     // Red
          data[i + 1] = final; // Green
          data[i + 2] = final; // Blue
        }

        ctx.putImageData(imgData, 0, 0);

        // Return as base64
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = imageData;
    });
  };

  const parseReceiptText = (text: string): ScannedItem[] => {
    const items: ScannedItem[] = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    // Common words to skip
    const skipWords = [
      'subtotal', 'total', 'tax', 'tip', 'gratuity', 'payment', 'change',
      'cash', 'credit', 'debit', 'visa', 'mastercard', 'amex', 'discover',
      'thank', 'receipt', 'invoice', 'merchant', 'store', 'welcome',
      'date', 'time', 'server', 'table', 'order', 'bill', 'check'
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();

      // Skip if contains skip words
      if (skipWords.some(word => lowerLine.includes(word))) {
        continue;
      }

      // Try to find price patterns
      const pricePatterns = [
        /(\d+[.,]\d{2})\s*$/,                    // 12.34 at end
        /\$\s*(\d+[.,]\d{2})/,                   // $12.34
        /(\d+[.,]\d{2})\s*(?:usd|gbp|eur)/i,    // 12.34 USD
      ];

      let price: number | null = null;
      let itemName = line;

      for (const pattern of pricePatterns) {
        const match = line.match(pattern);
        if (match) {
          const priceStr = match[1].replace(',', '.');
          price = parseFloat(priceStr);

          // Remove price from item name
          itemName = line.replace(match[0], '').trim();
          break;
        }
      }

      // If we found a valid price and name
      if (price && price > 0 && price < 10000 && itemName.length >= 2) {
        // Clean up item name
        itemName = itemName
          .replace(/^[\d\s*x@]+/, '') // Remove quantity markers
          .replace(/[*#]/g, '')        // Remove special chars
          .trim();

        // Check for quantity patterns (2 x 5.99, 3 @ 12.50)
        const qtyMatch = line.match(/(\d+)\s*[x@]\s*(\d+[.,]\d{2})/i);
        if (qtyMatch) {
          const qty = parseInt(qtyMatch[1]);
          const unitPrice = parseFloat(qtyMatch[2].replace(',', '.'));

          if (qty > 0 && unitPrice > 0) {
            items.push({
              name: itemName,
              cost: qty * unitPrice,
              description: `Qty: ${qty} @ ${currency} ${unitPrice.toFixed(2)}`
            });
            continue;
          }
        }

        // Add regular item
        if (itemName.length > 0) {
          items.push({
            name: itemName.substring(0, 80), // Limit length
            cost: Math.round(price * 100) / 100, // Round to 2 decimals
          });
        }
      }
    }

    return items;
  };

  const processReceiptOffline = async (imageData: string) => {
    setIsProcessing(true);
    setError(null);
    setProcessingProgress(0);
    setProcessingStatus("Initializing OCR engine...");

    try {
      // Preprocess image for better OCR
      setProcessingStatus("Enhancing image...");
      const processedImage = await preprocessImage(imageData);
      setProcessingProgress(20);

      // Create Tesseract worker
      setProcessingStatus("Loading OCR engine...");
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 60); // 20-80%
            setProcessingProgress(20 + progress);
            setProcessingStatus(`Reading receipt... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      setProcessingProgress(80);
      setProcessingStatus("Extracting items...");

      // Perform OCR
      const { data: { text } } = await worker.recognize(processedImage);

      // Parse the text to extract items
      const items = parseReceiptText(text);

      // Terminate worker
      await worker.terminate();

      setProcessingProgress(100);
      setProcessingStatus("Done!");

      if (items.length === 0) {
        throw new Error("No items found on receipt. Please try again with better lighting and a clearer image.");
      }

      // Success! Pass items back along with the captured image
      onItemsScanned(items, capturedImage || undefined);
      handleClose();

    } catch (err) {
      console.error("OCR Error:", err);
      setError(err instanceof Error ? err.message : "Failed to process receipt");
      setProcessingStatus("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setError(null);
    setProcessingProgress(0);
    setProcessingStatus("");
    startCamera();
  };

  const handleClose = () => {
    setCapturedImage(null);
    setError(null);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
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
                <span className="ml-2 text-xs md:text-sm font-normal text-green-600 dark:text-green-400">
                  • Offline Mode
                </span>
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {capturedImage
                  ? "Review and process your receipt (100% on-device)"
                  : "Take or upload a clear photo - no internet required"}
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

          {/* Processing Progress */}
          {isProcessing && (
            <div className="mb-4 md:mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {processingStatus}
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Image Display */}
          <div className="mb-4 md:mb-6">
            {!capturedImage ? (
              <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] md:aspect-[4/3]">
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
                      <p className="text-sm font-medium">Permission needed</p>
                      <p className="text-xs opacity-75 mt-2">100% Private & Offline</p>
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
                  className="tap-target w-full px-6 py-4 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold transition-colors flex items-center justify-center gap-2 text-base"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  {isCameraActive ? "Capture Receipt" : "Enable Camera"}
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
                    ref={fileInputRef}
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
                  className="tap-target flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 dark:active:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={() => processReceiptOffline(capturedImage)}
                  disabled={isProcessing}
                  className="tap-target flex-1 px-6 py-4 rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Process Offline
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 md:mt-6 p-3 md:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              100% Private Processing
            </h4>
            <ul className="text-xs md:text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>• All processing happens on your device</li>
              <li>• No data sent to servers or cloud</li>
              <li>• Works completely offline</li>
              <li>• Free - no API costs</li>
              <li>• Best with clear, well-lit receipts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
