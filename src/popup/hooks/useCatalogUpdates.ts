import { useState, useEffect, useCallback } from 'react';
import browser from '@/utils/browser';
import type { CatalogSourceUpdatesState, CatalogUpdatesState } from '@/utils/types';
import {
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_COMMUNITY_UPDATES,
} from '@/background/utils/constants';

/**
 * Hook to get and manage catalog updates state (directory + community)
 */
export function useCatalogUpdates() {
  const [directoryState, setDirectoryState] = useState<CatalogSourceUpdatesState | null>(null);
  const [communityState, setCommunityState] = useState<CatalogSourceUpdatesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate combined counts
  const totalUpdatedCount = (directoryState?.updatedCount ?? 0) + (communityState?.updatedCount ?? 0);
  const totalFollowedCount = (directoryState?.followedCount ?? 0) + (communityState?.followedCount ?? 0);

  // Combined state for convenience
  const catalogState: CatalogUpdatesState | null = (directoryState || communityState) ? {
    directory: directoryState,
    community: communityState,
    totalUpdatedCount,
    totalFollowedCount,
  } : null;

  // Fetch initial state
  useEffect(() => {
    async function fetchState() {
      try {
        const [dirResponse, commResponse] = await Promise.all([
          browser.runtime.sendMessage({ type: 'GET_DIRECTORY_UPDATES' }),
          browser.runtime.sendMessage({ type: 'GET_COMMUNITY_UPDATES' }),
        ]);

        setDirectoryState((dirResponse as { state: CatalogSourceUpdatesState | null }).state);
        setCommunityState((commResponse as { state: CatalogSourceUpdatesState | null }).state);
      } catch (error) {
        console.error('[useCatalogUpdates] Failed to fetch state:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchState();
  }, []);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: browser.Storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return;

      if (changes[STORAGE_KEY_DIRECTORY_UPDATES]) {
        setDirectoryState(changes[STORAGE_KEY_DIRECTORY_UPDATES].newValue as CatalogSourceUpdatesState || null);
      }

      if (changes[STORAGE_KEY_COMMUNITY_UPDATES]) {
        setCommunityState(changes[STORAGE_KEY_COMMUNITY_UPDATES].newValue as CatalogSourceUpdatesState || null);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Force check both directory and community updates
  const forceCheck = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await browser.runtime.sendMessage({ type: 'FORCE_CHECK_CATALOG_UPDATES' });
    } catch (error) {
      console.error('[useCatalogUpdates] Force check failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return {
    directoryState,
    communityState,
    catalogState,
    totalUpdatedCount,
    totalFollowedCount,
    loading,
    forceCheck,
    isRefreshing,
  };
}
