"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import TripAccessConfig from "@/components/TripAccessConfig";

interface ListTemplate {
  id: string;
  title: string;
  description: string | null;
  type: string;
  listType: string;
  todoItems?: any[];
  kitItems?: any[];
}

interface TripWizardStep2Props {
  tripId: string;
  onBack: () => void;
}

export default function TripWizardStep2({ tripId, onBack }: TripWizardStep2Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("GBP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Access mode state
  const [signUpMode, setSignUpMode] = useState(false);
  const [signInMode, setSignInMode] = useState(false);
  const [signUpPassword, setSignUpPassword] = useState("");

  // Header image state
  const [headerImageData, setHeaderImageData] = useState<string | null>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoLibraryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setHeaderImageData(base64);
      setHeaderImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setHeaderImageData(null);
    setHeaderImagePreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (photoLibraryInputRef.current) photoLibraryInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateTrip = async (): Promise<boolean> => {
    setError(null);
    setLoading(true);

    try {
      if (!user) {
        throw new Error("You must be signed in");
      }

      const needsPassword = signInMode || signUpMode;
      const updateData = {
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        baseCurrency: baseCurrency || "USD",
        signUpMode,
        signInMode,
        signUpPassword: needsPassword && signUpPassword.trim() ? signUpPassword.trim() : undefined,
        headerImageData: headerImageData || undefined,
      };

      const idToken = await user.getIdToken();

      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update trip");
      }

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
          }
        } catch (err) {
          console.error("Error copying template:", err);
        }
      }

      return true;
    } catch (err) {
      console.error("Error updating trip:", err);
      setError(err instanceof Error ? err.message : "Failed to update trip. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    const success = await updateTrip();
    if (success) {
      router.push(`/trips/${tripId}`);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Header Image */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Header Image
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Add a cover image that will appear at the top of your trip page
        </p>

        {headerImagePreview ? (
          <div className="relative">
            <div className="relative h-40 rounded-lg overflow-hidden">
              <img
                src={headerImagePreview}
                alt="Header preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
              title="Remove image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </button>

            <button
              type="button"
              onClick={() => photoLibraryInputRef.current?.click()}
              className="w-full px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Choose from Library
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-300 dark:border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                  or
                </span>
              </div>
            </div>

            <label className="w-full px-4 py-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageChange}
          className="hidden"
        />
        <input
          ref={photoLibraryInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
      </div>

      {/* Trip Access Configuration */}
      <TripAccessConfig
        signInMode={signInMode}
        signUpMode={signUpMode}
        signUpPassword={signUpPassword}
        onAccessChange={(config) => {
          setSignInMode(config.signInMode);
          setSignUpMode(config.signUpMode);
          setSignUpPassword(config.signUpPassword);
        }}
      />

      {/* Action Buttons - Back | Done */}
      <div className="flex gap-3 pt-4 min-w-0">
        <Button
          type="button"
          onClick={onBack}
          disabled={loading}
          variant="secondary"
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleDone}
          disabled={loading}
          loading={loading}
          variant="primary"
          className="flex-1"
        >
          Done
        </Button>
      </div>

      {/* Help text */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        All fields are optional. You can always update these later.
      </p>
    </div>
  );
}
