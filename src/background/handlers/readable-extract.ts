/**
 * Readable text/HTML extraction handlers
 */

import { isValidFeedUrl } from '../../utils/security';
import { parseReadableContent, parseReadableHtml } from '../../utils/readability';
import { fetchWithRetry, categorizeError } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT, MAX_CONTENT_SIZE } from '../utils/constants';
import type { ReadableTextResponse, ReadableHtmlResponse } from '../../utils/types';

/**
 * Extract readable text from a webpage with SSRF protection, size checks, content validation, and retry logic
 */
export async function extractReadableText(
  url: string,
  requestId: string
): Promise<ReadableTextResponse> {
  // 1. Validate URL (SSRF check)
  if (!isValidFeedUrl(url)) {
    console.error('[Service Worker] Invalid or blocked URL:', url);
    return {
      type: 'READABLE_TEXT_RESPONSE',
      requestId,
      success: false,
      error: 'Invalid or blocked URL',
    };
  }

  try {
    console.log('[Service Worker] Extracting readable text from:', url);

    // 2. HEAD request for pre-checks (content type and size validation)
    // Note: HEAD requests don't use retry logic since they're optional
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const headResponse = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      // Validate content type
      const contentType = headResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        console.warn(
          `[Service Worker] Rejected URL ${url}: Invalid Content-Type (${contentType})`
        );
        return {
          type: 'READABLE_TEXT_RESPONSE',
          requestId,
          success: false,
          error: 'Unsupported Media Type: Only HTML pages allowed',
        };
      }

      // Validate content length
      const contentLength = headResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
        console.warn(
          `[Service Worker] Rejected URL ${url}: Content-Length (${contentLength}) exceeds limit`
        );
        return {
          type: 'READABLE_TEXT_RESPONSE',
          requestId,
          success: false,
          error: 'Payload Too Large: Page size exceeds 10MB limit',
        };
      }

      console.log(`[Service Worker] HEAD checks passed for: ${url}`);
    } catch (headError) {
      // Log but continue - some servers don't support HEAD requests
      console.warn(
        '[Service Worker] HEAD request failed, continuing with GET:',
        headError instanceof Error ? headError.message : 'Unknown error'
      );
    }

    // 3. GET request to fetch HTML content (with retry logic)
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT
    );

    // 5. Validate final URL after redirects (SSRF check)
    if (!isValidFeedUrl(response.url)) {
      console.error(
        '[Service Worker] Redirect to blocked URL:',
        response.url
      );
      return {
        type: 'READABLE_TEXT_RESPONSE',
        requestId,
        success: false,
        error: 'Redirect to blocked URL',
      };
    }

    // 6. Get response as text
    const html = await response.text();

    // 7. Check size after download
    const htmlSize = new Blob([html]).size;
    if (htmlSize > MAX_CONTENT_SIZE) {
      console.warn(
        `[Service Worker] Content size (${htmlSize}) exceeds limit for: ${url}`
      );
      return {
        type: 'READABLE_TEXT_RESPONSE',
        requestId,
        success: false,
        error: 'Payload Too Large: Content size exceeded download limit',
      };
    }

    console.log(
      `[Service Worker] Downloaded HTML (${htmlSize} bytes) from: ${url}`
    );

    // 8. Parse readable content using Readability
    const readableData = parseReadableContent(html, response.url);

    if (!readableData) {
      console.warn(
        '[Service Worker] Could not extract readable content from:',
        url
      );
      return {
        type: 'READABLE_TEXT_RESPONSE',
        requestId,
        success: false,
        error: 'Could not extract readable content or body text',
        status: response.status,
      };
    }

    console.log(
      `[Service Worker] Successfully extracted readable text from: ${url}`
    );

    return {
      type: 'READABLE_TEXT_RESPONSE',
      requestId,
      success: true,
      data: readableData,
      status: response.status,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[Service Worker] Extract error:', categorized.message, error);

    return {
      type: 'READABLE_TEXT_RESPONSE',
      requestId,
      success: false,
      error: `Failed to extract readable text: ${categorized.message}`,
    };
  }
}

/**
 * Extract readable HTML from a webpage with SSRF protection, size checks, content validation, and retry logic
 * Similar to extractReadableText but returns cleaned HTML instead of plain text
 */
export async function extractReadableHtml(
  url: string,
  requestId: string
): Promise<ReadableHtmlResponse> {
  // 1. Validate URL (SSRF check)
  if (!isValidFeedUrl(url)) {
    console.error('[Service Worker] Invalid or blocked URL:', url);
    return {
      type: 'READABLE_HTML_RESPONSE',
      requestId,
      success: false,
      error: 'Invalid or blocked URL',
    };
  }

  try {
    console.log('[Service Worker] Extracting readable HTML from:', url);

    // 2. HEAD request for pre-checks (content type and size validation)
    // Note: HEAD requests don't use retry logic since they're optional
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const headResponse = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      // Validate content type
      const contentType = headResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        console.warn(
          `[Service Worker] Rejected URL ${url}: Invalid Content-Type (${contentType})`
        );
        return {
          type: 'READABLE_HTML_RESPONSE',
          requestId,
          success: false,
          error: 'Unsupported Media Type: Only HTML pages allowed',
        };
      }

      // Validate content length
      const contentLength = headResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
        console.warn(
          `[Service Worker] Rejected URL ${url}: Content-Length (${contentLength}) exceeds limit`
        );
        return {
          type: 'READABLE_HTML_RESPONSE',
          requestId,
          success: false,
          error: 'Payload Too Large: Page size exceeds 10MB limit',
        };
      }

      console.log(`[Service Worker] HEAD checks passed for: ${url}`);
    } catch (headError) {
      // Log but continue - some servers don't support HEAD requests
      console.warn(
        '[Service Worker] HEAD request failed, continuing with GET:',
        headError instanceof Error ? headError.message : 'Unknown error'
      );
    }

    // 3. GET request to fetch HTML content (with retry logic)
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT
    );

    // 4. Validate final URL after redirects (SSRF check)
    if (!isValidFeedUrl(response.url)) {
      console.error(
        '[Service Worker] Redirect to blocked URL:',
        response.url
      );
      return {
        type: 'READABLE_HTML_RESPONSE',
        requestId,
        success: false,
        error: 'Redirect to blocked URL',
      };
    }

    // 6. Get response as text
    const html = await response.text();

    // 7. Check size after download
    const htmlSize = new Blob([html]).size;
    if (htmlSize > MAX_CONTENT_SIZE) {
      console.warn(
        `[Service Worker] Content size (${htmlSize}) exceeds limit for: ${url}`
      );
      return {
        type: 'READABLE_HTML_RESPONSE',
        requestId,
        success: false,
        error: 'Payload Too Large: Content size exceeded download limit',
      };
    }

    console.log(
      `[Service Worker] Downloaded HTML (${htmlSize} bytes) from: ${url}`
    );

    // 8. Parse readable HTML using Readability and clean attributes
    const readableData = parseReadableHtml(html, response.url);

    if (!readableData) {
      console.warn(
        '[Service Worker] Could not extract readable HTML from:',
        url
      );
      return {
        type: 'READABLE_HTML_RESPONSE',
        requestId,
        success: false,
        error: 'Could not extract readable content',
        status: response.status,
      };
    }

    console.log(
      `[Service Worker] Successfully extracted readable HTML from: ${url}`
    );

    return {
      type: 'READABLE_HTML_RESPONSE',
      requestId,
      success: true,
      data: readableData,
      status: response.status,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[Service Worker] Extract error:', categorized.message, error);

    return {
      type: 'READABLE_HTML_RESPONSE',
      requestId,
      success: false,
      error: `Failed to extract readable HTML: ${categorized.message}`,
    };
  }
}
