"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminMode } from "@/lib/admin/AdminModeContext";
import { TopEndListPage } from "@/components/layout/TopEndListPage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { ListRow } from "@/components/ui/ListRow";
import { ContextMenu, ContextMenuItem } from "@/components/ContextMenu";
import { ListType, Visibility } from "@/lib/generated/prisma";

interface ListTemplate {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  type: ListType;
  listType: ListType;
  visibility: Visibility;
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdInTrip?: boolean;
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
}

type Tab = "my-templates" | "public-gallery";

function ListsPageContent() {
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
  const typeFilter: ListType = "TODO";
  const [showTripCreated, setShowTripCreated] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    template: ListTemplate | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, template: null });

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
  }, [activeTab, typeFilter, isAdminMode, showTripCreated]);

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
      // Filter to only TODO type
      const todoTemplates = (data.templates || []).filter((t: ListTemplate) => t.type === "TODO");
      setMyTemplates(todoTemplates);
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
      params.set("type", typeFilter);

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
      ? "/lists?tab=public-gallery"
      : "/lists";
    router.push(`/lists/${template.id}?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router, activeTab]);

  const handleLongPress = useCallback((template: ListTemplate, e: React.Touch | React.MouseEvent) => {
    const x = (e as { clientX: number }).clientX;
    const y = (e as { clientY: number }).clientY;
    setContextMenu({
      isOpen: true,
      position: { x, y },
      template,
    });
  }, []);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu.template) return [];

    const template = contextMenu.template;
    const isOwner = template.ownerId === user?.uid;

    const items: ContextMenuItem[] = [
      {
        label: "Open",
        onClick: () => handleRowClick(template),
      },
    ];

    if (isOwner) {
      items.push(
        {
          label: "Edit",
          onClick: () => router.push(`/lists/${template.id}/edit?returnTo=/lists`),
        },
        {
          label: "Duplicate",
          onClick: async () => {
            setToast({ message: "Duplicate coming soon", type: "success" });
          },
        },
        {
          label: "Delete",
          variant: "danger",
          onClick: async () => {
            setToast({ message: "Delete coming soon", type: "success" });
          },
        }
      );
    } else {
      items.push({
        label: "Copy to My Lists",
        onClick: async () => {
          setToast({ message: "Copy coming soon", type: "success" });
        },
      });
    }

    return items;
  }, [contextMenu.template, user?.uid, router, handleRowClick]);

  const handleFabClick = useCallback(() => {
    window.location.href = "/lists/create-todo";
  }, []);

  const templates = activeTab === "my-templates" ? myTemplates : publicTemplates;

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
    { value: "my-templates" as const, label: "My Checklists", count: myTemplates.length },
    { value: "public-gallery" as const, label: "Public", count: publicTemplates.length },
  ];

  return (
    <>
      <TopEndListPage
        title="Checklists"
        stickyContent={
          <div>
            <SegmentedControl
              options={segmentedOptions}
              value={activeTab}
              onChange={setActiveTab}
              aria-label="Checklist sections"
            />

            {/* Filters for My Checklists */}
            {activeTab === "my-templates" && (
              <div className="px-4 py-2">
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTripCreated}
                    onChange={(e) => setShowTripCreated(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                  />
                  Show lists created in trips
                </label>
              </div>
            )}

            {/* Search for Public Gallery */}
            {activeTab === "public-gallery" && (
              <div className="px-4 py-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search checklists..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchPublicTemplates()}
                    className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={fetchPublicTemplates}
                      className="px-3 py-2 text-sm font-medium bg-zinc-600 hover:bg-zinc-700 text-white rounded-lg"
                    >
                      Search
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        }
        fab={
          activeTab === "my-templates" && (
            <FloatingActionButton
              onClick={handleFabClick}
              aria-label="New checklist"
            />
          )
        }
      >
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

        {/* Error */}
        {error && (
          <div className="mx-4 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              {activeTab === "my-templates"
                ? "No checklists yet"
                : "No public checklists found"}
            </p>
            {activeTab === "my-templates" && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Create reusable TODO checklists for your trips
              </p>
            )}
            {activeTab === "public-gallery" && searchQuery && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Try adjusting your search terms
              </p>
            )}
          </div>
        )}

        {/* List Content */}
        {!loading && templates.length > 0 && (
          <div className="bg-white dark:bg-zinc-900">
            {templates.map((template, index) => (
              <ListRow
                key={template.id}
                primary={template.title}
                secondary={
                  activeTab === "public-gallery" && template.owner
                    ? `by ${template.owner.displayName || "Unknown"}`
                    : undefined
                }
                trailing={template.todoItems?.length ?? 0}
                onClick={() => handleRowClick(template)}
                onLongPress={(e) => handleLongPress(template, e)}
                isLast={index === templates.length - 1}
              />
            ))}
          </div>
        )}
      </TopEndListPage>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
        position={contextMenu.position}
        items={getContextMenuItems()}
      />
    </>
  );
}

export default function ListsPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    }>
      <ListsPageContent />
    </Suspense>
  );
}
