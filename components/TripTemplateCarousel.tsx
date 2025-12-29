"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

interface ListTemplate {
  id: string;
  title: string;
  description: string | null;
  type: string;
  listType: string;
  todoItems?: any[];
  kitItems?: any[];
}

export default function TripTemplateCarousel() {
  const [templates, setTemplates] = useState<ListTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch("/api/lists/templates/trip-templates");
        if (!response.ok) {
          throw new Error("Failed to load trip templates");
        }
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, []);

  const handleSelectTemplate = async (templateId: string) => {
    try {
      if (!user) {
        router.push("/");
        return;
      }

      setCreating(templateId);
      const token = await user.getIdToken();

      // Create a new trip first
      const tripResponse = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: "New Trip",
          baseCurrency: "GBP",
        }),
      });

      if (!tripResponse.ok) {
        throw new Error("Failed to create trip");
      }

      const tripData = await tripResponse.json();
      const tripId = tripData.trip.id;

      // Copy the template to the trip
      const copyResponse = await fetch(
        `/api/lists/templates/${templateId}/copy-to-trip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tripId,
            mode: "NEW_INSTANCE",
          }),
        }
      );

      if (!copyResponse.ok) {
        throw new Error("Failed to copy template to trip");
      }

      // Redirect to the trip edit page
      router.push(`/trips/${tripId}`);
    } catch (err) {
      console.error("Error creating trip from template:", err);
      setError(err instanceof Error ? err.message : "Failed to create trip");
      setCreating(null);
    }
  };

  const handleBlankTrip = () => {
    router.push("/trips/new-v2");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-zinc-500 dark:text-zinc-400">Loading templates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blank trip button at the top */}
      <div className="flex justify-center">
        <Button
          onClick={handleBlankTrip}
          variant="secondary"
          className="min-w-[280px] sm:min-w-[320px]"
          leftIcon={
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
        >
          Start with a Blank Trip
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-zinc-500 dark:text-zinc-400">No trip templates available</div>
        </div>
      ) : (
        <>
          <div className="text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Or choose from a template
            </p>
          </div>

          <div className="relative w-full overflow-hidden">
            {/* Horizontal scroll container */}
            <div
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 pb-4"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  disabled={creating === template.id}
                  className="flex-shrink-0 w-[280px] sm:w-[320px] snap-center group"
                >
                  <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-zinc-200 dark:border-zinc-700 h-full min-h-[200px] flex flex-col justify-between">
                    {/* Type badge */}
                    <div className="flex justify-between items-start mb-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          template.listType === "TODO"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        }`}
                      >
                        {template.listType === "TODO" ? "To-Do List" : "Kit List"}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {template.listType === "TODO"
                          ? `${template.todoItems?.length || 0} items`
                          : `${template.kitItems?.length || 0} items`}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 text-left group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {template.title}
                    </h3>

                    {/* Description */}
                    {template.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 text-left line-clamp-3 mb-4">
                        {template.description}
                      </p>
                    )}

                    {/* Action indicator */}
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 text-left">
                      {creating === template.id ? (
                        <span>Creating trip...</span>
                      ) : (
                        <span>Click to start →</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Scroll hint gradient on edges */}
            <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none" />
          </div>
        </>
      )}
    </div>
  );
}
