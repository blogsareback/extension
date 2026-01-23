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
  getConditionalHeaders,
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
    // 2. Check for fresh cached content (prefetch optimization)
    // If we have valid cached content, return it immediately without network request
    if (!skipCache) {
      const cached = await getFeedCache(feedUrl);
      if (cached) {
        console.log('[Service Worker] Returning prefetched feed from cache:', feedUrl);
        return {
          type: 'FEED_RESPONSE',
          requestId,
          success: true,
          data: cached.content,
          status: 200, // Indicate this is valid content (not 304 since no request was made)
        };
      }
    }

    // 3. Build headers with conditional GET support
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
    };

    // Check for cached conditional headers (unless skipCache)
    // Note: We already checked cache above, but it may have expired since then
    // So we still check for conditional headers for the 304 flow
    let cachedContent: string | null = null;
    if (!skipCache) {
      const conditionalHeaders = await getConditionalHeaders(feedUrl);
      if (conditionalHeaders) {
        if (conditionalHeaders.etag) {
          headers['If-None-Match'] = conditionalHeaders.etag;
        }
        if (conditionalHeaders.lastModified) {
          headers['If-Modified-Since'] = conditionalHeaders.lastModified;
        }

        // Also get the cached content in case we get 304
        const cached = await getFeedCache(feedUrl);
        if (cached) {
          cachedContent = cached.content;
        }

        console.log('[Service Worker] Fetching feed with conditional headers:', feedUrl);
      } else {
        console.log('[Service Worker] Fetching feed (no cache):', feedUrl);
      }
    } else {
      console.log('[Service Worker] Fetching feed (skip cache):', feedUrl);
    }

    // 4. Fetch with retry logic
    const response = await fetchWithRetry(
      feedUrl,
      {
        headers,
        redirect: 'follow',
      },
      timeout
    );

    // 5. Handle 304 Not Modified - return cached content
    if (response.status === 304 && cachedContent) {
      console.log('[Service Worker] Feed not modified (304), using cache:', feedUrl);
      return {
        type: 'FEED_RESPONSE',
        requestId,
        success: true,
        data: cachedContent,
        status: 304,
      };
    }

    // 6. Check final URL after redirects
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
