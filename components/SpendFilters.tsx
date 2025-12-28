"use client";

import { SpendStatus } from "@/lib/generated/prisma";

export interface SpendFiltersProps {
  statusFilter: SpendStatus | "all";
  onStatusFilterChange: (status: SpendStatus | "all") => void;
  involvementFilter: "all" | "own" | "involved" | "not-involved";
  onInvolvementFilterChange: (filter: "all" | "own" | "involved" | "not-involved") => void;
  sortBy: "date" | "amount" | "description";
  onSortByChange: (sortBy: "date" | "amount" | "description") => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (sortOrder: "asc" | "desc") => void;
}

/**
 * SpendFilters component for filtering and sorting spend list
 * Mobile-optimized with clear, accessible controls
 */
export function SpendFilters({
  statusFilter,
  onStatusFilterChange,
  involvementFilter,
  onInvolvementFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: SpendFiltersProps) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5 space-y-2">
      {/* Filter Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Status Filter */}
        <div>
          <label
            htmlFor="status-filter"
            className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as SpendStatus | "all")}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value={SpendStatus.OPEN}>Open</option>
            <option value={SpendStatus.CLOSED}>Closed</option>
          </select>
        </div>

        {/* Involvement Filter */}
        <div>
          <label
            htmlFor="involvement-filter"
            className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
          >
            Involvement
          </label>
          <select
            id="involvement-filter"
            value={involvementFilter}
            onChange={(e) => onInvolvementFilterChange(e.target.value as "all" | "own" | "involved" | "not-involved")}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="own">My Own</option>
            <option value="involved">Involved</option>
            <option value="not-involved">Not Involved</option>
          </select>
        </div>
      </div>

      {/* Sort Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Sort By */}
        <div>
          <label
            htmlFor="sort-by"
            className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
          >
            Sort by
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as "date" | "amount" | "description")}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="description">Description</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label
            htmlFor="sort-order"
            className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
          >
            Order
          </label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as "asc" | "desc")}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="desc">
              {sortBy === "date" ? "Newest" : "Highest"}
            </option>
            <option value="asc">
              {sortBy === "date" ? "Oldest" : "Lowest"}
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}
