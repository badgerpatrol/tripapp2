"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { zAddChoiceItemsConfig } from "@/types/sequence";

interface AddChoiceItemsAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

interface ChoiceItem {
  name: string;
  description?: string;
  price?: number;
}

export default function AddChoiceItemsAdapter({ run, step, runStep }: AddChoiceItemsAdapterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const config = zAddChoiceItemsConfig.parse(step.config || {});

  // Initialize with config items or empty array
  const [items, setItems] = useState<ChoiceItem[]>(
    config.items.length > 0 ? config.items : [{ name: "", description: "", price: undefined }]
  );
  const [submitting, setSubmitting] = useState(false);

  const choiceId = (run.payload as any)?.choiceId;

  const handleAddItem = () => {
    setItems([...items, { name: "", description: "", price: undefined }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ChoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choiceId) {
      alert("Choice ID not found. Please complete the previous step.");
      return;
    }

    // Filter out empty items
    const validItems = items.filter(item => item.name.trim());

    if (validItems.length === 0) {
      alert("Please add at least one item.");
      return;
    }

    setSubmitting(true);
    try {
      if (!user) return;
      const token = await user.getIdToken();

      // Create each choice item via API
      for (const item of validItems) {
        await fetch(`/api/choice-items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            choiceId,
            name: item.name,
            description: item.description || undefined,
            price: item.price || undefined,
          }),
        });
      }

      // Complete the step
      const completeResponse = await fetch(`/api/sequences/runs/${run.id}/steps/${runStep.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          result: { itemsAdded: validItems.length },
        }),
      });

      if (completeResponse.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to add choice items:", err);
      alert("Failed to add items. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!choiceId) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
        <p className="text-red-600">Missing choice information. Please complete the previous step.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
        Add Menu Items
      </h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Add items to your menu that people can choose from.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="p-4 border border-zinc-300 dark:border-zinc-600 rounded-md space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Item {index + 1}</h3>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="text-red-600 dark:text-red-400 text-sm hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">Name *</label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleItemChange(index, "name", e.target.value)}
                placeholder="e.g., Margherita Pizza"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
              <input
                type="text"
                value={item.description || ""}
                onChange={(e) => handleItemChange(index, "description", e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.price || ""}
                onChange={(e) => handleItemChange(index, "price", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        ))}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button type="button" onClick={handleAddItem} variant="secondary">
            Add Another Item
          </Button>
          <Button type="submit" variant="primary" size="lg" disabled={submitting}>
            {submitting ? "Saving..." : "Save Items"}
          </Button>
        </div>
      </form>
    </div>
  );
}
