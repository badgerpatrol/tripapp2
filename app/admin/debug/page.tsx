"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

interface DebugInfo {
  databaseUrl: string;
  nodeEnv: string;
  timestamp: string;
}

export default function AdminDebugPage() {
  const { user, loading: authLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchDebugInfo();
    }
  }, [user]);

  const fetchDebugInfo = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/debug", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch debug info");
      }

      const data = await response.json();
      setDebugInfo(data.debug);
    } catch (err: any) {
      console.error("Error fetching debug info:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Debug Information
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            View system debug information (Admin only)
          </p>
        </div>

        {/* Refresh Button */}
        <div className="mb-6">
          <Button
            onClick={fetchDebugInfo}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Refresh
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
          </div>
        )}

        {/* Debug Info */}
        {!loading && debugInfo && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 border border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
              Environment Variables
            </h2>

            <div className="space-y-6">
              {/* Database URL */}
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  DATABASE_URL
                </label>
                <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded border border-zinc-200 dark:border-zinc-700 font-mono break-all">
                  {debugInfo.databaseUrl}
                </div>
              </div>

              {/* Node Environment */}
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  NODE_ENV
                </label>
                <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded border border-zinc-200 dark:border-zinc-700 font-mono">
                  {debugInfo.nodeEnv}
                </div>
              </div>

              {/* Timestamp */}
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Server Timestamp
                </label>
                <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded border border-zinc-200 dark:border-zinc-700 font-mono">
                  {new Date(debugInfo.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
