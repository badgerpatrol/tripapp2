"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export interface ScannedMenuItem {
  name: string;
  description?: string;
  priceMinor?: number;
  course?: string;
  currency: string;
}

interface MenuGoogleSheetSheetProps {
  tripId: string;
  choiceId: string;
  tripCurrency: string;
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: () => void;
}

export default function MenuGoogleSheetSheet({
  tripId,
  choiceId,
  tripCurrency,
  isOpen,
  onClose,
  onItemsAdded,
}: MenuGoogleSheetSheetProps) {
  const { user } = useAuth();
  const [sheetUrl, setSheetUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedMenuItem[] | null>(null);

  const isValidGoogleSheetUrl = (url: string): boolean => {
    // Check for Google Sheets URL patterns
    const patterns = [
      /docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/,
      /^[a-zA-Z0-9-_]{20,}$/, // Just the ID itself
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const parseFromGoogleSheet = async () => {
    if (!sheetUrl.trim() || !user) return;

    // Validate URL format
    if (!isValidGoogleSheetUrl(sheetUrl)) {
      setError("Please enter a valid Google Sheet URL (e.g., https://docs.google.com/spreadsheets/d/...)");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Get auth token from Firebase user
      const idToken = await user.getIdToken();

      const response = await fetch("/api/ai/menu-parse-gsheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tripId,
          sheetUrl: sheetUrl.trim(),
          currencyHint: tripCurrency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to parse items from Google Sheet");
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("No items found in this Google Sheet. Please check the sheet content.");
      }

      setScannedItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse items from Google Sheet");
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
    setSheetUrl("");
    setScannedItems(null);
    setError(null);
    setIsProcessing(false);
    setIsSaving(false);
    onClose();
  };

  const handleReset = () => {
    setSheetUrl("");
    setScannedItems(null);
    setError(null);
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
                Read from Google Sheet
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {scannedItems
                  ? `Found ${scannedItems.length} items`
                  : "Enter a Google Sheet URL to extract items"}
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

          {/* Sheet URL Input Section */}
          {!scannedItems && (
            <div className="space-y-4">
              <div>
                <label htmlFor="sheet-url" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Google Sheet URL
                </label>
                <input
                  id="sheet-url"
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sheetUrl.trim()) {
                      parseFromGoogleSheet();
                    }
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  disabled={isProcessing}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Make sure the sheet is publicly accessible (Share → Anyone with the link can view)
                </p>
              </div>

              {/* Info box about flexible format */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Flexible format supported</p>
                    <p className="text-blue-600 dark:text-blue-400">
                      AI will analyze your sheet and extract items automatically. Works with various layouts - just make sure item names are clearly visible.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={parseFromGoogleSheet}
                disabled={!sheetUrl.trim() || isProcessing}
                className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Extracting items...
                  </>
                ) : (
                  <>
                    {/* Google Sheets icon */}
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 11V9h-6V5h-2v4H5v2h6v4h2v-4h6zm0 8H5V7H3v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7h-2v12z"/>
                    </svg>
                    Extract Items
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Section */}
          {scannedItems && (
            <div className="space-y-4">
              {/* Items List */}
              <div className="max-h-96 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
                {scannedItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {item.course && (
                          <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">
                            {item.course}
                          </span>
                        )}
                      </div>
                      {item.priceMinor !== undefined && (
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.currency} {(item.priceMinor / 100).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Try Different Sheet
                </button>
                <button
                  onClick={addItemsToChoice}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Adding Items...
                    </>
                  ) : (
                    `Add ${scannedItems.length} Items`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
