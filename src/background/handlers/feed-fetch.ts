/**
 * Feed fetching handler
 */

import { isValidFeedUrl } from '../../utils/security';
import { fetchWithRetry, categorizeError } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT, MAX_CONTENT_SIZE } from '../utils/constants';
import type { FeedResponse } from '../../utils/types';

/**
 * Fetch a feed from a given URL with SSRF protection, timeout, and retry logic
 */
export async function fetchFeed(
  feedUrl: string,
  requestId: string
): Promise<FeedResponse> {
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
    console.log('[Service Worker] Fetching feed:', feedUrl);

    // 2. Fetch with retry logic
    const response = await fetchWithRetry(
      feedUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT
    );

    // 3. Check final URL after redirects
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

    // 4. Check Content-Length header if available
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

    // 5. Get response text
    const text = await response.text();

    // 6. Verify size after download (servers may lie about Content-Length)
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

    console.log(
      `[Service Worker] Successfully fetched feed (${actualSize} bytes)`
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
