"use client";

import { useState, useEffect } from "react";

interface ShareTripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripName: string;
  ownerName: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  tripUrl: string;
  accessCode?: string | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildShareText(props: Omit<ShareTripDialogProps, "isOpen" | "onClose">): string {
  const { tripName, ownerName, description, startDate, endDate, tripUrl, accessCode } = props;

  const parts = [
    `${ownerName} has invited you to ${tripName}`,
  ];

  if (description) {
    parts.push(description);
  }

  if (startDate && endDate) {
    parts.push(`Dates: ${formatDate(startDate)} - ${formatDate(endDate)}`);
  }

  parts.push(`Join here: ${tripUrl}`);

  if (accessCode) {
    parts.push(`Code: ${accessCode}`);
  }

  return parts.join("\n");
}

export default function ShareTripDialog({
  isOpen,
  onClose,
  tripName,
  ownerName,
  description,
  startDate,
  endDate,
  tripUrl,
  accessCode,
}: ShareTripDialogProps) {
  const [shareText, setShareText] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize/reset share text when dialog opens
  useEffect(() => {
    if (isOpen) {
      setShareText(
        buildShareText({
          tripName,
          ownerName,
          description,
          startDate,
          endDate,
          tripUrl,
          accessCode,
        })
      );
      setCopied(false);
    }
  }, [isOpen, tripName, ownerName, description, startDate, endDate, tripUrl, accessCode]);

  if (!isOpen) return null;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: tripName,
          text: shareText,
        });
        onClose();
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Error sharing:", err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Share Trip
            </h2>
            <button
              onClick={onClose}
              className="tap-target text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
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

          {/* Editable share text */}
          <div className="space-y-2 mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Message to share
            </label>
            <textarea
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none font-mono text-sm"
              placeholder="Enter your message..."
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Edit the message above before sharing
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleShare}
              disabled={isSharing || !shareText.trim()}
              className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {isSharing ? "Sharing..." : "Share"}
            </button>

            <button
              onClick={handleCopy}
              disabled={!shareText.trim()}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy to Clipboard
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-lg text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
