"use client";

import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  position?: { x: number; y: number };
  children?: React.ReactNode;
}

/**
 * ContextMenu component for displaying action menus
 * Supports touch and mouse interactions
 */
export function ContextMenu({ isOpen, onClose, items, position, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close menu on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate menu position to keep it within viewport
  const menuStyle: React.CSSProperties = position
    ? {
        position: "fixed",
        top: position.y,
        left: position.x,
        zIndex: 50,
      }
    : {
        position: "absolute",
        zIndex: 50,
      };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu */}
      <div
        ref={menuRef}
        style={menuStyle}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
        role="menu"
        aria-orientation="vertical"
      >
        {children ? (
          children
        ) : (
          items.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={`
                w-full text-left px-4 py-3 flex items-center gap-3 transition-colors
                ${
                  item.variant === "danger"
                    ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }
                ${item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                first:rounded-t-lg last:rounded-b-lg
              `}
              role="menuitem"
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}
