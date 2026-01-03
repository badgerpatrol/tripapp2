"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminMode } from "@/lib/admin/AdminModeContext";
import { TopEndListPage } from "@/components/layout/TopEndListPage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { ListRow } from "@/components/ui/ListRow";
import { ListType, Visibility } from "@/lib/generated/prisma";

interface ListTemplate {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  type: ListType;
  listType: ListType;
  visibility: Visibility;
  displayMode: string | null;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdInTrip?: boolean;
  createdInTripName?: string | null;
  owner?: {
    id: string;
    displayName: string | null;
    email: string;
  };
  todoItems?: Array<{
    id: string;
    label: string;
    notes: string | null;
    orderIndex: number;
  }>;
  kitItems?: Array<{
    id: string;
    label: string;
    notes: string | null;
    quantity: number;
    orderIndex: number;
  }>;
}

type Tab = "my-templates" | "public-gallery";

function MixedListsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isAdminMode } = useAdminMode();

  // Initialize active tab from URL parameter if present
  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = tabParam === "public-gallery" ? "public-gallery" : "my-templates";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [myTemplates, setMyTemplates] = useState<ListTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<ListTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTripCreated, setShowTripCreated] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch both on initial load to get accurate counts
    fetchMyTemplates();
    fetchPublicTemplates();
  }, [user, isAdminMode]);

  useEffect(() => {
    if (!user) return;

    if (activeTab === "my-templates") {
      fetchMyTemplates();
    } else {
      fetchPublicTemplates();
    }
  }, [activeTab, isAdminMode, showTripCreated]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchMyTemplates = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (isAdminMode) params.set("adminMode", "true");
      // By default hide trip-created lists unless checkbox is checked
      if (!showTripCreated) params.set("createdInTrip", "false");

      const url = `/api/lists/templates${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      // Filter to only LIST type (mixed lists)
      const listTemplates = (data.templates || []).filter((t: ListTemplate) => t.type === "LIST");
      setMyTemplates(listTemplates);
    } catch (err: any) {
      console.error("Error fetching my templates:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      params.set("type", "LIST");

      const response = await fetch(`/api/lists/templates/public?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch public templates");
      }

      const data = await response.json();
      setPublicTemplates(data.templates || []);
    } catch (err: any) {
      console.error("Error fetching public templates:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = useCallback((template: ListTemplate) => {
    const returnTo = activeTab === "public-gallery"
      ? "/mixed-lists?tab=public-gallery"
      : "/mixed-lists";
    router.push(`/mixed-lists/${template.id}?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router, activeTab]);

  const handleFabClick = useCallback(() => {
    router.push("/mixed-lists/create");
  }, [router]);

  // Filter my templates by search query
  const filteredMyTemplates = myTemplates.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const templates = activeTab === "my-templates" ? filteredMyTemplates : publicTemplates;

  // Get item count for a mixed list
  const getItemCount = (template: ListTemplate) => {
    const todoCount = template.todoItems?.length || 0;
    const kitCount = template.kitItems?.length || 0;
    return todoCount + kitCount;
  };

  // Loading state for auth
  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  const segmentedOptions = [
    { value: "my-templates" as const, label: "My Lists", count: myTemplates.length },
    { value: "public-gallery" as const, label: "Public", count: publicTemplates.length },
  ];

  return (
    <>
      <TopEndListPage
        title="Mixed Lists"
        titleRight={
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showTripCreated}
              onChange={(e) => setShowTripCreated(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
            />
            Show from trips
          </label>
        }
        stickyContent={
          <div>
            <SegmentedControl
              options={segmentedOptions}
              value={activeTab}
              onChange={setActiveTab}
              aria-label="Mixed list sections"
            />

            {/* Search box - shown for all tabs */}
            <div className="px-4 py-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search lists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && activeTab === "public-gallery" && fetchPublicTemplates()}
                  className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
                {searchQuery && activeTab === "public-gallery" && (
                  <button
                    onClick={fetchPublicTemplates}
                    className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Search
                  </button>
                )}
              </div>
            </div>
          </div>
        }
        fab={
          activeTab === "my-templates" && (
            <FloatingActionButton
              onClick={handleFabClick}
              aria-label="New List"
            />
          )
        }
      >
        {/* Toast notification */}
        {toast && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-red-600 dark:text-red-400 text-center">
            {error}
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
            {activeTab === "my-templates" ? (
              <>
                <p className="mb-4">You don&apos;t have any mixed lists yet.</p>
                <button
                  onClick={handleFabClick}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Create Your First List
                </button>
              </>
            ) : (
              <p>No public mixed lists found.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {templates.map((template) => (
              <ListRow
                key={template.id}
                primary={template.title}
                secondary={`${getItemCount(template)} items${template.displayMode === "interleaved" ? " (interleaved)" : ""}${activeTab === "public-gallery" && template.owner ? ` by ${template.owner.displayName || "Unknown"}` : ""}`}
                trailing
                onClick={() => handleRowClick(template)}
              />
            ))}
          </div>
        )}
      </TopEndListPage>
    </>
  );
}

export default function MixedListsPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
        </div>
      }
    >
      <MixedListsPageContent />
    </Suspense>
  );
}
