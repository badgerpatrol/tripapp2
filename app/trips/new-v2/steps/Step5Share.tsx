"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import type { StepProps } from "../types";

export default function Step5Share({
  state,
  updateState,
  error,
  setError,
  isLoading,
  setIsLoading,
}: StepProps) {
  const { user, userProfile } = useAuth();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const tripUrl = state.tripId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/t/${state.tripId}`
    : "";

  // Ensure join code is generated
  useEffect(() => {
    const ensureJoinCode = async () => {
      if (!user || !state.tripId || state.tripJoinCode) return;

      setIsLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/trips/${state.tripId}/ensure-join-code`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          updateState({ tripJoinCode: data.joinCode });
        } else {
          setError("Failed to generate join code");
        }
      } catch (err) {
        console.error("Error generating join code:", err);
        setError("Failed to generate join code");
      } finally {
        setIsLoading(false);
      }
    };
    ensureJoinCode();
  }, [user, state.tripId, state.tripJoinCode, updateState, setIsLoading, setError]);

  const copyToClipboard = async (text: string, type: "url" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shareTrip = async () => {
    const ownerName = userProfile?.displayName || "Someone";
    const inviteText = `${ownerName} has invited you to ${state.name}`;

    const shareText = [
      inviteText,
      state.description ? `\n${state.description}` : "",
      `\nDates: ${formatDate(state.startDate)} - ${formatDate(state.endDate)}`,
      `\nJoin here: ${tripUrl}`,
      state.tripJoinCode ? `\nCode: ${state.tripJoinCode}` : "",
    ].join("");

    if (navigator.share) {
      try {
        // Only pass text (which includes the URL) - passing both text and url
        // causes many platforms (iOS Messages) to only show the url
        await navigator.share({
          text: shareText,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    } else {
      // Fallback: copy URL
      copyToClipboard(tripUrl, "url");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Share Your Trip
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Invite others to join
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          Generating join code...
        </div>
      ) : (
        <>
          {/* Trip URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Trip URL
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 truncate">
                {tripUrl}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(tripUrl, "url")}
              >
                {copiedUrl ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Trip Code */}
          {state.tripJoinCode && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Trip Code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100 tracking-wider text-center">
                  {state.tripJoinCode}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(state.tripJoinCode!, "code")}
                >
                  {copiedCode ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {/* Share button */}
          <Button
            variant="primary"
            full
            onClick={shareTrip}
            leftIcon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            }
          >
            Share Trip
          </Button>

          <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-4">
            You can share this anytime from the trip page
          </div>
        </>
      )}
    </div>
  );
}
