"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { CreateTripSchema, type CreateTripInput } from "@/types/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

interface ListTemplate {
  id: string;
  title: string;
  description: string | null;
  type: string;
  listType: string;
  todoItems?: any[];
  kitItems?: any[];
}

interface CreateTripFormProps {
  onSuccess?: (tripId: string, hadTemplate: boolean) => void;
  onCancel?: () => void;
}

export default function CreateTripForm({ onSuccess, onCancel }: CreateTripFormProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("GBP");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template selection state
  const [templates, setTemplates] = useState<ListTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Load trip templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch("/api/lists/templates/trip-templates");
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates || []);
        }
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setTemplatesLoading(false);
      }
    }
    loadTemplates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!user) {
        throw new Error("You must be signed in to create a trip");
      }

      // Prepare form data
      const formData: CreateTripInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        baseCurrency: baseCurrency || "USD",
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      };

      // Validate with Zod
      const validation = CreateTripSchema.safeParse(formData);
      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message || "Invalid trip data");
      }

      // Get Firebase ID token
      const idToken = await user.getIdToken();

      // Call API
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create trip");
      }

      const tripId = result.trip.id;

      // If a template was selected, copy it to the trip
      if (selectedTemplateId) {
        try {
          const copyResponse = await fetch(
            `/api/lists/templates/${selectedTemplateId}/copy-to-trip`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                tripId,
                mode: "NEW_INSTANCE",
              }),
            }
          );

          if (!copyResponse.ok) {
            console.error("Failed to copy template to trip");
            // Don't throw error - trip was created successfully
          }
        } catch (err) {
          console.error("Error copying template:", err);
          // Don't throw error - trip was created successfully
        }
      }

      // Success - redirect to trip page or call callback
      if (onSuccess) {
        onSuccess(tripId, selectedTemplateId !== null);
      } else {
        router.push(`/trips/${tripId}`);
      }
    } catch (err) {
      console.error("Error creating trip:", err);
      setError(err instanceof Error ? err.message : "Failed to create trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Template Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Choose a starting point
        </label>

        {templatesLoading ? (
          <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm">
            Loading templates...
          </div>
        ) : (
          <div className="relative w-full overflow-hidden">
            <div
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {/* "Do your own thing" default option */}
              <button
                type="button"
                onClick={() => setSelectedTemplateId(null)}
                className={`flex-shrink-0 w-[200px] snap-center transition-all ${
                  selectedTemplateId === null
                    ? "ring-2 ring-blue-500 dark:ring-blue-400"
                    : ""
                }`}
              >
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border-2 border-zinc-200 dark:border-zinc-700 h-full min-h-[120px] flex flex-col justify-center items-center">
                  <div className="text-3xl mb-2">✨</div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 text-center">
                    Do Your Own Thing
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center mt-1">
                    Start from scratch
                  </p>
                </div>
              </button>

              {/* Template options */}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`flex-shrink-0 w-[200px] snap-center transition-all ${
                    selectedTemplateId === template.id
                      ? "ring-2 ring-blue-500 dark:ring-blue-400"
                      : ""
                  }`}
                >
                  <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border-2 border-zinc-200 dark:border-zinc-700 h-full min-h-[120px] flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            template.listType === "TODO"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          }`}
                        >
                          {template.listType === "TODO" ? "To-Do" : "Kit"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 text-left line-clamp-2">
                        {template.title}
                      </h3>
                    </div>
                    {template.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 text-left line-clamp-2 mt-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Scroll hint gradients */}
            {templates.length > 0 && (
              <>
                <div className="absolute top-0 left-0 bottom-0 w-6 bg-gradient-to-r from-zinc-50 dark:from-zinc-900 to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-zinc-50 dark:from-zinc-900 to-transparent pointer-events-none" />
              </>
            )}
          </div>
        )}
      </div>

      {/* Trip Name */}
      <Field label="Trip Name" htmlFor="name" required>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g., Summer Vacation 2025"
        />
      </Field>

      {/* Location */}
      <Field label="Location" htmlFor="location">
        <Input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., Paris, France"
        />
      </Field>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
        <Field label="Start Date" htmlFor="startDate">
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>

        <Field label="End Date" htmlFor="endDate">
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
          />
        </Field>
      </div>

      {/* Base Currency */}
      <Field label="Base Currency" htmlFor="baseCurrency">
        <Select
          id="baseCurrency"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
        >
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
          <option value="JPY">JPY - Japanese Yen</option>
          <option value="AUD">AUD - Australian Dollar</option>
          <option value="CAD">CAD - Canadian Dollar</option>
          <option value="CHF">CHF - Swiss Franc</option>
          <option value="CNY">CNY - Chinese Yuan</option>
          <option value="INR">INR - Indian Rupee</option>
          <option value="NZD">NZD - New Zealand Dollar</option>
        </Select>
      </Field>

      {/* Description */}
      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Add any details about your trip..."
        />
      </Field>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2 min-w-0">
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            disabled={loading}
            variant="secondary"
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !name.trim()}
          loading={loading}
          variant="primary"
          className="flex-1"
        >
          {loading ? "Creating..." : "Create Trip"}
        </Button>
      </div>
    </form>
  );
}
