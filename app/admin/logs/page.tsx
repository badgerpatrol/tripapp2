"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { LogSeverity } from "@/lib/generated/prisma";

interface SystemLog {
  id: string;
  datetime: string;
  severity: LogSeverity;
  feature: string;
  eventName: string;
  eventText: string;
  metadata?: any;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function AdminLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<LogSeverity | "">("");
  const [featureFilter, setFeatureFilter] = useState("");
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [eventTextFilter, setEventTextFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Selection states
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Modal state
  const [viewingLog, setViewingLog] = useState<SystemLog | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, pagination.page]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchLogs = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (severityFilter) params.set("severity", severityFilter);
      if (featureFilter) params.set("feature", featureFilter);
      if (eventNameFilter) params.set("eventName", eventNameFilter);
      if (eventTextFilter) params.set("eventText", eventTextFilter);
      if (startDateFilter) params.set("startDate", new Date(startDateFilter).toISOString());
      if (endDateFilter) params.set("endDate", new Date(endDateFilter).toISOString());

      const response = await fetch(`/api/admin/logs?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch logs");
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
      setSelectedLogs(new Set());
      setSelectAll(false);
    } catch (err: any) {
      console.error("Error fetching logs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const handleClearFilters = () => {
    setSeverityFilter("");
    setFeatureFilter("");
    setEventNameFilter("");
    setEventTextFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setTimeout(fetchLogs, 0);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(logs.map((log) => log.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleToggleLog = (logId: string) => {
    const newSelected = new Set(selectedLogs);
    if (newSelected.has(logId)) {
      newSelected.delete(logId);
    } else {
      newSelected.add(logId);
    }
    setSelectedLogs(newSelected);
    setSelectAll(newSelected.size === logs.length && logs.length > 0);
  };

  const handleDeleteSelected = async () => {
    if (selectedLogs.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedLogs.size} log(s)?`)) {
      return;
    }

    try {
      const token = await user!.getIdToken();
      const response = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedLogs),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete logs");
      }

      const data = await response.json();
      setToast({ message: `Deleted ${data.deletedCount} log(s)`, type: "success" });
      fetchLogs();
    } catch (err: any) {
      console.error("Error deleting logs:", err);
      setToast({ message: err.message, type: "error" });
    }
  };

  const handleClearAllLogs = async () => {
    if (!confirm("Are you sure you want to DELETE ALL LOGS? This action cannot be undone!")) {
      return;
    }

    try {
      const token = await user!.getIdToken();
      const response = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteAll: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to clear logs");
      }

      const data = await response.json();
      setToast({ message: `Deleted all ${data.deletedCount} log(s)`, type: "success" });
      fetchLogs();
    } catch (err: any) {
      console.error("Error clearing logs:", err);
      setToast({ message: err.message, type: "error" });
    }
  };

  const getSeverityColor = (severity: LogSeverity) => {
    switch (severity) {
      case "ERROR":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "WARNING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "INFO":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "DEBUG":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
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
            System Logs
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            View and manage system logs (Admin only)
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800"
            }`}
          >
            <p
              className={
                toast.type === "success"
                  ? "text-green-800 dark:text-green-200"
                  : "text-red-800 dark:text-red-200"
              }
            >
              {toast.message}
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-6 mb-6 border border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as LogSeverity | "")}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Feature
              </label>
              <input
                type="text"
                value={featureFilter}
                onChange={(e) => setFeatureFilter(e.target.value)}
                placeholder="e.g., auth, spend, trip"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={eventNameFilter}
                onChange={(e) => setEventNameFilter(e.target.value)}
                placeholder="e.g., user_login"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Event Text
              </label>
              <input
                type="text"
                value={eventTextFilter}
                onChange={(e) => setEventTextFilter(e.target.value)}
                placeholder="Search in event text"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <Button
              onClick={handleApplyFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Apply Filters
            </Button>
            <Button
              onClick={handleClearFilters}
              className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={handleSelectAll}
            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
          >
            {selectAll ? "Deselect All" : "Select All"}
          </Button>
          <Button
            onClick={handleDeleteSelected}
            disabled={selectedLogs.size === 0}
            className="bg-red-600 hover:bg-red-700 text-white disabled:bg-zinc-400 disabled:cursor-not-allowed"
          >
            Delete Selected ({selectedLogs.size})
          </Button>
          <Button
            onClick={handleClearAllLogs}
            className="bg-red-800 hover:bg-red-900 text-white"
          >
            Clear All Logs
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

        {/* Logs Table */}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400 text-lg">No logs found</p>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden border border-zinc-200 dark:border-zinc-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                  <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Select
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Feature
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Event Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Event Text
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                        onClick={(e) => {
                          // Don't open modal if clicking on checkbox
                          const target = e.target as HTMLElement;
                          if (target.tagName !== 'INPUT') {
                            setViewingLog(log);
                          }
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedLogs.has(log.id)}
                            onChange={() => handleToggleLog(log.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-white">
                          {new Date(log.datetime).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityColor(
                              log.severity
                            )}`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-white">
                          {log.feature}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-white">
                          {log.eventName}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-900 dark:text-white max-w-md truncate">
                          {log.eventText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
                {pagination.totalCount} logs
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </Button>
                <div className="flex items-center px-4 py-2 text-sm text-zinc-900 dark:text-white">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <Button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Log Detail Modal */}
        {viewingLog && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingLog(null)}
          >
            <div
              className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Log Details
                </h2>
                <button
                  onClick={() => setViewingLog(null)}
                  className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6 space-y-6">
                {/* ID */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Log ID
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700 font-mono">
                    {viewingLog.id}
                  </div>
                </div>

                {/* Date/Time */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Date & Time
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700">
                    {new Date(viewingLog.datetime).toLocaleString()}
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Severity
                  </label>
                  <div>
                    <span
                      className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getSeverityColor(
                        viewingLog.severity
                      )}`}
                    >
                      {viewingLog.severity}
                    </span>
                  </div>
                </div>

                {/* Feature */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Feature
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700">
                    {viewingLog.feature}
                  </div>
                </div>

                {/* Event Name */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Event Name
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded border border-zinc-200 dark:border-zinc-700">
                    {viewingLog.eventName}
                  </div>
                </div>

                {/* Event Text */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Event Text
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded border border-zinc-200 dark:border-zinc-700 whitespace-pre-wrap break-words">
                    {viewingLog.eventText}
                  </div>
                </div>

                {/* Metadata */}
                {viewingLog.metadata && (
                  <div>
                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                      Metadata
                    </label>
                    <div className="text-sm text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded border border-zinc-200 dark:border-zinc-700 font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-words">
                        {JSON.stringify(viewingLog.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 px-6 py-4 flex justify-end">
                <Button
                  onClick={() => setViewingLog(null)}
                  className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
