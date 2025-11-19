'use client';

import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { Tag } from '@/types/tag';
import { useTags } from '@/hooks/useTags';

export interface SimpleTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * SimpleTagInput - Tag input component for forms (without entity persistence)
 *
 * This component is designed for use in create/edit forms where tags are stored
 * as a simple string array in form state, rather than being persisted to the database
 * as entity associations.
 *
 * Features:
 * - Typeahead search with case-insensitive "contains" matching
 * - Create new tags on the fly
 * - Keyboard navigation (Arrow keys, Enter, Esc)
 * - ARIA combobox pattern for accessibility
 * - Mobile-first responsive design
 */
export function SimpleTagInput({
  value = [],
  onChange,
  placeholder = 'Add tags...',
  className,
  disabled = false,
}: SimpleTagInputProps) {
  const [input, setInput] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Global tags for suggestions
  const { tags: allTags, isLoading: tagsLoading } = useTags();

  // Convert selected tag names to display format
  const selectedTagNames = new Set(value.map(t => t.toLowerCase()));

  // Filter and sort suggestions, and determine if we can create new
  const { suggestions, canCreateNew } = React.useMemo(() => {
    if (!input.trim()) return { suggestions: [], canCreateNew: false };

    const trimmedInput = input.trim().toLowerCase();

    // Debug logging
    console.log('SimpleTagInput debug:', {
      input: trimmedInput,
      allTagsCount: allTags.length,
      allTagNames: allTags.map(t => t.name),
      selectedTags: Array.from(selectedTagNames)
    });

    // Filter out already selected tags and match by contains
    const filtered = allTags
      .filter(tag => !selectedTagNames.has(tag.name.toLowerCase()))
      .filter(tag => tag.name.toLowerCase().includes(trimmedInput));

    // Sort: exact matches first, then starts-with, then by usage count
    const sortedSuggestions = filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Exact match
      if (aName === trimmedInput) return -1;
      if (bName === trimmedInput) return 1;

      // Starts with
      const aStarts = aName.startsWith(trimmedInput);
      const bStarts = bName.startsWith(trimmedInput);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Usage count (higher first)
      return (b.usageCount || 0) - (a.usageCount || 0);
    });

    // Check if we can create a new tag (exact match doesn't exist anywhere)
    const existsExactMatch = allTags.some(
      tag => tag.name.toLowerCase() === trimmedInput
    );
    const existsInSelected = selectedTagNames.has(trimmedInput);

    console.log('SimpleTagInput result:', {
      suggestionsCount: sortedSuggestions.length,
      suggestions: sortedSuggestions.map(s => s.name),
      existsExactMatch,
      existsInSelected,
      canCreateNew: !existsExactMatch && !existsInSelected
    });

    return {
      suggestions: sortedSuggestions,
      canCreateNew: !existsExactMatch && !existsInSelected
    };
  }, [input, allTags, selectedTagNames]);

  // Handle tag selection
  const handleSelectTag = (tag: Tag) => {
    const newTags = [...value, tag.name];
    onChange(newTags);
    setInput('');
    setHighlightIndex(0);
    inputRef.current?.focus();
  };

  // Handle create new tag
  const handleCreateTag = () => {
    if (!canCreateNew) return;

    const trimmedInput = input.trim();
    const newTags = [...value, trimmedInput];
    onChange(newTags);
    setInput('');
    setHighlightIndex(0);
    inputRef.current?.focus();
  };

  // Handle tag removal
  const handleRemoveTag = (tagName: string) => {
    const newTags = value.filter(t => t !== tagName);
    onChange(newTags);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    const totalItems = suggestions.length + (canCreateNew ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex(prev => (prev + 1) % totalItems);
        break;

      case 'ArrowUp':
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;

      case 'Enter':
        e.preventDefault();
        if (!isOpen || totalItems === 0) return;

        if (highlightIndex < suggestions.length) {
          handleSelectTag(suggestions[highlightIndex]);
        } else if (canCreateNew) {
          handleCreateTag();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setInput('');
        setHighlightIndex(0);
        break;

      case ',':
        // Allow comma-separated input
        e.preventDefault();
        if (input.trim()) {
          handleCreateTag();
        }
        break;

      default:
        break;
    }
  };

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedItem = listRef.current.children[highlightIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightIndex, isOpen]);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Selected tags (chips) */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map(tagName => (
            <div
              key={tagName}
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm',
                'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100',
                'border border-blue-200 dark:border-blue-800',
                disabled && 'opacity-60'
              )}
            >
              <span>{tagName}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tagName)}
                disabled={disabled}
                className={clsx(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full',
                  'hover:bg-blue-200 dark:hover:bg-blue-800',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  'transition-colors',
                  disabled && 'cursor-not-allowed'
                )}
                aria-label={`Remove ${tagName}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input with typeahead */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || tagsLoading}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border',
            'bg-white dark:bg-zinc-800',
            'border-zinc-300 dark:border-zinc-600',
            'text-zinc-900 dark:text-white',
            'placeholder:text-zinc-500 dark:placeholder:text-zinc-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'transition-colors'
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="tag-suggestions"
          aria-activedescendant={isOpen ? `tag-option-${highlightIndex}` : undefined}
          aria-label="Search and select tags"
        />

        {/* Suggestions dropdown */}
        {isOpen && (suggestions.length > 0 || canCreateNew) && (
          <ul
            ref={listRef}
            id="tag-suggestions"
            role="listbox"
            className={clsx(
              'absolute z-50 w-full mt-1 py-1 rounded-lg border shadow-lg',
              'bg-white dark:bg-zinc-800',
              'border-zinc-200 dark:border-zinc-700',
              'max-h-60 overflow-y-auto'
            )}
          >
            {/* Existing tag suggestions */}
            {suggestions.map((tag, index) => (
              <li
                key={tag.id}
                id={`tag-option-${index}`}
                role="option"
                aria-selected={index === highlightIndex}
                onClick={() => handleSelectTag(tag)}
                className={clsx(
                  'px-3 py-2 cursor-pointer flex items-center justify-between',
                  'text-zinc-900 dark:text-white',
                  index === highlightIndex && 'bg-blue-100 dark:bg-blue-900/30',
                  'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                  'transition-colors'
                )}
              >
                <span>{tag.name}</span>
                {tag.usageCount !== undefined && tag.usageCount > 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {tag.usageCount}
                  </span>
                )}
              </li>
            ))}

            {/* Create new tag option */}
            {canCreateNew && (
              <li
                id={`tag-option-${suggestions.length}`}
                role="option"
                aria-selected={highlightIndex === suggestions.length}
                onClick={handleCreateTag}
                className={clsx(
                  'px-3 py-2 cursor-pointer flex items-center gap-2',
                  'text-blue-600 dark:text-blue-400 font-medium',
                  highlightIndex === suggestions.length && 'bg-blue-100 dark:bg-blue-900/30',
                  'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                  'transition-colors',
                  'border-t border-zinc-200 dark:border-zinc-700'
                )}
              >
                <span>Create &quot;{input.trim()}&quot;</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Helper text */}
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Type to search, press Enter or comma to add
      </p>

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isOpen && suggestions.length > 0 && (
          <span>{suggestions.length} suggestions available</span>
        )}
        {isOpen && canCreateNew && (
          <span>Press Enter to create new tag</span>
        )}
      </div>
    </div>
  );
}
