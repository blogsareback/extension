import { useState, useEffect, useCallback } from 'react';
import browser from '@/utils/browser';
import type { Storage } from 'webextension-polyfill';
import type {
  DirectoryUpdatesState,
  GetDirectoryUpdatesResponse,
  ForceCheckDirectoryUpdatesResponse,
} from '@/utils/types';
import { STORAGE_KEY_DIRECTORY_UPDATES } from '@/utils/constants';

interface UseDirectoryUpdatesResult {
  state: DirectoryUpdatesState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  forceCheck: () => Promise<void>;
  isRefreshing: boolean;
}

export function useDirectoryUpdates(): UseDirectoryUpdatesResult {
  const [state, setState] = useState<DirectoryUpdatesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_DIRECTORY_UPDATES',
      })) as GetDirectoryUpdatesResponse;

      if (response.type === 'DIRECTORY_UPDATES_RESPONSE') {
        setState(response.state);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load directory updates'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const forceCheck = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'FORCE_CHECK_DIRECTORY_UPDATES',
      })) as ForceCheckDirectoryUpdatesResponse;

      if (!response.success) {
        setError(response.error || 'Failed to check for updates');
      }
      // State will be updated via storage listener
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check for updates'
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Listen for storage changes to auto-refresh
  useEffect(() => {
    const listener = (changes: Record<string, Storage.StorageChange>) => {
      if (changes[STORAGE_KEY_DIRECTORY_UPDATES]) {
        const newValue = changes[STORAGE_KEY_DIRECTORY_UPDATES].newValue as DirectoryUpdatesState | undefined;
        setState(newValue || null);
      }
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  return {
    state,
    loading,
    error,
    refresh: fetchState,
    forceCheck,
    isRefreshing,
  };
}
