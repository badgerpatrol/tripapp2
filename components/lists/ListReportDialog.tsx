"use client";

import { useMemo, useState } from "react";

interface ItemTick {
  id: string;
  userId: string;
  isShared: boolean;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    photoURL: string | null;
  };
}

interface TodoItem {
  id: string;
  label: string;
  perPerson: boolean;
  ticks?: ItemTick[];
}

interface KitItem {
  id: string;
  label: string;
  perPerson: boolean;
  ticks?: ItemTick[];
}

interface ListReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listTitle: string;
  listType: "TODO" | "KIT";
  todoItems?: TodoItem[];
  kitItems?: KitItem[];
  currentUserId?: string;
  tripMembers?: Array<{
    id: string;
    displayName: string;
    photoURL: string | null;
  }>;
}

export function ListReportDialog({
  isOpen,
  onClose,
  listTitle,
  listType,
  todoItems,
  kitItems,
  currentUserId,
  tripMembers = [],
}: ListReportDialogProps) {
  const [tab, setTab] = useState<"perPerson" | "shared">("perPerson");

  const items = listType === "TODO" ? todoItems || [] : kitItems || [];
  const perPersonItems = items.filter(item => item.perPerson);
  const sharedItems = items.filter(item => !item.perPerson);

  // Get all unique users who have ticked items
  const allTickUsers = useMemo(() => {
    const userMap = new Map<string, { id: string; displayName: string; photoURL: string | null }>();

    // Add trip members first
    tripMembers.forEach(member => {
      userMap.set(member.id, member);
    });

    // Add any users from ticks who might not be in tripMembers
    items.forEach(item => {
      item.ticks?.forEach(tick => {
        if (!userMap.has(tick.userId)) {
          userMap.set(tick.userId, tick.user);
        }
      });
    });

    return Array.from(userMap.values());
  }, [items, tripMembers]);

  // Calculate per-person stats for each user
  const userStats = useMemo(() => {
    return allTickUsers.map(user => {
      const perPersonTicked = perPersonItems.filter(item =>
        item.ticks?.some(t => t.userId === user.id)
      ).length;

      const sharedTicked = sharedItems.filter(item =>
        item.ticks?.some(t => t.userId === user.id)
      ).length;

      const perPersonTotal = perPersonItems.length;
      const perPersonPercent = perPersonTotal > 0
        ? Math.round((perPersonTicked / perPersonTotal) * 100)
        : 0;

      return {
        user,
        perPersonTicked,
        perPersonTotal,
        perPersonPercent,
        sharedTicked,
      };
    }).sort((a, b) => b.perPersonPercent - a.perPersonPercent);
  }, [allTickUsers, perPersonItems, sharedItems]);

  // Group shared items by their tick status
  const sharedItemsWithTickers = useMemo(() => {
    return sharedItems.map(item => ({
      item,
      tickers: item.ticks?.map(t => t.user) || [],
    }));
  }, [sharedItems]);

  if (!isOpen) return null;

  const ActionWord = listType === "TODO" ? "Done" : "Packed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {listTitle}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Completion Report
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setTab("perPerson")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === "perPerson"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Per Person ({perPersonItems.length})
            </button>
            <button
              onClick={() => setTab("shared")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === "shared"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Shared ({sharedItems.length})
            </button>
          </div>

          {/* Per-Person Tab */}
          {tab === "perPerson" && (
            <div>
              {perPersonItems.length > 0 ? (
                <div className="space-y-3">
                  {userStats.map(({ user, perPersonTicked, perPersonTotal, perPersonPercent }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {user.displayName?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {user.displayName}
                            {user.id === currentUserId && (
                              <span className="text-xs text-zinc-500 ml-1">(you)</span>
                            )}
                          </span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {perPersonTicked} / {perPersonTotal} ({perPersonPercent}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              listType === "TODO" ? "bg-blue-600" : "bg-green-600"
                            }`}
                            style={{ width: `${perPersonPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {userStats.length === 0 && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-center py-4">
                      No members yet
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                  No per-person items in this list
                </p>
              )}
            </div>
          )}

          {/* Shared Tab */}
          {tab === "shared" && (
            <div>
              {sharedItems.length > 0 ? (
                <div className="space-y-2">
                  {sharedItemsWithTickers.map(({ item, tickers }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
                    >
                      <span className="text-zinc-900 dark:text-white">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {tickers.length > 0 ? (
                          <>
                            <span className={`text-xs px-2 py-1 rounded ${
                              listType === "TODO"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                                : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                            }`}>
                              {ActionWord}
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {tickers.map(t => t.displayName).join(", ")}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-400 dark:text-zinc-500">
                            No one yet
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
                  No shared items in this list
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
              No items in this list
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
