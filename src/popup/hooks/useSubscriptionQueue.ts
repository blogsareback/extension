import { useState, useEffect, useCallback } from 'react';
import browser from '@/utils/browser';
import type { Storage } from 'webextension-polyfill';
import type {
  QueuedSubscription,
  GetSubscriptionQueueResponse,
} from '@/utils/types';
import { STORAGE_KEY_SUBSCRIPTION_QUEUE } from '@/utils/constants';

interface UseSubscriptionQueueResult {
  queue: QueuedSubscription[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSubscriptionQueue(): UseSubscriptionQueueResult {
  const [queue, setQueue] = useState<QueuedSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_SUBSCRIPTION_QUEUE',
      })) as GetSubscriptionQueueResponse;

      if (response.type === 'SUBSCRIPTION_QUEUE_RESPONSE') {
        setQueue(response.queue);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Listen for storage changes to auto-refresh
  useEffect(() => {
    const listener = (changes: Record<string, Storage.StorageChange>) => {
      if (changes[STORAGE_KEY_SUBSCRIPTION_QUEUE]) {
        const newValue = changes[STORAGE_KEY_SUBSCRIPTION_QUEUE].newValue as QueuedSubscription[] | undefined;
        setQueue(newValue || []);
      }
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  return {
    queue,
    loading,
    error,
    refresh: fetchQueue,
  };
}
