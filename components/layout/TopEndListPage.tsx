"use client";

import { ReactNode, useRef, useState, useEffect } from "react";

export interface TopEndListPageProps {
  /** Page title (e.g., "Kit", "Checklists") */
  title: string;
  /** Content to display to the right of the title */
  titleRight?: ReactNode;
  /** Whether title should collapse on scroll. Default: true */
  collapsibleTitle?: boolean;
  /** Sticky content below title (e.g., SegmentedControl, filters) */
  stickyContent?: ReactNode;
  /** Main scrollable list content */
  children: ReactNode;
  /** Floating action button component */
  fab?: ReactNode;
  /** Additional class names for the scroll container */
  scrollContainerClassName?: string;
}

/**
 * TopEndListPage - Reusable layout for list pages with:
 * - Works within the existing app shell (accounts for header pt-28)
 * - Collapsible title area
 * - Sticky control row (tabs, filters)
 * - Single scroll container for list content
 * - FAB anchored bottom-right with safe-area awareness
 *
 * Used by Kit, Checklists, and other list pages.
 */
export function TopEndListPage({
  title,
  titleRight,
  collapsibleTitle = true,
  stickyContent,
  children,
  fab,
  scrollContainerClassName = "",
}: TopEndListPageProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !collapsibleTitle) return;

    const handleScroll = () => {
      // Collapse title after 10px of scroll
      setIsScrolled(container.scrollTop > 10);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [collapsibleTitle]);

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] bg-zinc-50 dark:bg-zinc-900">
      {/* Fixed header area with title and sticky controls */}
      <div className="flex-shrink-0">
        {/* Collapsible title */}
        <div
          className={`px-4 transition-all duration-200 ease-in-out ${
            collapsibleTitle && isScrolled
              ? "h-0 opacity-0 overflow-hidden"
              : "pt-4 pb-2"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {title}
            </h1>
            {titleRight}
          </div>
        </div>

        {/* Compact title when collapsed */}
        {collapsibleTitle && (
          <div
            className={`px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 transition-all duration-200 ease-in-out ${
              isScrolled
                ? "opacity-100"
                : "h-0 opacity-0 overflow-hidden border-b-0"
            }`}
          >
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {title}
            </h1>
          </div>
        )}

        {/* Sticky content (tabs, filters, etc.) */}
        {stickyContent && (
          <div className="bg-zinc-50 dark:bg-zinc-900">
            {stickyContent}
          </div>
        )}
      </div>

      {/* Single scrollable container */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden ${scrollContainerClassName}`}
        style={{
          // Padding for FAB + safe area
          paddingBottom: fab ? "calc(80px + env(safe-area-inset-bottom, 0px))" : "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {children}
      </div>

      {/* Floating Action Button */}
      {fab}
    </div>
  );
}

export default TopEndListPage;
