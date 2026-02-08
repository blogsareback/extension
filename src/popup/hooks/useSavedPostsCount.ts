import { useState, useEffect } from 'react';
import browser from '@/utils/browser';
import type { SavedPostsCountResponse } from '@/utils/types';

export function useSavedPostsCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    browser.runtime
      .sendMessage({
        type: 'GET_SAVED_POSTS_COUNT',
        requestId: crypto.randomUUID(),
      })
      .then((response) => {
        const r = response as SavedPostsCountResponse;
        if (r.success) {
          setCount(r.count);
        }
      })
      .catch((error) => {
        console.error(
          '[useSavedPostsCount] Failed to fetch saved posts count:',
          error
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { count, loading };
}
