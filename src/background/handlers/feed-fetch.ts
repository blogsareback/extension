/**
 * Feed fetching handler
 *
 * Supports conditional GET optimization via ETag and Last-Modified headers.
 * When a feed is cached and the server returns 304, the cached content is returned.
 */

import { isValidFeedUrl } from '../../utils/security';
import { fetchWithRetry, categorizeError } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT, MAX_CONTENT_SIZE } from '../utils/constants';
import {
  getFeedCache,
  setFeedCache,
} from '../storage/feed-cache';
import type { FeedResponse, FetchFeedOptions } from '../../utils/types';

/**
 * Fetch a feed from a given URL with SSRF protection, timeout, retry logic,
 * and conditional GET optimization.
 *
 * @param feedUrl - The URL of the feed to fetch
 * @param requestId - Unique request ID for response matching
 * @param options - Optional fetch options (skipCache, timeout)
 */
export async function fetchFeed(
  feedUrl: string,
  requestId: string,
  options?: FetchFeedOptions
): Promise<FeedResponse> {
  const { skipCache = false, timeout = FETCH_TIMEOUT } = options ?? {};

  // 1. Validate URL (SSRF check)
  if (!isValidFeedUrl(feedUrl)) {
    console.error('[Service Worker] Invalid or blocked URL:', feedUrl);
    return {
      type: 'FEED_RESPONSE',
      requestId,
      success: false,
      error: 'Invalid or blocked URL',
    };
  }

  try {
    // 2. Check for fresh cached content (single cache lookup)
    // getFeedCache returns null for expired entries, so a non-null result means fresh.
    if (!skipCache) {
      const cached = await getFeedCache(feedUrl);
      if (cached) {
        console.log('[Service Worker] Returning prefetched feed from cache:', feedUrl);
        return {
          type: 'FEED_RESPONSE',
          requestId,
          success: true,
          data: cached.content,
          status: 200,
        };
      }
    }

    // 3. Build headers for fresh fetch (no conditional GET headers available —
    // getFeedCache deletes expired entries, so stale headers are already gone)
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
    };

    console.log(`[Service Worker] Fetching feed (${skipCache ? 'skip cache' : 'no cache'}):`, feedUrl);

    // 4. Fetch with retry logic
    const response = await fetchWithRetry(
      feedUrl,
      {
        headers,
        redirect: 'follow',
      },
      timeout
    );

    // 5. Check final URL after redirects
    if (!isValidFeedUrl(response.url)) {
      console.error(
        '[Service Worker] Redirect to blocked URL:',
        response.url
      );
      return {
        type: 'FEED_RESPONSE',
        requestId,
        success: false,
        error: 'Redirect to blocked URL',
      };
    }

    // 7. Check Content-Length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
      console.warn(
        `[Service Worker] Feed too large (${contentLength} bytes): ${feedUrl}`
      );
      return {
        type: 'FEED_RESPONSE',
        requestId,
        success: false,
        error: `Feed too large: ${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB exceeds 10MB limit`,
      };
    }

    // 8. Get response text
    const text = await response.text();

    // 9. Verify size after download (servers may lie about Content-Length)
    const actualSize = new Blob([text]).size;
    if (actualSize > MAX_CONTENT_SIZE) {
      console.warn(
        `[Service Worker] Feed content too large (${actualSize} bytes): ${feedUrl}`
      );
      return {
        type: 'FEED_RESPONSE',
        requestId,
        success: false,
        error: `Feed content too large: ${Math.round(actualSize / 1024 / 1024)}MB exceeds 10MB limit`,
      };
    }

    // 10. Store in cache for future conditional requests
    const etag = response.headers.get('ETag');
    const lastModified = response.headers.get('Last-Modified');

    if (etag || lastModified) {
      // Only cache if server provides conditional GET headers
      await setFeedCache(feedUrl, text, etag, lastModified);
    }

    console.log(
      `[Service Worker] Successfully fetched feed (${actualSize} bytes, ` +
      `etag: ${etag ? 'yes' : 'no'}, last-modified: ${lastModified ? 'yes' : 'no'})`
    );

    return {
      type: 'FEED_RESPONSE',
      requestId,
      success: true,
      data: text,
      status: response.status,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[Service Worker] Fetch error:', categorized.message, error);

    return {
      type: 'FEED_RESPONSE',
      requestId,
      success: false,
      error: categorized.message,
    };
  }
}
