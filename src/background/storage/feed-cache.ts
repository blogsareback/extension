/**
 * Feed Cache Storage Module
 *
 * Implements conditional GET optimization for feed fetching.
 * Stores ETag and Last-Modified headers to enable 304 responses.
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_FEED_CACHE_PREFIX,
  FEED_CACHE_TTL_MS,
  FEED_CACHE_MAX_ENTRIES,
  FEED_CACHE_MAX_SIZE_BYTES,
} from '../utils/constants';
import type { FeedCacheEntry } from '../../utils/types';

/**
 * Generate a hash for a URL to use as storage key
 */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get the storage key for a feed URL
 */
function getCacheKey(url: string): string {
  return `${STORAGE_KEY_FEED_CACHE_PREFIX}${hashUrl(url)}`;
}

/**
 * Get a cached feed entry
 */
export async function getFeedCache(url: string): Promise<FeedCacheEntry | null> {
  try {
    const key = getCacheKey(url);
    const result = await browser.storage.local.get(key);
    const entry = result[key] as FeedCacheEntry | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      // Remove expired entry
      await browser.storage.local.remove(key);
      return null;
    }

    return entry;
  } catch (error) {
    console.warn('[Feed Cache] Error getting cache entry:', error);
    return null;
  }
}

/**
 * Store a feed in the cache
 */
export async function setFeedCache(
  url: string,
  content: string,
  etag: string | null,
  lastModified: string | null
): Promise<void> {
  try {
    const urlHash = hashUrl(url);
    const key = getCacheKey(url);
    const size = new Blob([content]).size;
    const now = Date.now();

    const entry: FeedCacheEntry = {
      url,
      urlHash,
      etag,
      lastModified,
      content,
      cachedAt: now,
      expiresAt: now + FEED_CACHE_TTL_MS,
      size,
    };

    await browser.storage.local.set({ [key]: entry });

    // Check if we need to evict old entries
    await evictOldEntriesIfNeeded();

    console.log(`[Feed Cache] Cached feed (${Math.round(size / 1024)}KB):`, url);
  } catch (error) {
    console.warn('[Feed Cache] Error setting cache entry:', error);
  }
}

/**
 * Remove a specific feed from the cache
 */
export async function removeFeedCache(url: string): Promise<void> {
  try {
    const key = getCacheKey(url);
    await browser.storage.local.remove(key);
  } catch (error) {
    console.warn('[Feed Cache] Error removing cache entry:', error);
  }
}

/**
 * Clear all feed cache entries
 */
export async function clearFeedCache(): Promise<void> {
  try {
    const allItems = await browser.storage.local.get(null);
    const cacheKeys = Object.keys(allItems).filter(key =>
      key.startsWith(STORAGE_KEY_FEED_CACHE_PREFIX)
    );

    if (cacheKeys.length > 0) {
      await browser.storage.local.remove(cacheKeys);
      console.log(`[Feed Cache] Cleared ${cacheKeys.length} cache entries`);
    }
  } catch (error) {
    console.warn('[Feed Cache] Error clearing cache:', error);
  }
}

/**
 * Get all feed cache entries (for debugging/stats)
 */
export async function getAllFeedCacheEntries(): Promise<FeedCacheEntry[]> {
  try {
    const allItems = await browser.storage.local.get(null);
    const entries: FeedCacheEntry[] = [];

    for (const [key, value] of Object.entries(allItems)) {
      if (key.startsWith(STORAGE_KEY_FEED_CACHE_PREFIX)) {
        entries.push(value as FeedCacheEntry);
      }
    }

    return entries;
  } catch (error) {
    console.warn('[Feed Cache] Error getting all entries:', error);
    return [];
  }
}

/**
 * Get cache statistics
 */
export async function getFeedCacheStats(): Promise<{
  entryCount: number;
  totalSizeBytes: number;
  oldestEntry: number | null;
}> {
  const entries = await getAllFeedCacheEntries();

  let totalSize = 0;
  let oldest: number | null = null;

  for (const entry of entries) {
    totalSize += entry.size;
    if (oldest === null || entry.cachedAt < oldest) {
      oldest = entry.cachedAt;
    }
  }

  return {
    entryCount: entries.length,
    totalSizeBytes: totalSize,
    oldestEntry: oldest,
  };
}

/**
 * Evict old cache entries if limits are exceeded
 */
async function evictOldEntriesIfNeeded(): Promise<void> {
  try {
    const entries = await getAllFeedCacheEntries();

    // Check limits
    let totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const needsEviction =
      entries.length > FEED_CACHE_MAX_ENTRIES ||
      totalSize > FEED_CACHE_MAX_SIZE_BYTES;

    if (!needsEviction) {
      return;
    }

    // Sort by cachedAt (oldest first)
    entries.sort((a, b) => a.cachedAt - b.cachedAt);

    const keysToRemove: string[] = [];

    // Remove oldest entries until under limits
    for (const entry of entries) {
      const stillOverLimit =
        (entries.length - keysToRemove.length) > FEED_CACHE_MAX_ENTRIES ||
        totalSize > FEED_CACHE_MAX_SIZE_BYTES;

      if (!stillOverLimit) {
        break;
      }

      keysToRemove.push(getCacheKey(entry.url));
      totalSize -= entry.size;
    }

    if (keysToRemove.length > 0) {
      await browser.storage.local.remove(keysToRemove);
      console.log(`[Feed Cache] Evicted ${keysToRemove.length} old entries`);
    }
  } catch (error) {
    console.warn('[Feed Cache] Error during eviction:', error);
  }
}

/**
 * Check if a feed should be fetched based on cache state
 * Returns conditional GET headers if cache exists
 */
export async function getConditionalHeaders(
  url: string
): Promise<{ etag?: string; lastModified?: string } | null> {
  const cached = await getFeedCache(url);

  if (!cached) {
    return null;
  }

  const headers: { etag?: string; lastModified?: string } = {};

  if (cached.etag) {
    headers.etag = cached.etag;
  }
  if (cached.lastModified) {
    headers.lastModified = cached.lastModified;
  }

  // Only return if we have at least one header
  if (headers.etag || headers.lastModified) {
    return headers;
  }

  return null;
}
