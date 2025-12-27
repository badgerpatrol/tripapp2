"use client";

import { ReactNode } from "react";

export interface FloatingActionButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Button label for accessibility */
  "aria-label": string;
  /** Icon or content inside the button */
  children?: ReactNode;
  /** Variant: 'primary' (default) or 'secondary' */
  variant?: "primary" | "secondary";
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Floating Action Button (FAB) - positioned bottom-right with safe-area awareness
 * Used for primary creation actions on list pages
 */
export function FloatingActionButton({
  onClick,
  "aria-label": ariaLabel,
  children,
  variant = "primary",
  disabled = false,
}: FloatingActionButtonProps) {
  const variantStyles = {
    primary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg",
    secondary: "bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-white shadow-lg",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        fixed z-30
        w-14 h-14 rounded-full
        flex items-center justify-center
        transition-all duration-150 ease-in-out
        ${variantStyles[variant]}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
      `}
      style={{
        right: "16px",
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}

export default FloatingActionButton;
