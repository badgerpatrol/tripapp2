import React from 'react';
import { create } from 'zustand';
import { Tag } from '@/types/tag';

interface TagStore {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  setTags: (tags: Tag[]) => void;
  addTag: (tag: Tag) => void;
  updateTag: (tagId: string, updates: Partial<Tag>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Global tag store using Zustand.
 * Caches all tags fetched from the server for the session.
 */
export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  setTags: (tags) => set({ tags, lastFetched: Date.now(), error: null }),

  addTag: (tag) => set((state) => ({
    tags: [...state.tags, tag],
  })),

  updateTag: (tagId, updates) => set((state) => ({
    tags: state.tags.map(tag =>
      tag.id === tagId ? { ...tag, ...updates } : tag
    ),
  })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => set({ tags: [], isLoading: false, error: null, lastFetched: null }),
}));

/**
 * Hook to fetch all tags from the API.
 * Uses the global tag store for caching.
 *
 * @param refetch - Force refetch even if cached
 * @returns Tag store state and refetch function
 */
export function useTags(refetch = false) {
  const store = useTagStore();
  const { tags, isLoading, error, lastFetched, setTags, setLoading, setError } = store;

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const fetchTags = async () => {
    try {
      setLoading(true);

      let idToken: string;
      try {
        idToken = await getIdToken();
      } catch (authError) {
        console.error('Authentication error when fetching tags:', authError);
        throw new Error('Not authenticated. Please sign in again.');
      }

      const response = await fetch('/api/tags', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch tags:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Failed to fetch tags (${response.status})`);
      }

      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount if not cached or cache is stale
  React.useEffect(() => {
    const shouldFetch =
      refetch ||
      tags.length === 0 ||
      !lastFetched ||
      Date.now() - lastFetched > CACHE_DURATION;

    if (shouldFetch && !isLoading) {
      fetchTags();
    }
  }, [refetch]);

  return {
    tags,
    isLoading,
    error,
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
