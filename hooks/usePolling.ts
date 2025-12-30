import { useEffect, useRef, useCallback } from "react";

export interface UsePollingOptions {
  callback: () => Promise<void>;
  interval: number; // milliseconds
  enabled: boolean;
  maxPolls?: number; // Maximum number of polls before stopping (default: unlimited)
}

/**
 * Custom hook for polling with visibility awareness.
 * Automatically pauses polling when the browser tab is hidden
 * and resumes when it becomes visible again.
 * Stops after maxPolls if specified.
 */
export function usePolling({ callback, interval, enabled, maxPolls }: UsePollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);
  const pollCountRef = useRef(0);

  // Keep callback ref up to date to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      // Check if we've reached the max polls limit
      if (maxPolls !== undefined && pollCountRef.current >= maxPolls) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
        return;
      }
      pollCountRef.current += 1;
      callbackRef.current();
    }, interval);
  }, [interval, maxPolls]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    // Reset poll count when enabled changes (e.g., user expands a different list)
    pollCountRef.current = 0;

    // Start polling when enabled
    startPolling();

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else if (document.visibilityState === "visible") {
        // Immediately poll when becoming visible, then resume interval
        callbackRef.current();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup on unmount or when disabled
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling]);
}
