"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthContext";

interface ForkTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: {
    id: string;
    title: string;
    type: string;
  };
  onSuccess: () => void;
}

export function ForkTemplateDialog({
  isOpen,
  onClose,
  template,
  onSuccess,
}: ForkTemplateDialogProps) {
  const { user } = useAuth();
  const [newTitle, setNewTitle] = useState(`${template.title} (Copy)`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFork = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/lists/templates/${template.id}/fork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newTitle: newTitle.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fork template");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error forking template:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fork Template"
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
            onClick={handleFork}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={loading || !newTitle.trim()}
          >
            {loading ? "Forking..." : "Fork Template"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          Create a copy of <strong>{template.title}</strong> in your templates.
        </p>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            New Template Name
          </label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Enter new template name"
          />
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
