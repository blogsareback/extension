/**
 * Feed path probing - discovers feeds by checking common paths
 */

import browser from '../../utils/browser';
import { isValidFeedUrl } from '../../utils/security';
import {
  COMMON_FEED_PATHS,
  STORAGE_KEY_PROBE_CACHE,
  PROBE_CACHE_TTL_MS,
  PROBE_TIMEOUT,
  PROBE_BATCH_SIZE,
  USER_AGENT,
} from '../utils/constants';
import type { FeedLink, ProbeCacheEntry } from '../../utils/types';

/**
 * Domains that should never be probed for feeds
 * These are known non-blog sites where probing would be wasteful
 */
const SKIP_PROBE_DOMAINS = new Set([
  // Search engines
  'google.com', 'www.google.com', 'bing.com', 'www.bing.com', 'duckduckgo.com',
  // Social media
  'facebook.com', 'www.facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'linkedin.com', 'www.linkedin.com', 'tiktok.com', 'www.tiktok.com',
  // Video platforms (have their own RSS via channel pages)
  'youtube.com', 'www.youtube.com', 'vimeo.com',
  // E-commerce
  'amazon.com', 'www.amazon.com', 'ebay.com', 'www.ebay.com',
  // Productivity
  'docs.google.com', 'drive.google.com', 'mail.google.com', 'calendar.google.com',
  'notion.so', 'figma.com', 'www.figma.com', 'miro.com',
  // Dev tools (have their own feeds via proper link tags usually)
  'github.com', 'gitlab.com', 'bitbucket.org',
  // News aggregators (already have feeds)
  'news.ycombinator.com', 'reddit.com', 'www.reddit.com',
]);

/**
 * Check if a domain should be skipped for probing
 */
function shouldSkipDomain(hostname: string): boolean {
  // Direct match
  if (SKIP_PROBE_DOMAINS.has(hostname)) return true;

  // Check parent domains (e.g., subdomain.google.com)
  const parts = hostname.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (SKIP_PROBE_DOMAINS.has(parentDomain)) return true;
  }

  return false;
}

/**
 * Get domain from URL for cache key
 */
function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Get cached probe result for a domain
 */
async function getCachedProbe(domain: string): Promise<FeedLink[] | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_PROBE_CACHE);
    const cache = (result[STORAGE_KEY_PROBE_CACHE] as Record<string, ProbeCacheEntry> | undefined) || {};

    const entry = cache[domain];
    if (!entry) return null;

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > PROBE_CACHE_TTL_MS) {
      // Cache expired, remove it
      delete cache[domain];
      await browser.storage.local.set({ [STORAGE_KEY_PROBE_CACHE]: cache });
      return null;
    }

    return entry.feeds;
  } catch (error) {
    console.error('[Feed Probe] Error reading cache:', error);
    return null;
  }
}

/**
 * Store probe result in cache
 */
async function setCachedProbe(domain: string, feeds: FeedLink[]): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_PROBE_CACHE);
    const cache = (result[STORAGE_KEY_PROBE_CACHE] as Record<string, ProbeCacheEntry> | undefined) || {};

    // Clean up expired entries while we're at it
    const now = Date.now();
    for (const [key, entry] of Object.entries(cache)) {
      if (now - entry.timestamp > PROBE_CACHE_TTL_MS) {
        delete cache[key];
      }
    }

    // Add new entry
    cache[domain] = {
      domain,
      feeds,
      timestamp: now,
    };

    await browser.storage.local.set({ [STORAGE_KEY_PROBE_CACHE]: cache });
  } catch (error) {
    console.error('[Feed Probe] Error writing cache:', error);
  }
}

/**
 * Check if a URL is a valid feed by trying to fetch and verify XML content
 */
async function isValidFeed(url: string): Promise<{ valid: boolean; title?: string }> {
  try {
    if (!isValidFeedUrl(url)) {
      return { valid: false };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { valid: false };
    }

    const text = await response.text();
    const lowerContent = text.toLowerCase();

    // Check for feed-like XML
    const isRssOrAtom =
      (lowerContent.includes('<rss') ||
        lowerContent.includes('<feed') ||
        lowerContent.includes('<rdf:rdf')) &&
      (lowerContent.includes('</rss>') ||
        lowerContent.includes('</feed>') ||
        lowerContent.includes('</rdf:rdf>'));

    if (!isRssOrAtom) {
      return { valid: false };
    }

    // Try to extract feed title
    let title: string | undefined;
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Decode HTML entities
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    return { valid: true, title };
  } catch {
    return { valid: false };
  }
}

/**
 * Probe common feed paths for a given page URL
 * Returns discovered feeds or empty array if none found
 */
export async function probeCommonPaths(pageUrl: string): Promise<FeedLink[]> {
  const domain = getDomain(pageUrl);
  if (!domain) {
    console.log('[Feed Probe] Invalid page URL:', pageUrl);
    return [];
  }

  // Skip known non-blog domains
  if (shouldSkipDomain(domain)) {
    console.log(`[Feed Probe] Skipping known non-blog domain: ${domain}`);
    return [];
  }

  // Check cache first
  const cached = await getCachedProbe(domain);
  if (cached !== null) {
    console.log(`[Feed Probe] Cache hit for ${domain}: ${cached.length} feed(s)`);
    return cached;
  }

  console.log(`[Feed Probe] Probing common paths for ${domain}...`);

  const feeds: FeedLink[] = [];

  try {
    const url = new URL(pageUrl);
    const origin = url.origin;

    // Try common paths in batches
    for (let i = 0; i < COMMON_FEED_PATHS.length; i += PROBE_BATCH_SIZE) {
      const batch = COMMON_FEED_PATHS.slice(i, i + PROBE_BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (path) => {
          const feedUrl = origin + path;
          const result = await isValidFeed(feedUrl);
          return result.valid ? { url: feedUrl, title: result.title } : null;
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          feeds.push({
            href: result.value.url,
            title: result.value.title,
            type: 'application/rss+xml', // Generic feed type
          });
        }
      }

      // If we found feeds, stop probing (don't waste requests)
      if (feeds.length > 0) {
        console.log(`[Feed Probe] Found ${feeds.length} feed(s), stopping early`);
        break;
      }
    }
  } catch (error) {
    console.error('[Feed Probe] Error probing paths:', error);
  }

  // Cache the result (even if empty, to avoid re-probing)
  await setCachedProbe(domain, feeds);

  console.log(`[Feed Probe] Completed for ${domain}: ${feeds.length} feed(s) found`);
  return feeds;
}

/**
 * Clear the probe cache (useful for testing or manual refresh)
 */
export async function clearProbeCache(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY_PROBE_CACHE);
  console.log('[Feed Probe] Cache cleared');
}
