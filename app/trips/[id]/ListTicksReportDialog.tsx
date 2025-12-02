"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface UserStat {
  userId: string;
  displayName: string;
  photoURL: string | null;
  totalTicks: number;
  sharedTicks: number;
  perPersonTicks: number;
}

interface TickDetail {
  id: string;
  userId: string;
  isShared: boolean;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    photoURL: string | null;
  };
  todoItem?: {
    id: string;
    label: string;
    perPerson: boolean;
    list: {
      id: string;
      title: string;
      type: string;
    };
  };
  kitItem?: {
    id: string;
    label: string;
    perPerson: boolean;
    list: {
      id: string;
      title: string;
      type: string;
    };
  };
}

interface ListTicksReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
}

export default function ListTicksReportDialog({
  isOpen,
  onClose,
  tripId,
}: ListTicksReportDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "shared" | "all">("summary");
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [sharedTicks, setSharedTicks] = useState<TickDetail[]>([]);
  const [allTicks, setAllTicks] = useState<TickDetail[]>([]);

  useEffect(() => {
    if (isOpen && tripId) {
      fetchReport();
    }
  }, [isOpen, tripId]);

  const fetchReport = async () => {
    if (!user || !tripId) return;

    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/trips/${tripId}/ticks`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tick report");
      }

      const data = await response.json();
      setUserStats(data.userStats || []);
      setSharedTicks(data.sharedTicks || []);
      setAllTicks(data.ticks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalTicks = userStats.reduce((sum, u) => sum + u.totalTicks, 0);
  const totalShared = userStats.reduce((sum, u) => sum + u.sharedTicks, 0);
  const totalPerPerson = userStats.reduce((sum, u) => sum + u.perPersonTicks, 0);

  // Group shared ticks by item
  const sharedTicksByItem = sharedTicks.reduce((acc, tick) => {
    const item = tick.todoItem || tick.kitItem;
    if (!item) return acc;

    const key = `${item.list.type}-${item.id}`;
    if (!acc[key]) {
      acc[key] = {
        item,
        ticks: [],
      };
    }
    acc[key].ticks.push(tick);
    return acc;
  }, {} as Record<string, { item: any; ticks: TickDetail[] }>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              List Completion Report
            </h2>
            <button
              onClick={onClose}
              className="tap-target p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setTab("summary")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === "summary"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setTab("shared")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === "shared"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Shared Items
            </button>
            <button
              onClick={() => setTab("all")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === "all"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              All Activity
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* Summary Tab */}
              {tab === "summary" && (
                <div className="space-y-6">
                  {/* Overall Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalTicks}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Ticks</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalShared}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Shared Items</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalPerPerson}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Per-Person Items</p>
                    </div>
                  </div>

                  {/* Per-User Stats */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                      Ticks by Member
                    </h3>
                    {userStats.length === 0 ? (
                      <p className="text-zinc-500 dark:text-zinc-400 text-center py-4">
                        No ticks recorded yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {userStats
                          .sort((a, b) => b.totalTicks - a.totalTicks)
                          .map((stat) => (
                            <div
                              key={stat.userId}
                              className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                {stat.photoURL ? (
                                  <img
                                    src={stat.photoURL}
                                    alt=""
                                    className="w-8 h-8 rounded-full"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center">
                                    <span className="text-sm font-medium">
                                      {stat.displayName?.[0]?.toUpperCase() || "?"}
                                    </span>
                                  </div>
                                )}
                                <span className="font-medium text-zinc-900 dark:text-white">
                                  {stat.displayName}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-zinc-900 dark:text-white font-semibold">
                                  {stat.totalTicks} total
                                </span>
                                <span className="text-blue-600 dark:text-blue-400">
                                  {stat.sharedTicks} shared
                                </span>
                                <span className="text-green-600 dark:text-green-400">
                                  {stat.perPersonTicks} personal
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shared Items Tab */}
              {tab === "shared" && (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Shared items are completed once by any member for the whole group.
                  </p>
                  {Object.keys(sharedTicksByItem).length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                      No shared items have been ticked yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.values(sharedTicksByItem).map(({ item, ticks }) => (
                        <div
                          key={item.id}
                          className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">
                                {item.label}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {item.list.title} ({item.list.type})
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                item.list.type === "TODO"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                                  : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                              }`}
                            >
                              {item.list.type === "TODO" ? "Done" : "Packed"}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {ticks.map((tick) => (
                              <span
                                key={tick.id}
                                className="inline-flex items-center gap-1 text-xs bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700"
                              >
                                {tick.user.displayName}
                                <span className="text-zinc-400">
                                  {new Date(tick.createdAt).toLocaleDateString()}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Activity Tab */}
              {tab === "all" && (
                <div className="space-y-4">
                  {allTicks.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                      No activity recorded yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {allTicks.map((tick) => {
                        const item = tick.todoItem || tick.kitItem;
                        return (
                          <div
                            key={tick.id}
                            className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-3">
                              {tick.user.photoURL ? (
                                <img
                                  src={tick.user.photoURL}
                                  alt=""
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center">
                                  <span className="text-xs font-medium">
                                    {tick.user.displayName?.[0]?.toUpperCase() || "?"}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-zinc-900 dark:text-white">
                                  {tick.user.displayName}
                                </span>
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  {" ticked "}
                                </span>
                                <span className="font-medium text-zinc-900 dark:text-white">
                                  {item?.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  tick.isShared
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                                    : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                }`}
                              >
                                {tick.isShared ? "shared" : "personal"}
                              </span>
                              <span className="text-zinc-400 text-xs">
                                {new Date(tick.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
