"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { ListType, Visibility } from "@/lib/generated/prisma";
import { ForkTemplateDialog } from "@/components/lists/ForkTemplateDialog";
import { CopyToTripDialog } from "@/components/lists/CopyToTripDialog";
import { CreateTemplateDialog } from "@/components/lists/CreateTemplateDialog";

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

export default function ListsPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("my-templates");
  const [myTemplates, setMyTemplates] = useState<ListTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<ListTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ListType | "ALL">("ALL");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Dialog states
  const [forkDialog, setForkDialog] = useState<{ isOpen: boolean; template: ListTemplate | null }>({
    isOpen: false,
    template: null,
  });
  const [copyDialog, setCopyDialog] = useState<{ isOpen: boolean; template: ListTemplate | null }>({
    isOpen: false,
    template: null,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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
      if (typeFilter !== "ALL") params.set("type", typeFilter);

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

  const handleForkSuccess = () => {
    setToast({ message: "Template forked successfully!", type: "success" });
    setActiveTab("my-templates");
  };

  const handleCopySuccess = () => {
    setToast({ message: "Template copied to trip!", type: "success" });
  };

  const handleCreateSuccess = () => {
    setToast({ message: "Template created successfully!", type: "success" });
    fetchMyTemplates();
  };

  const getTypeIcon = (type: ListType) => {
    return type === "TODO" ? "✓" : "🎒";
  };

  const getTypeBadgeColor = (type: ListType) => {
    return type === "TODO"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  const filteredMyTemplates = myTemplates.filter((t) =>
    typeFilter === "ALL" ? true : t.type === typeFilter
  );

  const templates = activeTab === "my-templates" ? filteredMyTemplates : publicTemplates;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                📋 Lists
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Create reusable TODO and packing list templates
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => window.location.href = "/trips"}
                className="bg-zinc-600 hover:bg-zinc-700 text-white"
              >
                ← Trips
              </Button>
              <Button
                onClick={() => window.location.href = "/lists/create-todo"}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                ✓ New TODO List
              </Button>
              <Button
                onClick={() => alert("Kit list creation coming soon!")}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                🎒 New Kit List
              </Button>
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
        <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab("my-templates")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "my-templates"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            My Templates ({myTemplates.length})
          </button>
          <button
            onClick={() => setActiveTab("public-gallery")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "public-gallery"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Public Gallery ({publicTemplates.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {activeTab === "public-gallery" && (
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPublicTemplates()}
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          )}

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ListType | "ALL")}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="ALL">All Types</option>
            <option value="TODO">TODO Lists</option>
            <option value="KIT">Packing Lists</option>
          </select>

          {activeTab === "public-gallery" && searchQuery && (
            <Button
              onClick={fetchPublicTemplates}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Search
            </Button>
          )}
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Templates Grid */}
        {!loading && templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {activeTab === "my-templates"
                ? "No templates yet. Create your first one!"
                : "No public templates found. Try adjusting your filters."}
            </p>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 dark:border-gray-700"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTypeIcon(template.type)}</span>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {template.title}
                    </h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(template.type)}`}>
                    {template.type}
                  </span>
                </div>

                {/* Description */}
                {template.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
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
                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {activeTab === "my-templates" ? (
                    <>
                      <Button
                        onClick={() => alert("Edit template - Coming soon!")}
                        className="flex-1 text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900 dark:hover:bg-indigo-800 dark:text-indigo-200"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => setCopyDialog({ isOpen: true, template })}
                        className="flex-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200"
                      >
                        Use
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => setForkDialog({ isOpen: true, template })}
                        className="flex-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                      >
                        Fork
                      </Button>
                      <Button
                        onClick={() => setCopyDialog({ isOpen: true, template })}
                        className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Use
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {forkDialog.template && (
        <ForkTemplateDialog
          isOpen={forkDialog.isOpen}
          onClose={() => setForkDialog({ isOpen: false, template: null })}
          template={forkDialog.template}
          onSuccess={handleForkSuccess}
        />
      )}

      {copyDialog.template && (
        <CopyToTripDialog
          isOpen={copyDialog.isOpen}
          onClose={() => setCopyDialog({ isOpen: false, template: null })}
          template={copyDialog.template}
          onSuccess={handleCopySuccess}
        />
      )}

      <CreateTemplateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
