"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ListType } from "@/lib/generated/prisma";
import QuickAddItemSheet from "./QuickAddItemSheet";
import QuickAddTodoItemSheet from "./QuickAddTodoItemSheet";

interface InlineItemAddProps {
  listType: ListType;
  templateId: string;
  templateTitle: string;
  isInventory?: boolean;
  onItemAdded: () => void;
}

export default function InlineItemAdd({
  listType,
  templateId,
  templateTitle,
  isInventory = false,
  onItemAdded,
}: InlineItemAddProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [value, setValue] = useState("");
  const [isFullFormOpen, setIsFullFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isExpanded]);

  const handleQuickAdd = async () => {
    if (!user || !value.trim()) return;

    setIsSaving(true);

    try {
      const token = await user.getIdToken();

      const endpoint =
        listType === "TODO"
          ? `/api/lists/templates/${templateId}/todo-items`
          : `/api/lists/templates/${templateId}/kit-items`;

      const body =
        listType === "TODO"
          ? { label: value.trim(), orderIndex: 0 }
          : { label: value.trim(), quantity: 1, orderIndex: 0 };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to add item");
      }

      // Clear input for next item
      setValue("");

      // Refocus the input for adding the next item (before callback to ensure focus)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);

      // Notify parent to refresh data
      onItemAdded();
    } catch (err) {
      console.error("Error adding item:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      handleQuickAdd();
    } else if (e.key === "Escape") {
      setIsExpanded(false);
      setValue("");
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setValue("");
  };

  const handleFullFormItemAdded = () => {
    onItemAdded();
    // Keep full form open for adding more items (the sheets handle this internally)
  };

  const label = listType === "TODO" ? "task" : "item";

  return (
    <>
      {isExpanded ? (
        <div className="flex items-center gap-2 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`New ${label}...`}
            className="flex-1 min-w-0 px-3 py-2 text-base border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSaving}
          />
          <button
            onClick={handleQuickAdd}
            disabled={!value.trim() || isSaving}
            className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => setIsFullFormOpen(true)}
            className="shrink-0 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-500 rounded-lg transition-colors"
          >
            Full
          </button>
          <button
            onClick={handleClose}
            className="shrink-0 p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            title="Cancel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add {label}
        </button>
      )}

      {/* Full Form Sheets */}
      {listType === "KIT" && (
        <QuickAddItemSheet
          isOpen={isFullFormOpen}
          onClose={() => setIsFullFormOpen(false)}
          templateId={templateId}
          templateTitle={templateTitle}
          isInventory={isInventory}
          onItemAdded={handleFullFormItemAdded}
          initialLabel={value}
        />
      )}

      {listType === "TODO" && (
        <QuickAddTodoItemSheet
          isOpen={isFullFormOpen}
          onClose={() => setIsFullFormOpen(false)}
          templateId={templateId}
          templateTitle={templateTitle}
          onItemAdded={handleFullFormItemAdded}
          initialLabel={value}
        />
      )}
    </>
  );
}
