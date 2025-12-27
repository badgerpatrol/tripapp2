"use client";

import { Field, Input, Select } from "@/components/ui/field";
import type { StepProps } from "../types";
import { CURRENCY_OPTIONS } from "../types";

export default function Step2Details({
  state,
  updateState,
  error,
}: StepProps) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Field label="Location" htmlFor="location">
        <Input
          id="location"
          type="text"
          value={state.location}
          onChange={(e) => updateState({ location: e.target.value })}
          placeholder="e.g., Paris, France"
          autoFocus
        />
      </Field>

      <Field label="Base Currency" htmlFor="baseCurrency" required>
        <Select
          id="baseCurrency"
          value={state.baseCurrency}
          onChange={(e) => updateState({ baseCurrency: e.target.value })}
        >
          {CURRENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Used for expense tracking and settlements
        </p>
      </Field>
    </div>
  );
}
