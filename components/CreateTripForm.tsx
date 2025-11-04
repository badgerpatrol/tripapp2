"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { CreateTripSchema, type CreateTripInput } from "@/types/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

interface CreateTripFormProps {
  onSuccess?: (tripId: string) => void;
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

      // Success - redirect to trip page or call callback
      if (onSuccess) {
        onSuccess(result.trip.id);
      } else {
        router.push(`/trips/${result.trip.id}`);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
