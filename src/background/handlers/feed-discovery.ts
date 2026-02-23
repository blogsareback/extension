/**
 * Feed discovery handler - discovers RSS/Atom feeds from blog URLs
 */

import { isValidFeedUrl } from '../../utils/security';
import { toURL } from '../../utils/urls';
import { fetchWithRetry } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT } from '../utils/constants';
import { probeCommonPaths } from './feed-probe';
import type { DiscoverFeedsResponse, DiscoveredFeed } from '../../utils/types';

/**
 * Parse HTML to find feed links in <link> tags
 */
export function parseFeedLinksFromHTML(html: string, baseUrl: string): DiscoveredFeed[] {
  const feeds: DiscoveredFeed[] = [];

  // Use regex to find link tags (works without DOM parser)
  const linkRegex = /<link[^>]*>/gi;
  const matches = html.match(linkRegex) || [];

  for (const linkTag of matches) {
    // Check for rel="alternate"
    if (!/rel\s*=\s*["']alternate["']/i.test(linkTag)) {
      continue;
    }

    // Get type attribute
    const typeMatch = linkTag.match(/type\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';

    // Check if it's a feed type
    if (!type.includes('rss') && !type.includes('atom') && !type.includes('xml')) {
      continue;
    }

    // Get href attribute
    const hrefMatch = linkTag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const href = hrefMatch[1];

    // Get title attribute
    const titleMatch = linkTag.match(/title\s*=\s*["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1] : undefined;

    try {
      // Resolve relative URLs
      const feedUrl = new URL(href, baseUrl).href;

      let feedType: DiscoveredFeed['type'] = 'unknown';
      if (type.includes('atom')) {
        feedType = 'atom';
      } else if (type.includes('rss')) {
        feedType = 'rss';
      }

      feeds.push({
        url: feedUrl,
        type: feedType,
        title,
      });
    } catch {
      // Invalid URL, skip
    }
  }

  return feeds;
}

/**
 * Check if content looks like a valid RSS/Atom feed
 */
export function isFeedContent(text: string): boolean {
  const lowerContent = text.toLowerCase();
  return (
    (lowerContent.includes('<rss') ||
      lowerContent.includes('<feed') ||
      lowerContent.includes('<rdf:rdf')) &&
    (lowerContent.includes('</rss>') ||
      lowerContent.includes('</feed>') ||
      lowerContent.includes('</rdf:rdf>'))
  );
}

/**
 * Check if a URL is a valid feed by trying to fetch and verify XML content
 */
export async function isValidFeed(url: string): Promise<boolean> {
  try {
    if (!isValidFeedUrl(url)) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const text = await response.text();
    return isFeedContent(text);
  } catch {
    return false;
  }
}

/**
 * Try common feed paths for a given domain.
 * Delegates to probeCommonPaths (feed-probe.ts) which has a 24-hour cache,
 * so repeated discoveries for the same domain don't re-probe.
 */
export async function checkCommonPaths(baseUrl: string): Promise<DiscoveredFeed[]> {
  const feedLinks = await probeCommonPaths(baseUrl);
  return feedLinks.map((link) => ({
    url: link.href,
    type: 'unknown' as const,
    title: link.title,
  }));
}

/**
 * Discover feeds from a blog URL
 */
export async function discoverFeedsFromUrl(
  blogUrl: string,
  requestId: string
): Promise<DiscoverFeedsResponse> {
  try {
    // Normalize the URL (handles cases like "overreacted.io" -> "https://overreacted.io/")
    const normalizedUrl = toURL(blogUrl, true); // enforceHttps = true

    if (!normalizedUrl) {
      return {
        type: 'DISCOVER_FEEDS_RESPONSE',
        requestId,
        success: false,
        error: 'Invalid URL format. Please enter a valid blog URL.',
      };
    }

    // Validate URL for SSRF protection
    if (!isValidFeedUrl(normalizedUrl)) {
      return {
        type: 'DISCOVER_FEEDS_RESPONSE',
        requestId,
        success: false,
        error: 'Invalid or blocked URL',
      };
    }

    console.log('[Service Worker] Discovering feeds from:', normalizedUrl, '(original:', blogUrl, ')');

    // Fetch the URL once — then check if it's a feed or an HTML page
    const response = await fetchWithRetry(
      normalizedUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT
    );

    // Validate final URL after redirects
    if (!isValidFeedUrl(response.url)) {
      return {
        type: 'DISCOVER_FEEDS_RESPONSE',
        requestId,
        success: false,
        error: 'Redirect to blocked URL',
      };
    }

    const html = await response.text();

    // Check if the URL itself is a feed (avoids a second fetch)
    if (isFeedContent(html)) {
      return {
        type: 'DISCOVER_FEEDS_RESPONSE',
        requestId,
        success: true,
        feeds: [{
          url: response.url,
          type: 'unknown',
        }],
      };
    }

    // Parse HTML for feed links
    const feedsFromHTML = parseFeedLinksFromHTML(html, response.url);

    if (feedsFromHTML.length > 0) {
      // Remove duplicates
      const uniqueFeeds = Array.from(
        new Map(feedsFromHTML.map((feed) => [feed.url, feed])).values()
      );

      console.log(`[Service Worker] Found ${uniqueFeeds.length} feed(s) in HTML`);

      return {
        type: 'DISCOVER_FEEDS_RESPONSE',
        requestId,
        success: true,
        feeds: uniqueFeeds,
      };
    }

    // No feeds in HTML, try common paths
    console.log('[Service Worker] No feeds in HTML, trying common paths...');
    const feedsFromPaths = await checkCommonPaths(response.url);

    if (feedsFromPaths.length > 0) {
      console.log(`[Service Worker] Found ${feedsFromPaths.length} feed(s) at common paths`);

      return {
        type: 'DISCOVER_FEEDS_RESPONSE',
        requestId,
        success: true,
        feeds: feedsFromPaths,
      };
    }

    // No feeds found
    return {
      type: 'DISCOVER_FEEDS_RESPONSE',
      requestId,
      success: true,
      feeds: [],
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Service Worker] Feed discovery error:', message);

    return {
      type: 'DISCOVER_FEEDS_RESPONSE',
      requestId,
      success: false,
      error: `Feed discovery failed: ${message}`,
    };
  }
}
