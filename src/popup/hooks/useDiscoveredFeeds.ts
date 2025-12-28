import { useState, useEffect, useCallback } from 'react';
import browser from '@/utils/browser';
import { STORAGE_KEY_FOLLOWED_FEED_URLS } from '@/utils/constants';
import type {
  FeedLink,
  GetDiscoveredFeedsRequest,
  GetDiscoveredFeedsResponse,
  PopupSubscribeRequest,
  PopupSubscribeResponse,
} from '@/utils/types';

interface UseDiscoveredFeedsResult {
  feeds: FeedLink[];
  pageUrl: string | null;
  loading: boolean;
  error: string | null;
  subscribe: (feed: FeedLink) => Promise<boolean>;
  subscribingFeed: string | null;
}

/**
 * Normalize a URL for comparison by removing trailing slashes and lowercasing
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.href.toLowerCase();
  } catch {
    // If URL parsing fails, just lowercase and remove trailing slashes
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

export function useDiscoveredFeeds(): UseDiscoveredFeedsResult {
  const [feeds, setFeeds] = useState<FeedLink[]>([]);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribingFeed, setSubscribingFeed] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeeds() {
      try {
        // Get the current active tab
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab?.id) {
          setLoading(false);
          return;
        }

        // Fetch discovered feeds and followed feed URLs in parallel
        const [feedsResponse, storageResult] = await Promise.all([
          browser.runtime.sendMessage({
            type: 'GET_DISCOVERED_FEEDS',
            tabId: tab.id,
          } as GetDiscoveredFeedsRequest) as Promise<GetDiscoveredFeedsResponse>,
          browser.storage.local.get([STORAGE_KEY_FOLLOWED_FEED_URLS]),
        ]);

        if (feedsResponse.type === 'DISCOVERED_FEEDS_RESPONSE') {
          const discoveredFeeds = feedsResponse.feeds;
          const followedFeedUrls = (storageResult[STORAGE_KEY_FOLLOWED_FEED_URLS] as string[] | undefined) || [];

          // Create a Set of normalized followed URLs for efficient lookup
          const normalizedFollowedUrls = new Set(
            followedFeedUrls.map(normalizeUrl)
          );

          // Filter out feeds that are already followed
          const unfollowedFeeds = discoveredFeeds.filter(
            (feed) => !normalizedFollowedUrls.has(normalizeUrl(feed.href))
          );

          setFeeds(unfollowedFeeds);
          setPageUrl(feedsResponse.pageUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feeds');
      } finally {
        setLoading(false);
      }
    }

    fetchFeeds();
  }, []);

  const subscribe = useCallback(
    async (feed: FeedLink): Promise<boolean> => {
      if (!pageUrl) {
        return false;
      }

      setSubscribingFeed(feed.href);

      try {
        const request: PopupSubscribeRequest = {
          type: 'POPUP_SUBSCRIBE',
          feed,
          pageUrl,
        };

        const response = (await browser.runtime.sendMessage(
          request
        )) as PopupSubscribeResponse;

        return response.success;
      } catch (err) {
        console.error('Failed to subscribe:', err);
        return false;
      } finally {
        setSubscribingFeed(null);
      }
    },
    [pageUrl]
  );

  return {
    feeds,
    pageUrl,
    loading,
    error,
    subscribe,
    subscribingFeed,
  };
}
