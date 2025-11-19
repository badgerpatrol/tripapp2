import React from 'react';
import { Tag, TagEntityTypeString } from '@/types/tag';
import { useTagStore } from './useTags';

interface UseEntityTagsOptions {
  entityType: TagEntityTypeString;
  entityId: string;
  enabled?: boolean;
}

interface UseEntityTagsReturn {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  addTag: (tagId: string) => Promise<void>;
  removeTag: (tagId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage tags for a specific entity (spend, checklist_item, kit_item).
 * Provides methods to add, remove, and list tags with optimistic updates.
 *
 * @param options - Entity type, ID, and enabled flag
 * @returns Tags and methods to manage them
 */
export function useEntityTags({
  entityType,
  entityId,
  enabled = true,
}: UseEntityTagsOptions): UseEntityTagsReturn {
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { updateTag: updateGlobalTag } = useTagStore();

  // Convert entity type to API path format
  const getApiPath = (type: TagEntityTypeString) => {
    switch (type) {
      case 'spend':
        return 'spends';
      case 'checklist_item':
        return 'checklist-items';
      case 'kit_item':
        return 'kit-items';
      default:
        throw new Error(`Unknown entity type: ${type}`);
    }
  };

  const apiPath = getApiPath(entityType);

  /**
   * Fetches tags for the entity from the API.
   */
  const fetchTags = React.useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const idToken = await getIdToken();
      const response = await fetch(`/api/${apiPath}/${entityId}/tags`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }

      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      console.error('Error fetching entity tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, apiPath, enabled]);

  /**
   * Adds a tag to the entity with optimistic update.
   */
  const addTag = React.useCallback(async (tagId: string) => {
    try {
      setError(null);

      // Find the tag from the global store
      const globalTag = useTagStore.getState().tags.find(t => t.id === tagId);
      if (!globalTag) {
        throw new Error('Tag not found');
      }

      // Optimistic update
      setTags(prev => [...prev, globalTag]);

      const idToken = await getIdToken();
      const response = await fetch(`/api/${apiPath}/${entityId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) {
        // Rollback on error
        setTags(prev => prev.filter(t => t.id !== tagId));
        throw new Error('Failed to add tag');
      }

      // Update global tag usage count
      updateGlobalTag(tagId, {
        usageCount: (globalTag.usageCount || 0) + 1
      });

      // Refetch to ensure consistency
      await fetchTags();
    } catch (err) {
      console.error('Error adding tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
      throw err;
    }
  }, [entityType, entityId, apiPath, fetchTags, updateGlobalTag]);

  /**
   * Removes a tag from the entity with optimistic update.
   */
  const removeTag = React.useCallback(async (tagId: string) => {
    try {
      setError(null);

      // Find the tag for rollback
      const removedTag = tags.find(t => t.id === tagId);
      if (!removedTag) return;

      // Optimistic update
      setTags(prev => prev.filter(t => t.id !== tagId));

      const idToken = await getIdToken();
      const response = await fetch(`/api/${apiPath}/${entityId}/tags/${tagId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        // Rollback on error
        setTags(prev => [...prev, removedTag]);
        throw new Error('Failed to remove tag');
      }

      // Update global tag usage count
      updateGlobalTag(tagId, {
        usageCount: Math.max(0, (removedTag.usageCount || 1) - 1)
      });

      // Refetch to ensure consistency
      await fetchTags();
    } catch (err) {
      console.error('Error removing tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
      throw err;
    }
  }, [tags, entityType, entityId, apiPath, fetchTags, updateGlobalTag]);

  // Fetch tags on mount
  React.useEffect(() => {
    if (enabled && entityId) {
      fetchTags();
    }
  }, [fetchTags, enabled, entityId]);

  return {
    tags,
    isLoading,
    error,
    addTag,
    removeTag,
    refetch: fetchTags,
  };
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
