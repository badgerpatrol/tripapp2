"use client";

import { SpendStatus } from "@/lib/generated/prisma";

export interface SpendFiltersProps {
  statusFilter: SpendStatus | "all";
  onStatusFilterChange: (status: SpendStatus | "all") => void;
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
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: SpendFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      {/* Status Filter */}
      <div>
        <label
          htmlFor="status-filter"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as SpendStatus | "all")}
          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value={SpendStatus.OPEN}>Open</option>
          <option value={SpendStatus.FINALIZED}>Finalized</option>
        </select>
      </div>

      {/* Sort Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sort By */}
        <div>
          <label
            htmlFor="sort-by"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Sort by
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as "date" | "amount" | "description")}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Order
          </label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as "asc" | "desc")}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="desc">
              {sortBy === "date" ? "Newest First" : "Highest First"}
            </option>
            <option value="asc">
              {sortBy === "date" ? "Oldest First" : "Lowest First"}
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}
