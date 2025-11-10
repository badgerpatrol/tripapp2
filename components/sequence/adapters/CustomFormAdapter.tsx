"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { zCustomFormConfig } from "@/types/sequence";

interface CustomFormAdapterProps {
  run: any;
  step: any;
  runStep: any;
}

export default function CustomFormAdapter({ run, step, runStep }: CustomFormAdapterProps) {
  const router = useRouter();
  const { user } = useAuth();
  const config = zCustomFormConfig.parse(step.config || {});

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (key: string, value: any) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    for (const field of config.fields) {
      if (field.required && !formData[field.key]) {
        alert(`${field.label} is required`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (!user) return;
      const token = await user.getIdToken();

      // Complete the step with form data
      const completeResponse = await fetch(`/api/sequences/runs/${run.id}/steps/${runStep.id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          result: formData,
          payloadPatch: { [`custom_${step.id}`]: formData },
        }),
      });

      if (completeResponse.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to submit form:", err);
      alert("Failed to submit form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
        Additional Information
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {config.fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>

            {field.type === "short_text" && (
              <input
                type="text"
                id={field.key}
                value={formData[field.key] || ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                required={field.required}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            )}

            {field.type === "long_text" && (
              <textarea
                id={field.key}
                value={formData[field.key] || ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                required={field.required}
                rows={4}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            )}

            {field.type === "number" && (
              <input
                type="number"
                id={field.key}
                value={formData[field.key] || ""}
                onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value))}
                required={field.required}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            )}

            {field.type === "date" && (
              <input
                type="date"
                id={field.key}
                value={formData[field.key] || ""}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                required={field.required}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            )}
          </div>
        ))}

        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? "Saving..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}
