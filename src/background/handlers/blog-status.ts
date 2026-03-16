/**
 * Blog status testing handler
 */

import { isValidFeedUrl } from '../../utils/security';
import { fetchWithRetry } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT } from '../utils/constants';
import type { TestBlogStatusResponse, BlogStatusTestResult } from '../../utils/types';

/**
 * Check CORS headers from a response
 * Returns true if proxy is required (no CORS or restricted CORS)
 */
function checkCorsHeaders(corsHeader: string | null): boolean {
  if (!corsHeader) {
    return true; // No CORS header = proxy required
  }
  if (corsHeader === '*') {
    return false; // Wildcard = direct fetch works
  }
  // Specific origin(s) - we're not likely in the list
  return true;
}

/**
 * Parse X-Frame-Options header
 * Returns true if iframe is blocked
 */
function parseXFrameOptions(value: string | null): boolean | null {
  if (!value) return null;

  const normalized = value.toUpperCase().trim();

  // DENY and SAMEORIGIN both block cross-origin iframes
  if (normalized === 'DENY' || normalized === 'SAMEORIGIN') {
    return true;
  }

  // ALLOW-FROM is deprecated but if present, assume blocked
  if (normalized.startsWith('ALLOW-FROM')) {
    return true;
  }

  return false;
}

/**
 * Parse CSP header for frame-ancestors directive
 * Returns true if iframe is blocked
 */
function parseCspFrameAncestors(csp: string | null): boolean | null {
  if (!csp) return null;

  const frameAncestorsMatch = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (!frameAncestorsMatch) return null;

  const value = frameAncestorsMatch[1].trim().toLowerCase();

  // 'none' blocks all iframe embedding
  if (value === "'none'" || value === 'none') {
    return true;
  }

  // 'self' only allows same-origin embedding
  if (value === "'self'" || value === 'self') {
    return true;
  }

  // If it's a list of URIs without wildcard, assume blocked
  if (!value.includes('*')) {
    return true;
  }

  return false;
}

/**
 * Resolve relative URL to absolute
 */
function resolveUrlForTesting(url: string, baseUrl: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Extract the first post URL from feed content (XML or JSON Feed)
 */
function extractFirstPostUrl(feedContent: string, feedUrl: string): string | null {
  try {
    const trimmed = feedContent.trim();

    // JSON Feed: extract url or external_url from first item
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.items?.[0]) {
          const item = parsed.items[0];
          const url = item.external_url || item.url;
          if (url) return resolveUrlForTesting(url, feedUrl);
        }
      } catch {
        // Not valid JSON
      }
      return null;
    }

    // Try RSS format: <item><link>...</link></item>
    const rssLinkMatch = feedContent.match(/<item[^>]*>[\s\S]*?<link>([^<]+)<\/link>/i);
    if (rssLinkMatch && rssLinkMatch[1]) {
      return resolveUrlForTesting(rssLinkMatch[1].trim(), feedUrl);
    }

    // Try Atom format: <entry><link href="..."/></entry>
    const atomLinkMatch = feedContent.match(/<entry[^>]*>[\s\S]*?<link[^>]*href\s*=\s*["']([^"']+)["']/i);
    if (atomLinkMatch && atomLinkMatch[1]) {
      return resolveUrlForTesting(atomLinkMatch[1].trim(), feedUrl);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect if feed has full content by analyzing post content lengths
 */
function detectFullContent(feedContent: string): boolean | null {
  try {
    const trimmed = feedContent.trim();

    // JSON Feed: analyze content_html or content_text lengths
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed.items || parsed.items.length === 0) return null;

        const sample = parsed.items.slice(0, 5);
        const avgLength = sample.reduce((sum: number, item: { content_html?: string; content_text?: string }) => {
          const content = item.content_html || item.content_text || '';
          const textOnly = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
          return sum + textOnly.length;
        }, 0) / sample.length;

        return avgLength > 800;
      } catch {
        return null;
      }
    }

    // XML: Extract content from posts
    const contentMatches: string[] = [];

    // Try content:encoded (RSS)
    const contentEncodedRegex = /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/gi;
    let match;
    while ((match = contentEncodedRegex.exec(feedContent)) !== null && contentMatches.length < 5) {
      contentMatches.push(match[1]);
    }

    // Try content (Atom)
    if (contentMatches.length === 0) {
      const contentRegex = /<content[^>]*>([\s\S]*?)<\/content>/gi;
      while ((match = contentRegex.exec(feedContent)) !== null && contentMatches.length < 5) {
        contentMatches.push(match[1]);
      }
    }

    // Try description (RSS fallback)
    if (contentMatches.length === 0) {
      const descRegex = /<description[^>]*>([\s\S]*?)<\/description>/gi;
      while ((match = descRegex.exec(feedContent)) !== null && contentMatches.length < 5) {
        contentMatches.push(match[1]);
      }
    }

    if (contentMatches.length === 0) {
      return null; // Can't determine
    }

    // Analyze content lengths
    // Full content posts typically have >1000 characters
    // Summaries are typically <500 characters
    const avgLength = contentMatches.reduce((sum, content) => {
      // Strip HTML tags for more accurate length
      const textOnly = content.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
      return sum + textOnly.length;
    }, 0) / contentMatches.length;

    // Threshold: 800 characters average suggests full content
    return avgLength > 800;
  } catch {
    return null;
  }
}

/**
 * Test all blog status values
 */
export async function testBlogStatus(
  feedUrl: string,
  requestId: string
): Promise<TestBlogStatusResponse> {
  const result: BlogStatusTestResult = {
    requiresProxy: null,
    hasFullContent: null,
    postsRequireProxy: null,
    blocksIframe: null,
    errors: [],
    details: {},
  };

  try {
    // Validate URL
    if (!isValidFeedUrl(feedUrl)) {
      return {
        type: 'TEST_BLOG_STATUS_RESPONSE',
        requestId,
        success: false,
        error: 'Invalid or blocked URL',
      };
    }

    console.log('[Service Worker] Testing blog status for:', feedUrl);

    // Test 1: Feed CORS (requires_proxy)
    try {
      const feedResponse = await fetchWithRetry(
        feedUrl,
        {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, */*',
          },
          redirect: 'follow',
        },
        FETCH_TIMEOUT
      );

      const corsHeader = feedResponse.headers.get('Access-Control-Allow-Origin');
      result.requiresProxy = checkCorsHeaders(corsHeader);
      result.details!.feedCors = {
        corsHeader,
        statusCode: feedResponse.status,
      };

      // Test 2: Full content detection
      const feedXml = await feedResponse.text();
      result.hasFullContent = detectFullContent(feedXml);

      // Extract first post URL for further tests
      const postUrl = extractFirstPostUrl(feedXml, feedUrl);

      if (postUrl && isValidFeedUrl(postUrl)) {
        // Test 3: Post CORS (posts_require_proxy)
        try {
          const postResponse = await fetchWithRetry(
            postUrl,
            {
              method: 'HEAD',
              headers: {
                'User-Agent': USER_AGENT,
                Accept: 'text/html, application/xhtml+xml, */*',
              },
              redirect: 'follow',
            },
            10000
          );

          const postCorsHeader = postResponse.headers.get('Access-Control-Allow-Origin');
          result.postsRequireProxy = checkCorsHeaders(postCorsHeader);
          result.details!.postCors = {
            corsHeader: postCorsHeader,
            testedUrl: postUrl,
            statusCode: postResponse.status,
          };

          // Test 4: Iframe blocking
          const xFrameOptions = postResponse.headers.get('X-Frame-Options');
          const csp = postResponse.headers.get('Content-Security-Policy');

          const xFrameBlocked = parseXFrameOptions(xFrameOptions);
          const cspBlocked = parseCspFrameAncestors(csp);

          // Extract frame-ancestors value for details
          let cspFrameAncestors: string | null = null;
          if (csp) {
            const match = csp.match(/frame-ancestors\s+([^;]+)/i);
            if (match) {
              cspFrameAncestors = match[1].trim();
            }
          }

          // Blocked if either header indicates blocking
          if (xFrameBlocked === true || cspBlocked === true) {
            result.blocksIframe = true;
          } else if (xFrameBlocked === false || cspBlocked === false) {
            result.blocksIframe = false;
          } else if (xFrameOptions === null && csp === null) {
            // No blocking headers = likely allows iframe
            result.blocksIframe = false;
          }

          result.details!.iframe = {
            xFrameOptions,
            cspFrameAncestors,
            testedUrl: postUrl,
            statusCode: postResponse.status,
          };

        } catch (postError) {
          result.errors.push(`Post URL test failed: ${postError instanceof Error ? postError.message : 'Unknown error'}`);
        }
      } else {
        result.errors.push('Could not extract valid post URL from feed');
      }

    } catch (feedError) {
      result.errors.push(`Feed fetch failed: ${feedError instanceof Error ? feedError.message : 'Unknown error'}`);
    }

    console.log('[Service Worker] Blog status test complete:', result);

    return {
      type: 'TEST_BLOG_STATUS_RESPONSE',
      requestId,
      success: true,
      result,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Service Worker] Blog status test error:', message);

    return {
      type: 'TEST_BLOG_STATUS_RESPONSE',
      requestId,
      success: false,
      error: `Blog status test failed: ${message}`,
    };
  }
}
