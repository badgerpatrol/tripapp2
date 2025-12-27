"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import type { StepProps } from "../types";

export default function Step1Basics({
  state,
  updateState,
  error,
}: StepProps) {
  // Validate end date is >= start date
  const handleStartDateChange = (value: string) => {
    updateState({ startDate: value });
    // Auto-update end date if it's before the new start date
    if (state.endDate && value && state.endDate < value) {
      updateState({ endDate: value });
    }
  };

  const handleEndDateChange = (value: string) => {
    updateState({ endDate: value });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Field label="Trip Name" htmlFor="name" required>
        <Input
          id="name"
          type="text"
          value={state.name}
          onChange={(e) => updateState({ name: e.target.value })}
          placeholder="e.g., Summer Vacation 2025"
          maxLength={200}
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Date & Time" htmlFor="startDate" required>
          <Input
            id="startDate"
            type="datetime-local"
            value={state.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </Field>

        <Field label="End Date & Time" htmlFor="endDate" required>
          <Input
            id="endDate"
            type="datetime-local"
            value={state.endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            min={state.startDate}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          value={state.description}
          onChange={(e) => updateState({ description: e.target.value.slice(0, 500) })}
          placeholder="Brief description of your trip..."
          rows={3}
          className="min-h-[80px] max-h-[100px] resize-none"
        />
        <div className="text-xs text-zinc-500 dark:text-zinc-400 text-right mt-1">
          {state.description.length}/500
        </div>
      </Field>
    </div>
  );
}
