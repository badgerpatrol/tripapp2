'use client';

import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { Tag, TagEntityTypeString } from '@/types/tag';
import { useTags } from '@/hooks/useTags';
import { useEntityTags } from '@/hooks/useEntityTags';

export interface TagSelectorProps {
  entityType: TagEntityTypeString;
  entityId: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * TagSelector - Multi-select tag component with typeahead search
 *
 * Features:
 * - Typeahead search with case-insensitive "contains" matching
 * - Create new tags on the fly
 * - Optimistic updates
 * - Keyboard navigation (Arrow keys, Enter, Esc)
 * - ARIA combobox pattern for accessibility
 * - Mobile-first responsive design
 */
export function TagSelector({
  entityType,
  entityId,
  placeholder = 'Add tags...',
  className,
  disabled = false,
}: TagSelectorProps) {
  const [input, setInput] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const [isCreating, setIsCreating] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Global tags for suggestions
  const { tags: allTags, isLoading: tagsLoading } = useTags();

  // Entity-specific tags
  const {
    tags: selectedTags,
    isLoading: selectedLoading,
    error,
    addTag,
    removeTag,
  } = useEntityTags({ entityType, entityId });

  // Filter and sort suggestions
  const suggestions = React.useMemo(() => {
    if (!input.trim()) return [];

    const lowerInput = input.toLowerCase();
    const selectedIds = new Set(selectedTags.map(t => t.id));

    // Filter out already selected tags and match by contains
    const filtered = allTags
      .filter(tag => !selectedIds.has(tag.id))
      .filter(tag => tag.name.toLowerCase().includes(lowerInput));

    // Sort: exact matches first, then starts-with, then by usage count
    return filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Exact match
      if (aName === lowerInput) return -1;
      if (bName === lowerInput) return 1;

      // Starts with
      const aStarts = aName.startsWith(lowerInput);
      const bStarts = bName.startsWith(lowerInput);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Usage count (higher first)
      return (b.usageCount || 0) - (a.usageCount || 0);
    });
  }, [input, allTags, selectedTags]);

  // Check if we can create a new tag
  const canCreateNew = React.useMemo(() => {
    if (!input.trim()) return false;
    const exactMatch = allTags.some(
      tag => tag.name.toLowerCase() === input.trim().toLowerCase()
    );
    return !exactMatch;
  }, [input, allTags]);

  // Handle tag selection
  const handleSelectTag = async (tag: Tag) => {
    try {
      await addTag(tag.id);
      setInput('');
      setHighlightIndex(0);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  // Handle create new tag
  const handleCreateTag = async () => {
    if (!canCreateNew || isCreating) return;

    try {
      setIsCreating(true);

      // Create the tag via API
      const idToken = await getIdToken();
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: input.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create tag');
      }

      const data = await response.json();
      const newTag = data.tag;

      // Add to global store
      const { useTagStore } = await import('@/hooks/useTags');
      useTagStore.getState().addTag(newTag);

      // Link to entity
      await addTag(newTag.id);

      setInput('');
      setHighlightIndex(0);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle tag removal
  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTag(tagId);
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
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
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map(tag => (
            <div
              key={tag.id}
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm',
                'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100',
                'border border-blue-200 dark:border-blue-800',
                disabled && 'opacity-60'
              )}
            >
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={disabled}
                className={clsx(
                  'inline-flex items-center justify-center w-4 h-4 rounded-full',
                  'hover:bg-blue-200 dark:hover:bg-blue-800',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                  'transition-colors tap-target-sm',
                  disabled && 'cursor-not-allowed'
                )}
                aria-label={`Remove ${tag.name}`}
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
            'bg-white dark:bg-zinc-900',
            'border-zinc-300 dark:border-zinc-700',
            'text-zinc-900 dark:text-zinc-100',
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
              'bg-white dark:bg-zinc-900',
              'border-zinc-200 dark:border-zinc-800',
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
                  'text-zinc-900 dark:text-zinc-100',
                  index === highlightIndex && 'bg-blue-100 dark:bg-blue-900/30',
                  'hover:bg-blue-50 dark:hover:bg-blue-900/20',
                  'transition-colors tap-target'
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
                  'transition-colors tap-target',
                  'border-t border-zinc-200 dark:border-zinc-800',
                  isCreating && 'opacity-60 cursor-wait'
                )}
              >
                <span>Create &quot;{input.trim()}&quot;</span>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Loading indicator */}
      {selectedLoading && (
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Loading tags...
        </div>
      )}

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

/**
 * Gets the Firebase ID token for authenticated requests.
 */
async function getIdToken(): Promise<string> {
  const { auth } = await import('@/lib/firebase/client');
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.getIdToken();
}
