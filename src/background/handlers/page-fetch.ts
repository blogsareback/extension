/**
 * Page fetching handler (raw HTML without extraction)
 */

import { isValidFeedUrl } from '../../utils/security';
import { fetchWithRetry, categorizeError } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT, MAX_CONTENT_SIZE } from '../utils/constants';
import type { FetchPageResponse } from '../../utils/types';

/**
 * Fetch a web page's raw HTML with SSRF protection, size checks, and retry logic.
 * Unlike extractReadableText/extractReadableHtml, this returns the raw HTML without processing.
 * Used for iframe display when CORS needs to be bypassed.
 */
export async function fetchPage(
  url: string,
  requestId: string
): Promise<FetchPageResponse> {
  // 1. Validate URL (SSRF check)
  if (!isValidFeedUrl(url)) {
    console.error('[Service Worker] Invalid or blocked URL:', url);
    return {
      type: 'PAGE_RESPONSE',
      requestId,
      success: false,
      error: 'Invalid or blocked URL',
    };
  }

  try {
    console.log('[Service Worker] Fetching page:', url);

    // 2. Fetch with retry logic
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          // Accept HTML content
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
        type: 'PAGE_RESPONSE',
        requestId,
        success: false,
        error: 'Redirect to blocked URL',
      };
    }

    // 4. Check Content-Length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
      console.warn(
        `[Service Worker] Page too large (${contentLength} bytes): ${url}`
      );
      return {
        type: 'PAGE_RESPONSE',
        requestId,
        success: false,
        error: `Page too large: ${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB exceeds 10MB limit`,
      };
    }

    // 5. Get response text
    const text = await response.text();

    // 6. Verify size after download (servers may lie about Content-Length)
    const actualSize = new Blob([text]).size;
    if (actualSize > MAX_CONTENT_SIZE) {
      console.warn(
        `[Service Worker] Page content too large (${actualSize} bytes): ${url}`
      );
      return {
        type: 'PAGE_RESPONSE',
        requestId,
        success: false,
        error: `Page content too large: ${Math.round(actualSize / 1024 / 1024)}MB exceeds 10MB limit`,
      };
    }

    console.log(
      `[Service Worker] Successfully fetched page (${actualSize} bytes)`
    );

    return {
      type: 'PAGE_RESPONSE',
      requestId,
      success: true,
      data: text,
      status: response.status,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[Service Worker] Page fetch error:', categorized.message, error);

    return {
      type: 'PAGE_RESPONSE',
      requestId,
      success: false,
      error: categorized.message,
    };
  }
}
