"use client";

import { useId } from "react";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  /** Optional count to display in parentheses */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  /** Available options */
  options: SegmentedControlOption<T>[];
  /** Currently selected value */
  value: T;
  /** Called when selection changes */
  onChange: (value: T) => void;
  /** Accessible label for the control group */
  "aria-label"?: string;
}

/**
 * iOS-style segmented control with pill/button appearance
 * Used for tab-like navigation within a page
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel = "View options",
}: SegmentedControlProps<T>) {
  const id = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg mx-4 my-2"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            role="tab"
            aria-selected={isSelected}
            aria-controls={`${id}-panel-${option.value}`}
            onClick={() => onChange(option.value)}
            className={`
              flex-1 px-3 py-2 text-sm font-medium rounded-md
              transition-all duration-150 ease-in-out
              tap-target min-h-[36px]
              ${
                isSelected
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }
            `}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                ({option.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
