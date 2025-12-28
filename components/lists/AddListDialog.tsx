"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";
import { ListType, Visibility } from "@/lib/generated/prisma";

interface ListTemplate {
  id: string;
  ownerId?: string;
  title: string;
  description: string | null;
  type: ListType;
  listType: ListType;
  visibility?: Visibility;
  tags?: string[];
  todoItems?: any[];
  kitItems?: any[];
  owner?: {
    id: string;
    displayName: string | null;
  };
}

interface AddListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  onSuccess: () => void;
  listTypeFilter?: ListType; // If set, only show lists of this type
  existingListIds?: string[]; // IDs of list instances already on the trip
  existingSourceTemplateIds?: string[]; // Source template IDs of lists already on the trip
}

type MergeMode = "NEW_INSTANCE" | "REPLACE" | "MERGE_ADD" | "MERGE_ADD_ALLOW_DUPES";
type Tab = "create-new" | "my-templates" | "public-gallery";

export function AddListDialog({
  isOpen,
  onClose,
  tripId,
  onSuccess,
  listTypeFilter,
  existingListIds,
  existingSourceTemplateIds,
}: AddListDialogProps) {
  console.log("AddListDialog - existingListIds:", existingListIds);
  console.log("AddListDialog - existingSourceTemplateIds:", existingSourceTemplateIds);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("my-templates");
  const [myTemplates, setMyTemplates] = useState<ListTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<ListTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingMyTemplates, setLoadingMyTemplates] = useState(true);
  const [loadingPublicTemplates, setLoadingPublicTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // When listTypeFilter is set, force the type filter to that value
  const [typeFilter, setTypeFilter] = useState<ListType | "ALL">(listTypeFilter || "ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [mySearchQuery, setMySearchQuery] = useState("");

  // Create new list form state
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListType, setNewListType] = useState<ListType>(listTypeFilter || "TODO");

  useEffect(() => {
    if (isOpen && user) {
      // Fetch both on initial load
      fetchMyTemplates();
      fetchPublicTemplates();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && user) {
      if (activeTab === "my-templates") {
        fetchMyTemplates();
      } else {
        fetchPublicTemplates();
      }
    }
  }, [activeTab, typeFilter, isOpen, user]);

  // Conflict checking removed - multi-select always creates new instances

  const fetchMyTemplates = async () => {
    if (!user) return;

    setLoadingTemplates(true);
    setLoadingMyTemplates(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      // Exclude lists that were created in other trips (createdInTrip=false)
      const response = await fetch("/api/lists/templates?createdInTrip=false", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load templates");
      }

      const data = await response.json();
      setMyTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching my templates:", err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
      setLoadingMyTemplates(false);
    }
  };

  const fetchPublicTemplates = async () => {
    setLoadingTemplates(true);
    setLoadingPublicTemplates(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const response = await fetch(`/api/lists/templates/public?${params}`);

      if (!response.ok) {
        throw new Error("Failed to load public templates");
      }

      const data = await response.json();
      setPublicTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching public templates:", err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
      setLoadingPublicTemplates(false);
    }
  };

  const checkForConflict = async (templateId: string) => {
    if (!user || !templateId) return;

    // Find the selected template
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        title: template.title,
        type: template.type,
      });

      const response = await fetch(
        `/api/trips/${tripId}/lists/check-conflict?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check for conflicts");
      }

      const data = await response.json();
      return data.exists;
    } catch (err) {
      console.error("Error checking for conflict:", err);
      return false;
    }
  };

  const handleAddLists = async () => {
    if (!user || selectedTemplateIds.size === 0) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const templateIdsArray = Array.from(selectedTemplateIds);

      // Add all selected templates
      const results = await Promise.all(
        templateIdsArray.map(async (templateId) => {
          const response = await fetch(
            `/api/lists/templates/${templateId}/copy-to-trip`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                tripId,
                mode: "NEW_INSTANCE", // Always create new instances for multi-select
              }),
            }
          );

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to add list to trip");
          }
          return response.json();
        })
      );

      onSuccess();
      onClose();

      // Reset form
      setSelectedTemplateIds(new Set());
    } catch (err: any) {
      console.error("Error adding lists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewList = async () => {
    if (!user || !newListTitle.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/lists/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tripId,
          type: newListType,
          title: newListTitle.trim(),
          description: newListDescription.trim() || undefined,
          ...(newListType === "TODO" ? { todoItems: [] } : { kitItems: [] }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create list");
      }

      onSuccess();
      onClose();

      // Reset form
      setNewListTitle("");
      setNewListDescription("");
      setNewListType(listTypeFilter || "TODO");
    } catch (err: any) {
      console.error("Error creating list:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMyTemplates = myTemplates.filter((t) => {
    const matchesType = typeFilter === "ALL" ? true : t.type === typeFilter;
    const matchesSearch = mySearchQuery
      ? t.title.toLowerCase().includes(mySearchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(mySearchQuery.toLowerCase())
      : true;
    return matchesType && matchesSearch;
  });

  const templates = activeTab === "my-templates" ? filteredMyTemplates : publicTemplates;

  // Determine dialog title and tab labels based on listTypeFilter
  const dialogTitle = listTypeFilter === "TODO"
    ? "Add Checklist to Trip"
    : listTypeFilter === "KIT"
      ? "Add Kit List to Trip"
      : "Add List to Trip";

  const myTemplatesLabel = listTypeFilter === "TODO"
    ? "Mine"
    : listTypeFilter === "KIT"
      ? "Mine"
      : "My Lists";

  const publicGalleryLabel = "Public";

  const isCreateNewTab = activeTab === "create-new";
  const canSubmit = isCreateNewTab ? newListTitle.trim().length > 0 : selectedTemplateIds.size > 0;
  const selectedCount = selectedTemplateIds.size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={dialogTitle}
      size="full"
      footer={
        <>
          <Button
            onClick={onClose}
            className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={isCreateNewTab ? handleCreateNewList : handleAddLists}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading || !canSubmit}
          >
            {loading
              ? (isCreateNewTab ? "Creating..." : "Adding...")
              : (isCreateNewTab
                  ? "Create List"
                  : selectedCount === 1
                    ? "Add List"
                    : `Add ${selectedCount} Lists`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => {
              setActiveTab("my-templates");
              setSelectedTemplateIds(new Set());
            }}
            className={`flex-1 px-3 py-2 font-medium border-b-2 transition-colors text-sm ${
              activeTab === "my-templates"
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {myTemplatesLabel}
              {loadingMyTemplates ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              ) : (
                <span>({filteredMyTemplates.length})</span>
              )}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("public-gallery");
              setSelectedTemplateIds(new Set());
            }}
            className={`flex-1 px-3 py-2 font-medium border-b-2 transition-colors text-sm ${
              activeTab === "public-gallery"
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {publicGalleryLabel}
              {loadingPublicTemplates ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              ) : (
                <span>({publicTemplates.length})</span>
              )}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("create-new");
              setSelectedTemplateIds(new Set());
            }}
            className={`flex-1 px-3 py-2 font-medium border-b-2 transition-colors text-sm ${
              activeTab === "create-new"
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            New
          </button>
        </div>

        {/* Tab Content - fills remaining space */}
        <div className="flex-1 overflow-y-auto mt-4">
          {/* Create New Tab Content */}
          {activeTab === "create-new" && (
            <div className="space-y-4">
           

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                List Title *
              </label>
              <input
                type="text"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="e.g., Packing List, Pre-Trip Tasks"
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Brief description of this list"
                rows={2}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {/* Only show type selector when listTypeFilter is not set */}
            {!listTypeFilter && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  List Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="newListType"
                      value="TODO"
                      checked={newListType === "TODO"}
                      onChange={() => setNewListType("TODO")}
                      className="w-4 h-4 text-blue-600"
                      disabled={loading}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">✓ Checklist (TODO)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="newListType"
                      value="KIT"
                      checked={newListType === "KIT"}
                      onChange={() => setNewListType("KIT")}
                      className="w-4 h-4 text-green-600"
                      disabled={loading}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">🎒 Kit List</span>
                  </label>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Filters and Template Selection - only show for template tabs */}
          {activeTab !== "create-new" && (
          <>
            

            <div className="flex flex-wrap gap-3 mb-4">
              {activeTab === "my-templates" && (
                <input
                  type="text"
                  placeholder="Search my lists..."
                  value={mySearchQuery}
                  onChange={(e) => setMySearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                />
              )}

              {activeTab === "public-gallery" && (
                <input
                  type="text"
                  placeholder="Search public lists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPublicTemplates()}
                  className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                />
              )}

              {/* Only show type filter when listTypeFilter is not set */}
              {!listTypeFilter && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as ListType | "ALL")}
                  className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="TODO">TODO Lists</option>
                  <option value="KIT">Packing Lists</option>
                </select>
              )}

              {activeTab === "public-gallery" && searchQuery && (
                <Button
                  onClick={fetchPublicTemplates}
                  className="text-sm bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 px-4 py-2"
                >
                  Search
                </Button>
              )}
            </div>

            {/* Template Selection */}
        <div>
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600 dark:border-zinc-400"></div>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-8">
              {activeTab === "my-templates"
                ? "No templates yet. Create one from the Lists page!"
                : "No public templates found. Try adjusting your filters."}
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {templates.map((template) => {
                const inListIds = existingListIds?.includes(template.id);
                const inSourceIds = existingSourceTemplateIds?.includes(template.id);
                const isAlreadyOnTrip = inListIds || inSourceIds || false;
                console.log(`Template "${template.title}" (id: ${template.id}) - inListIds: ${inListIds}, inSourceIds: ${inSourceIds}, isAlreadyOnTrip: ${isAlreadyOnTrip}`);
                console.log(`  template.id type: ${typeof template.id}, value: "${template.id}"`);
                if (existingSourceTemplateIds && existingSourceTemplateIds.length > 0) {
                  console.log(`  existingSourceTemplateIds[0] type: ${typeof existingSourceTemplateIds[0]}, value: "${existingSourceTemplateIds[0]}"`);
                  console.log(`  Are they equal? ${template.id === existingSourceTemplateIds[0]}`);
                }

                return (
                  <label
                    key={template.id}
                    className={`flex items-start p-3 border-2 rounded-lg transition-colors ${
                      isAlreadyOnTrip
                        ? "opacity-50 cursor-not-allowed border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50"
                        : selectedTemplateIds.has(template.id)
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800 cursor-pointer"
                          : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={template.id}
                      checked={selectedTemplateIds.has(template.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedTemplateIds);
                        if (e.target.checked) {
                          newSet.add(template.id);
                        } else {
                          newSet.delete(template.id);
                        }
                        setSelectedTemplateIds(newSet);
                      }}
                      disabled={isAlreadyOnTrip}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`font-medium truncate mb-1 ${isAlreadyOnTrip ? "text-zinc-500 dark:text-zinc-500" : "text-zinc-900 dark:text-white"}`}>
                          {template.title}
                        </div>
                        {isAlreadyOnTrip && (
                          <span className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded whitespace-nowrap">
                            Already added
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {template.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                        <span>
                          {template.listType === "TODO"
                            ? `${template.todoItems?.length || 0} tasks`
                            : `${template.kitItems?.length || 0} items`}
                        </span>
                        {template.owner?.displayName && (
                          <span>by {template.owner.displayName}</span>
                        )}
                      </div>
                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                          {template.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-zinc-500">
                              +{template.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
            </div>

            </>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
