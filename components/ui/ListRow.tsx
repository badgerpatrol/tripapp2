"use client";

import { ReactNode } from "react";
import { useLongPress } from "@/hooks/useLongPress";

export interface ListRowProps {
  /** Primary text (title/name) */
  primary: string;
  /** Secondary text (e.g., owner name) - optional */
  secondary?: string | null;
  /** Right-aligned count or chevron. Pass number for count, true for chevron, or undefined for nothing */
  trailing?: number | boolean;
  /** Click handler for tap */
  onClick?: () => void;
  /** Long press handler (for context menu) */
  onLongPress?: (e: React.Touch | React.MouseEvent) => void;
  /** Whether this row is the last in the list (hides divider) */
  isLast?: boolean;
  /** Additional content to render (rare use case) */
  children?: ReactNode;
}

/**
 * ListRow - Flat, iOS-style list row for premium list UI
 *
 * Features:
 * - Primary text (bold)
 * - Optional secondary text (muted)
 * - Right-aligned trailing: count number or chevron
 * - Long-press support for context menus
 * - ~56px height with 16px horizontal padding
 * - Subtle hairline divider
 */
export function ListRow({
  primary,
  secondary,
  trailing,
  onClick,
  onLongPress,
  isLast = false,
  children,
}: ListRowProps) {
  const longPressHandlers = useLongPress({
    onLongPress: onLongPress || (() => {}),
    onClick: onClick ? () => onClick() : undefined,
    delay: 500,
  });

  // Determine if we should use long press handlers or just onClick
  const hasLongPress = !!onLongPress;
  const interactionProps = hasLongPress
    ? longPressHandlers
    : { onClick };

  return (
    <div
      {...interactionProps}
      className={`
        flex items-center justify-between
        px-4 min-h-[56px] py-3
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
      {/* Left content: primary and secondary text */}
      <div className="flex-1 min-w-0 pr-3">
        <div className="font-semibold text-zinc-900 dark:text-white truncate">
          {primary}
        </div>
        {secondary && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
            {secondary}
          </div>
        )}
        {children}
      </div>

      {/* Right content: trailing indicator */}
      {trailing !== undefined && trailing !== false && (
        <div className="flex-shrink-0 flex items-center">
          {typeof trailing === "number" ? (
            <span className="text-sm text-zinc-400 dark:text-zinc-500 font-medium tabular-nums">
              {trailing}
            </span>
          ) : (
            // Chevron
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-300 dark:text-zinc-600"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

export default ListRow;
