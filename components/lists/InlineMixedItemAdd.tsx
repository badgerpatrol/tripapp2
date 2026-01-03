"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import QuickAddItemSheet from "./QuickAddItemSheet";
import QuickAddTodoItemSheet from "./QuickAddTodoItemSheet";

type ItemType = "TODO" | "KIT";

interface InlineMixedItemAddProps {
  templateId: string;
  templateTitle: string;
  onItemAdded: () => void;
}

export default function InlineMixedItemAdd({
  templateId,
  templateTitle,
  onItemAdded,
}: InlineMixedItemAddProps) {
  const { user } = useAuth();
  const [expandedType, setExpandedType] = useState<ItemType | null>(null);
  const [value, setValue] = useState("");
  const [isFullFormOpen, setIsFullFormOpen] = useState(false);
  const [fullFormType, setFullFormType] = useState<ItemType>("TODO");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when expanded
  useEffect(() => {
    if (expandedType) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [expandedType]);

  const handleQuickAdd = async () => {
    if (!user || !value.trim() || !expandedType) return;

    setIsSaving(true);

    try {
      const token = await user.getIdToken();

      const endpoint =
        expandedType === "TODO"
          ? `/api/lists/templates/${templateId}/todo-items`
          : `/api/lists/templates/${templateId}/kit-items`;

      const body =
        expandedType === "TODO"
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

      // Refocus the input for adding the next item
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
      setExpandedType(null);
      setValue("");
    }
  };

  const handleClose = () => {
    setExpandedType(null);
    setValue("");
  };

  const handleFullFormItemAdded = () => {
    onItemAdded();
    // Keep full form open for adding more items (the sheets handle this internally)
  };

  const openFullForm = (type: ItemType) => {
    setFullFormType(type);
    setIsFullFormOpen(true);
  };

  const label = expandedType === "TODO" ? "task" : "item";

  return (
    <>
      {expandedType ? (
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${
              expandedType === "TODO"
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
            }`}
          >
            {expandedType === "TODO" ? "Task" : "Item"}
          </span>
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
            className={`shrink-0 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed rounded-lg transition-colors ${
              expandedType === "TODO"
                ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                : "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
            }`}
          >
            Add
          </button>
          <button
            onClick={() => openFullForm(expandedType)}
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setExpandedType("TODO")}
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
            Add task
          </button>
          <button
            onClick={() => setExpandedType("KIT")}
            className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
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
            Add item
          </button>
        </div>
      )}

      {/* Full Form Sheets */}
      <QuickAddItemSheet
        isOpen={isFullFormOpen && fullFormType === "KIT"}
        onClose={() => setIsFullFormOpen(false)}
        templateId={templateId}
        templateTitle={templateTitle}
        isInventory={false}
        onItemAdded={handleFullFormItemAdded}
        initialLabel={value}
      />

      <QuickAddTodoItemSheet
        isOpen={isFullFormOpen && fullFormType === "TODO"}
        onClose={() => setIsFullFormOpen(false)}
        templateId={templateId}
        templateTitle={templateTitle}
        onItemAdded={handleFullFormItemAdded}
        initialLabel={value}
      />
    </>
  );
}
