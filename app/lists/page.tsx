"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
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
    quantity: number;
    category: string | null;
    orderIndex: number;
  }>;
}

type Tab = "my-templates" | "public-gallery";

function ListsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam || "my-templates");
  const [myTemplates, setMyTemplates] = useState<ListTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<ListTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const typeFilter: ListType = "TODO"; // Only show TODO lists, exclude kit lists
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch both on initial load to get accurate counts
    fetchMyTemplates();
    fetchPublicTemplates();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (activeTab === "my-templates") {
      fetchMyTemplates();
    } else {
      fetchPublicTemplates();
    }
  }, [activeTab, typeFilter]);

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
      const response = await fetch("/api/lists/templates", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setMyTemplates(data.templates || []);
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
      params.set("type", typeFilter); // Always filter for TODO lists only

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


  const getTypeIcon = (type: ListType) => {
    return type === "TODO" ? "✓" : "🎒";
  };

  const getTypeBadgeColor = (type: ListType) => {
    return type === "TODO"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  const filteredMyTemplates = myTemplates.filter((t) => t.type === typeFilter);

  const templates = activeTab === "my-templates" ? filteredMyTemplates : publicTemplates;

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                📋 Checklists
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Create and manage reusable TODO checklist templates
              </p>
            </div>
          </div>
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

        {/* Tabs */}
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-700 mb-6">
          <button
            onClick={() => setActiveTab("my-templates")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "my-templates"
                ? "border-zinc-600 text-zinc-900 dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            My Checklists ({myTemplates.length})
          </button>
          <button
            onClick={() => setActiveTab("public-gallery")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "public-gallery"
                ? "border-zinc-600 text-zinc-900 dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Public Gallery ({publicTemplates.length})
          </button>
        </div>

        {/* Filters */}
        {activeTab === "public-gallery" && (
          <div className="flex flex-wrap gap-4 mb-6">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPublicTemplates()}
              className="flex-1 min-w-[200px] px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />

            {searchQuery && (
              <Button
                onClick={fetchPublicTemplates}
                className="bg-zinc-600 hover:bg-zinc-700 text-white"
              >
                Search
              </Button>
            )}
          </div>
        )}

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

        {/* Templates Grid */}
        {!loading && templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400 text-lg">
              {activeTab === "my-templates"
                ? "No templates yet. Create your first one!"
                : "No public templates found. Try adjusting your filters."}
            </p>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <>
            {activeTab === "my-templates" && (
              <div className="mb-6 flex justify-end">
                <Button
                  onClick={() => window.location.href = "/lists/create-todo"}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  ✓ New Checklist
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => {
                  const returnTo = activeTab === "public-gallery"
                    ? "/lists?tab=public-gallery"
                    : "/lists";
                  router.push(`/lists/${template.id}?returnTo=${encodeURIComponent(returnTo)}`);
                }}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTypeIcon(template.type)}</span>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                      {template.title}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(template.type)}`}>
                    {template.type}
                  </span>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Creator */}
                {template.owner && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    By {template.owner.displayName || template.owner.email.split('@')[0]}
                  </div>
                )}

                {/* Stats */}
                <div className="flex gap-4 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  <span>
                    {template.type === "TODO"
                      ? `${template.todoItems?.length || 0} tasks`
                      : `${template.kitItems?.length || 0} items`}
                  </span>
                  {template.visibility === "PUBLIC" && (
                    <span className="flex items-center gap-1">
                      <span>🌐</span> Public
                    </span>
                  )}
                </div>

                {/* Tags */}
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs text-zinc-500">
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ListsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ListsPageContent />
    </Suspense>
  );
}
