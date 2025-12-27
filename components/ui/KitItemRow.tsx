"use client";

import { useLongPress } from "@/hooks/useLongPress";

export interface KitItemRowProps {
  /** Item name */
  label: string;
  /** Optional short descriptor (e.g., colour, material) - single line, muted */
  secondary?: string | null;
  /** Quantity (shown as ×N only if N ≠ 1) */
  quantity?: number;
  /** Click handler for tap */
  onClick?: () => void;
  /** Long press handler (for context menu) */
  onLongPress?: (e: React.Touch | React.MouseEvent) => void;
  /** Whether this row is the last in the list (hides divider) */
  isLast?: boolean;
}

/**
 * KitItemRow - Flat, minimal row for kit items
 *
 * Design rules:
 * - Primary line: item name (bold) with optional inline quantity (×N if N ≠ 1)
 * - Optional second line: short descriptive text (muted, single line)
 * - Max two lines per row
 * - No icons, badges, checkboxes, or status indicators
 * - Row height ~48-56px with 16px horizontal padding
 * - Subtle divider between rows
 * - Tap → open detail/edit, Long-press → context menu
 */
export function KitItemRow({
  label,
  secondary,
  quantity = 1,
  onClick,
  onLongPress,
  isLast = false,
}: KitItemRowProps) {
  const longPressHandlers = useLongPress({
    onLongPress: onLongPress || (() => {}),
    onClick: onClick ? () => onClick() : undefined,
    delay: 500,
  });

  const hasLongPress = !!onLongPress;
  const interactionProps = hasLongPress ? longPressHandlers : { onClick };

  return (
    <div
      {...interactionProps}
      className={`
        flex items-center
        px-4 min-h-[48px] py-3
        bg-white dark:bg-zinc-900
        ${!isLast ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
        active:bg-zinc-50 dark:active:bg-zinc-800
        cursor-pointer select-none
        transition-colors duration-100
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex-1 min-w-0">
        {/* Primary line: name + quantity */}
        <div className="font-semibold text-zinc-900 dark:text-white truncate">
          {label}
          {quantity !== 1 && (
            <span className="ml-1.5 font-normal text-zinc-500 dark:text-zinc-400">
              ×{quantity}
            </span>
          )}
        </div>
        {/* Secondary line: short descriptor */}
        {secondary && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            {secondary}
          </div>
        )}
      </div>
    </div>
  );
}

export default KitItemRow;
