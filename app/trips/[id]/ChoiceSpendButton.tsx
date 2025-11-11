"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

interface ChoiceSpendButtonProps {
  choiceId: string;
  onOpenSpend: (spendId: string) => void;
  className?: string;
}

export default function ChoiceSpendButton({
  choiceId,
  onOpenSpend,
  className = "",
}: ChoiceSpendButtonProps) {
  const { user } = useAuth();
  const [linkedSpendId, setLinkedSpendId] = useState<string | null>(null);
  const [hasLinkedSpend, setHasLinkedSpend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchLinkedSpend();
  }, [choiceId]);

  const fetchLinkedSpend = async () => {
    if (!user || !choiceId) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/linked-spend`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await response.json();
      setHasLinkedSpend(data.hasSpend);
      setLinkedSpendId(data.spendId);
    } catch (err) {
      console.error("Failed to fetch linked spend:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpend = async () => {
    if (!user || !choiceId) return;

    if (!confirm(`Create a spend for this choice?`)) return;

    setCreating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/choices/${choiceId}/create-spend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ mode: "byItem" }),
      });

      if (!response.ok) throw new Error("Failed to create spend");

      const data = await response.json();

      // Update linked spend state
      setHasLinkedSpend(true);
      setLinkedSpendId(data.spendId);

      // Open the spend dialog
      onOpenSpend(data.spendId);
    } catch (err) {
      console.error("Failed to create spend:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleGoToSpend = () => {
    if (linkedSpendId) {
      onOpenSpend(linkedSpendId);
    }
  };

  if (loading) {
    return null;
  }

  if (hasLinkedSpend) {
    return (
      <button
        onClick={handleGoToSpend}
        className={`px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap ${className}`}
      >
        👉 Go to Spend
      </button>
    );
  }

  return (
    <button
      onClick={handleCreateSpend}
      disabled={creating}
      className={`px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap ${className}`}
    >
      {creating ? "Creating..." : "💰 Create Spend"}
    </button>
  );
}
