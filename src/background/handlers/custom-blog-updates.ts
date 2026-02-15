/**
 * Custom blog updates handler - checks for updates to user's custom blogs by fetching feeds
 */

import browser from '../../utils/browser';
import { isValidFeedUrl } from '../../utils/security';
import {
  STORAGE_KEY_CUSTOM_BLOGS,
  STORAGE_KEY_CUSTOM_BLOG_UPDATES,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS,
  STORAGE_KEY_LAST_DIRECTORY_VISIT,
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_COMMUNITY_UPDATES,
  STORAGE_KEY_FOLLOWED_FEED_URLS,
  STORAGE_KEY_DIRECTORY_BLOG_TITLES,
  STORAGE_KEY_COMMUNITY_BLOG_TITLES,
  CUSTOM_BLOG_CHECK_TIMEOUT,
  HEAD_REQUEST_TIMEOUT,
  USER_AGENT,
} from '../utils/constants';
import { processBatchWithConcurrency } from '../utils/fetch';
import { sendCustomBlogNotification } from '../utils/notifications';
import { getSettings, isFeatureMode, DEFAULT_SETTINGS } from '../storage/settings';
import { getDirectoryUpdatesState, getCommunityUpdatesState, getCustomBlogUpdatesState, updateCatalogBadge } from '../storage/state';
import { setFeedCache } from '../storage/feed-cache';
import { checkCatalogSnapshotFromAPI } from './catalog-updates';
import type {
  CustomBlogUpdatesState,
  CustomBlogState,
  CustomBlogSyncData,
  DirectoryBlogSyncData,
  CommunityBlogSyncData,
  ExtensionSettings,
  SyncAllBlogsRequest,
  CatalogSourceUpdatesState,
} from '../../utils/types';

/**
 * Storage for Last-Modified values from previous checks
 * Key: feedUrl, Value: Last-Modified timestamp in ms
 */
const STORAGE_KEY_FEED_LAST_MODIFIED = 'feedLastModified';

/**
 * Check if a feed has been modified using a HEAD request
 * This is much faster than fetching the full feed
 *
 * @param feedUrl - The URL of the feed to check
 * @param lastKnownModified - The last known modification time (ms)
 * @returns true if modified (or unknown), false if definitely not modified
 */
async function checkFeedModifiedViaHead(
  feedUrl: string,
  lastKnownModified: number | null
): Promise<{ modified: boolean; newLastModified: number | null }> {
  if (!lastKnownModified) {
    // No baseline to compare - must fetch
    return { modified: true, newLastModified: null };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEAD_REQUEST_TIMEOUT);

    const response = await fetch(feedUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Can't determine, assume modified
      return { modified: true, newLastModified: null };
    }

    const lastModifiedHeader = response.headers.get('Last-Modified');
    if (!lastModifiedHeader) {
      // Server doesn't support Last-Modified, assume modified
      return { modified: true, newLastModified: null };
    }

    const serverTime = new Date(lastModifiedHeader).getTime();
    if (isNaN(serverTime)) {
      return { modified: true, newLastModified: null };
    }

    // Compare with last known modification time
    const modified = serverTime > lastKnownModified;

    console.log(
      `[Service Worker] HEAD check for ${feedUrl}: ` +
      `server=${new Date(serverTime).toISOString()}, ` +
      `known=${new Date(lastKnownModified).toISOString()}, ` +
      `modified=${modified}`
    );

    return { modified, newLastModified: serverTime };
  } catch (error) {
    // HEAD failed, fall back to full fetch
    console.warn(`[Service Worker] HEAD request failed for ${feedUrl}:`, error);
    return { modified: true, newLastModified: null };
  }
}

/**
 * Get stored Last-Modified timestamps for feeds
 */
async function getStoredLastModified(): Promise<Record<string, number>> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_FEED_LAST_MODIFIED);
    return (result[STORAGE_KEY_FEED_LAST_MODIFIED] as Record<string, number>) || {};
  } catch {
    return {};
  }
}

/**
 * Store Last-Modified timestamp for a feed
 */
async function storeLastModified(feedUrl: string, timestamp: number): Promise<void> {
  try {
    const stored = await getStoredLastModified();
    stored[feedUrl] = timestamp;
    await browser.storage.local.set({ [STORAGE_KEY_FEED_LAST_MODIFIED]: stored });
  } catch (error) {
    console.warn('[Service Worker] Failed to store Last-Modified:', error);
  }
}

/**
 * Options for fetching newest post date
 */
interface FetchNewestPostDateOptions {
  /** Timeout in milliseconds (defaults to CUSTOM_BLOG_CHECK_TIMEOUT) */
  timeoutMs?: number;
  /** Cache the feed content for later use */
  cacheContent?: boolean;
}

/**
 * Fetch the newest post date from a feed
 * Returns timestamp in ms, or null if unable to determine
 *
 * Optimization: Uses HEAD request first to check Last-Modified header.
 * Only fetches full feed if HEAD indicates modification or is unavailable.
 *
 * @param feedUrl - The URL of the feed to check
 * @param lastKnownPostDate - The last known post date from web app (ms)
 * @param options - Optional configuration
 */
async function fetchNewestPostDate(
  feedUrl: string,
  lastKnownPostDate: number | null,
  options?: FetchNewestPostDateOptions
): Promise<number | null> {
  const timeout = options?.timeoutMs ?? CUSTOM_BLOG_CHECK_TIMEOUT;
  const cacheContent = options?.cacheContent ?? false;

  try {
    // Validate URL
    if (!isValidFeedUrl(feedUrl)) {
      console.warn('[Service Worker] Invalid feed URL:', feedUrl);
      return null;
    }

    // Try HEAD request first to check if feed has been modified
    const storedModified = await getStoredLastModified();
    const lastKnownModified = storedModified[feedUrl] || null;

    const headCheck = await checkFeedModifiedViaHead(feedUrl, lastKnownModified);

    if (!headCheck.modified && lastKnownPostDate !== null) {
      // Feed not modified according to HEAD - return existing date
      console.log(`[Service Worker] Feed not modified (HEAD), skipping full fetch: ${feedUrl}`);
      return lastKnownPostDate;
    }

    // Fetch full feed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Service Worker] Feed fetch failed: ${response.status}`);
        return null;
      }

      // Get headers for caching
      const lastModifiedHeader = response.headers.get('Last-Modified');
      const etagHeader = response.headers.get('ETag');

      // Store Last-Modified for future HEAD checks
      if (lastModifiedHeader) {
        const serverTime = new Date(lastModifiedHeader).getTime();
        if (!isNaN(serverTime)) {
          await storeLastModified(feedUrl, serverTime);
        }
      } else if (headCheck.newLastModified) {
        // Use the value from HEAD check
        await storeLastModified(feedUrl, headCheck.newLastModified);
      }

      const xml = await response.text();

      // Cache the content if requested (prefetch feature)
      if (cacheContent && xml) {
        try {
          await setFeedCache(feedUrl, xml, etagHeader, lastModifiedHeader);
          console.log(`[Service Worker] Prefetched feed cached: ${feedUrl}`);
        } catch (cacheError) {
          console.warn('[Service Worker] Failed to cache prefetched feed:', cacheError);
        }
      }

      // Quick regex-based date extraction (much faster than full parsing)
      // Search within first <item> or <entry> to get the newest post's date,
      // not a stale channel-level date
      const itemIdx = xml.search(/<item[\s>]/i);
      const entryIdx = xml.search(/<entry[\s>]/i);
      const firstItemIndex = itemIdx >= 0 && entryIdx >= 0
        ? Math.min(itemIdx, entryIdx)
        : Math.max(itemIdx, entryIdx);
      const searchXml = firstItemIndex >= 0 ? xml.slice(firstItemIndex) : xml;

      const datePatterns = [
        /<pubDate>([^<]+)<\/pubDate>/i,
        /<updated>([^<]+)<\/updated>/i,
        /<dc:date>([^<]+)<\/dc:date>/i,
        /<published>([^<]+)<\/published>/i,
      ];

      for (const pattern of datePatterns) {
        const match = searchXml.match(pattern);
        if (match && match[1]) {
          const date = new Date(match[1].trim());
          if (!isNaN(date.getTime())) {
            return date.getTime();
          }
        }
      }

      // If no date found, return null
      return null;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.warn(`[Service Worker] Failed to fetch newest post date from ${feedUrl}:`, error);
    return null;
  }
}

/**
 * Check custom blogs for updates by fetching each feed and comparing post dates
 * Respects concurrency and throttling settings
 */
export async function checkCustomBlogUpdates(options?: { silent?: boolean }): Promise<void> {
  const { silent = false } = options ?? {};

  try {
    // Check if in featured mode
    const isFeatured = await isFeatureMode();
    if (!isFeatured) {
      console.log('[Service Worker] Basic mode - skipping custom blog check');
      return;
    }

    // Get stored custom blogs and settings
    const result = await browser.storage.local.get([
      STORAGE_KEY_CUSTOM_BLOGS,
      STORAGE_KEY_CUSTOM_BLOG_UPDATES,
      STORAGE_KEY_SETTINGS,
    ]);

    const customBlogs = (result[STORAGE_KEY_CUSTOM_BLOGS] as CustomBlogSyncData[] | undefined) || [];
    const currentState = (result[STORAGE_KEY_CUSTOM_BLOG_UPDATES] as CustomBlogUpdatesState | undefined) || null;
    const settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY_SETTINGS] as Partial<ExtensionSettings> | undefined) };

    if (customBlogs.length === 0) {
      console.log('[Service Worker] No custom blogs to check');
      return;
    }

    const maxConcurrent = settings.maxConcurrentRequests;
    const delayMs = settings.requestDelayMs;
    const prefetchOnUpdate = settings.prefetchOnUpdate ?? false;

    console.log(`[Service Worker] Checking ${customBlogs.length} custom blogs (concurrency: ${maxConcurrent}, delay: ${delayMs}ms, prefetch: ${prefetchOnUpdate})...`);

    // Process blogs with configurable concurrency and throttling
    const blogStates: CustomBlogState[] = [];
    let updatedCount = 0;

    // Define processor for each blog
    const processBlog = async (blog: CustomBlogSyncData): Promise<CustomBlogState> => {
      // Look up existing state for this blog (from previous check or acknowledge)
      const existingState = currentState?.blogs.find(b => b.feedUrl === blog.feedUrl);

      // Baseline comes from extension-maintained state only.
      // Sync seeds lastKnownPostDate for new blogs; acknowledge advances it.
      const effectiveBaseline = existingState?.lastKnownPostDate
        ?? existingState?.currentPostDate
        ?? null;

      try {
        // Pass effectiveBaseline for HEAD optimization and prefetch setting
        const newestPostDate = await fetchNewestPostDate(
          blog.feedUrl,
          effectiveBaseline,
          {
            timeoutMs: settings.requestTimeoutSeconds * 1000,
            cacheContent: prefetchOnUpdate,
          }
        );

        // Only flag updates when we have both a baseline and a newer date
        const hasUpdates = newestPostDate !== null &&
          effectiveBaseline !== null &&
          newestPostDate > effectiveBaseline;

        return {
          feedUrl: blog.feedUrl,
          title: blog.title,
          lastKnownPostDate: effectiveBaseline,
          currentPostDate: newestPostDate,
          lastCheckedAt: Date.now(),
          hasUpdates,
          errorCount: 0,
        };
      } catch (error) {
        console.warn(`[Service Worker] Failed to check ${blog.feedUrl}:`, error);

        return {
          feedUrl: blog.feedUrl,
          title: blog.title,
          lastKnownPostDate: effectiveBaseline,
          currentPostDate: existingState?.currentPostDate ?? null,
          lastCheckedAt: Date.now(),
          hasUpdates: existingState?.hasUpdates ?? false,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          errorCount: (existingState?.errorCount ?? 0) + 1,
        };
      }
    };

    // Process all blogs with concurrency control
    const processedStates = await processBatchWithConcurrency(
      customBlogs,
      processBlog,
      { maxConcurrent, delayMs }
    );

    for (const state of processedStates) {
      blogStates.push(state);
    }

    // Re-read state to pick up any concurrent acknowledge that advanced baselines
    // (e.g., ACKNOWLEDGE_UPDATES arrived while we were fetching feeds).
    // Everything between this read and the write below is synchronous,
    // so no other handler can interleave.
    const freshState = await getCustomBlogUpdatesState();
    if (freshState) {
      for (const state of blogStates) {
        const fresh = freshState.blogs.find(b => b.feedUrl === state.feedUrl);
        if (!fresh) continue;

        // Case 1: Acknowledge advanced the baseline — use it
        if (fresh.lastKnownPostDate !== null &&
          (state.lastKnownPostDate === null || fresh.lastKnownPostDate > state.lastKnownPostDate)) {
          state.lastKnownPostDate = fresh.lastKnownPostDate;
          state.hasUpdates = state.currentPostDate !== null && state.currentPostDate > fresh.lastKnownPostDate;
        }
        // Case 2: Blog was acknowledged (hasUpdates cleared) but baselines match
        // This catches edge cases where acknowledge set lastKnownPostDate = effectiveBaseline
        // (e.g., when lastKnownPostDate was null and currentPostDate was used as fallback)
        else if (!fresh.hasUpdates && state.hasUpdates &&
          fresh.lastKnownPostDate !== null &&
          state.currentPostDate !== null &&
          state.currentPostDate <= fresh.lastKnownPostDate) {
          state.lastKnownPostDate = fresh.lastKnownPostDate;
          state.hasUpdates = false;
        }
      }
    }

    // Count updates after merging
    for (const state of blogStates) {
      if (state.hasUpdates) {
        updatedCount++;
      }
    }

    // Update state
    const now = Date.now();
    const newState: CustomBlogUpdatesState = {
      status: 'success',
      blogs: blogStates,
      updatedCount,
      totalCount: customBlogs.length,
      lastCheckedAt: now,
      lastSyncAt: currentState?.lastSyncAt ?? now,
    };

    await browser.storage.local.set({
      [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: newState,
    });

    // Update badge (combine with directory + community updates count)
    const dirState = await getDirectoryUpdatesState();
    const commState = await getCommunityUpdatesState();
    const totalUpdates = updatedCount + (dirState?.updatedCount ?? 0) + (commState?.updatedCount ?? 0);
    await updateCatalogBadge(totalUpdates);

    // Send notification if there are new updates and not silent
    if (!silent && updatedCount > 0 && settings.notificationsEnabled && settings.customBlogNotificationsEnabled) {
      await sendCustomBlogNotification(updatedCount, customBlogs.length);
    }

    console.log(`[Service Worker] Custom blog check complete: ${updatedCount} of ${customBlogs.length} have updates`);

  } catch (error) {
    console.error('[Service Worker] Custom blog check failed:', error);

    // Update state to show error
    const errorState: CustomBlogUpdatesState = {
      status: 'error',
      blogs: [],
      updatedCount: 0,
      totalCount: 0,
      lastCheckedAt: Date.now(),
      lastSyncAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await browser.storage.local.set({
      [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: errorState,
    });
  }
}

/**
 * Force check for custom blog updates (bypasses any cache)
 */
export async function forceCheckCustomBlogUpdates(): Promise<void> {
  console.log('[Service Worker] Force checking custom blog updates...');
  await checkCustomBlogUpdates({ silent: true });
}

/**
 * Handle the new SYNC_ALL_BLOGS message from web app
 * This syncs directory, community, and custom blogs (the full catalog)
 */
export async function handleSyncAllBlogs(message: SyncAllBlogsRequest): Promise<void> {
  try {
    const { directoryBlogs, communityBlogs, customBlogs, followedFeedUrls, lastVisit } = message;
    const now = Date.now();
    const isFeatured = await isFeatureMode();

    // Handle both old format (string[]) and new format (DirectoryBlogSyncData[])
    // This ensures backward compatibility with older web app versions
    let directoryBlogIds: string[];
    let directoryBlogTitles: Record<string, string> = {};

    if (directoryBlogs.length > 0 && typeof directoryBlogs[0] === 'string') {
      // Old format: just IDs (no titles available)
      directoryBlogIds = directoryBlogs as unknown as string[];
    } else {
      // New format: objects with id and title
      const typedBlogs = directoryBlogs as DirectoryBlogSyncData[];
      directoryBlogIds = typedBlogs.map(b => b.id);
      for (const blog of typedBlogs) {
        directoryBlogTitles[blog.id] = blog.title;
      }
    }

    // Process community blogs (always new format)
    const communityBlogList = communityBlogs ?? [];
    const communityBlogIds: string[] = communityBlogList.map(b => b.id);
    const communityBlogTitles: Record<string, string> = {};
    for (const blog of communityBlogList) {
      communityBlogTitles[blog.id] = blog.title;
    }

    console.log('[Service Worker] Syncing all blogs:', {
      directoryCount: directoryBlogIds.length,
      communityCount: communityBlogIds.length,
      customCount: customBlogs.length,
      feedUrlCount: followedFeedUrls?.length ?? 0,
      lastVisit: lastVisit ? new Date(lastVisit).toISOString() : null,
      mode: isFeatured ? 'featured' : 'basic',
      hasDirectoryTitles: Object.keys(directoryBlogTitles).length > 0,
      hasCommunityTitles: Object.keys(communityBlogTitles).length > 0,
    });

    // Store directory blog IDs
    await browser.storage.local.set({
      [STORAGE_KEY_FOLLOWED_BLOGS]: directoryBlogIds,
    });

    // Store directory blog titles (ID -> title mapping)
    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_BLOG_TITLES]: directoryBlogTitles,
    });

    // Store community blog IDs
    await browser.storage.local.set({
      [STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS]: communityBlogIds,
    });

    // Store community blog titles (ID -> title mapping)
    await browser.storage.local.set({
      [STORAGE_KEY_COMMUNITY_BLOG_TITLES]: communityBlogTitles,
    });

    // Store custom blogs
    await browser.storage.local.set({
      [STORAGE_KEY_CUSTOM_BLOGS]: customBlogs,
    });

    // Store all followed feed URLs for duplicate detection in feed discovery
    if (followedFeedUrls) {
      await browser.storage.local.set({
        [STORAGE_KEY_FOLLOWED_FEED_URLS]: followedFeedUrls,
      });
    }

    // Store last visit timestamp if provided
    if (lastVisit !== null) {
      await browser.storage.local.set({
        [STORAGE_KEY_LAST_DIRECTORY_VISIT]: lastVisit,
      });
    }

    // In basic mode, just store the data and skip update checking
    if (!isFeatured) {
      console.log('[Service Worker] Basic mode - skipping update checks');

      // Update directory state to show disabled
      const basicDirState: CatalogSourceUpdatesState = {
        status: 'idle',
        isEnabled: false,
        updatedCount: 0,
        followedCount: directoryBlogIds.length,
        totalBlogs: null,
        lastCheckedAt: null,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: directoryBlogIds.length > 0 ? 'synced' : 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: basicDirState,
      });

      // Update community state to show disabled
      const basicCommState: CatalogSourceUpdatesState = {
        status: 'idle',
        isEnabled: false,
        updatedCount: 0,
        followedCount: communityBlogIds.length,
        totalBlogs: null,
        lastCheckedAt: null,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: communityBlogIds.length > 0 ? 'synced' : 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_COMMUNITY_UPDATES]: basicCommState,
      });

      // Update custom blog state to show disabled
      const basicCustomState: CustomBlogUpdatesState = {
        status: 'idle',
        blogs: [],
        updatedCount: 0,
        totalCount: customBlogs.length,
        lastCheckedAt: null,
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: basicCustomState,
      });

      // Clear any existing badge in basic mode
      await updateCatalogBadge(0);
      return;
    }

    // Featured mode: proceed with update checking

    // Handle empty catalog states
    if (directoryBlogIds.length === 0) {
      const emptyDirState: CatalogSourceUpdatesState = {
        status: 'success',
        isEnabled: true,
        updatedCount: 0,
        followedCount: 0,
        totalBlogs: null,
        lastCheckedAt: now,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: emptyDirState,
      });
    }

    if (communityBlogIds.length === 0) {
      const emptyCommState: CatalogSourceUpdatesState = {
        status: 'success',
        isEnabled: true,
        updatedCount: 0,
        followedCount: 0,
        totalBlogs: null,
        lastCheckedAt: now,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_COMMUNITY_UPDATES]: emptyCommState,
      });
    }

    // Check both catalogs via snapshot (single request, don't await)
    if (directoryBlogIds.length > 0 || communityBlogIds.length > 0) {
      checkCatalogSnapshotFromAPI({ skipCache: true, silent: true }).catch((error) => {
        console.error('[Service Worker] Catalog snapshot check failed:', error);
      });
    }

    // Handle custom blogs
    if (customBlogs.length === 0) {
      const emptyCustomState: CustomBlogUpdatesState = {
        status: 'success',
        blogs: [],
        updatedCount: 0,
        totalCount: 0,
        lastCheckedAt: now,
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: emptyCustomState,
      });
    } else {
      // Preserve existing blog state across syncs (sync manages the list, not baselines)
      const existingCustomState = await getCustomBlogUpdatesState();
      const existingBlogMap = new Map(
        existingCustomState?.blogs.map(b => [b.feedUrl, b]) ?? []
      );

      const blogStates: CustomBlogState[] = customBlogs.map((blog) => {
        const existing = existingBlogMap.get(blog.feedUrl);
        if (existing) {
          // Existing blog: preserve all state, just update title
          return { ...existing, title: blog.title };
        }
        // New blog: seed baseline from web app
        return {
          feedUrl: blog.feedUrl,
          title: blog.title,
          lastKnownPostDate: blog.lastPostDate,
          currentPostDate: null,
          lastCheckedAt: null,
          hasUpdates: false,
          errorCount: 0,
        };
      });

      const pendingUpdatedCount = blogStates.filter(b => b.hasUpdates).length;

      // If there are pending updates, the user is visiting the dashboard
      // and will acknowledge them. Don't trigger a new check — it would race
      // with the acknowledge and could overwrite the cleared state.
      // The periodic alarm will handle the next check.
      if (pendingUpdatedCount > 0) {
        const preservedCustomState: CustomBlogUpdatesState = {
          status: existingCustomState?.status === 'error' ? 'error' : 'success',
          blogs: blogStates,
          updatedCount: pendingUpdatedCount,
          totalCount: customBlogs.length,
          lastCheckedAt: existingCustomState?.lastCheckedAt ?? null,
          lastSyncAt: now,
          ...(existingCustomState?.error ? { error: existingCustomState.error } : {}),
        };
        await browser.storage.local.set({
          [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: preservedCustomState,
        });
        console.log(`[Service Worker] Skipping custom blog check — ${pendingUpdatedCount} pending updates will be acknowledged`);
      } else {
        const checkingCustomState: CustomBlogUpdatesState = {
          status: 'checking',
          blogs: blogStates,
          updatedCount: 0,
          totalCount: customBlogs.length,
          lastCheckedAt: existingCustomState?.lastCheckedAt ?? null,
          lastSyncAt: now,
        };
        await browser.storage.local.set({
          [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: checkingCustomState,
        });

        // Check custom blog updates (don't await - let it run in background)
        checkCustomBlogUpdates({ silent: true }).catch((error) => {
          console.error('[Service Worker] Custom blog updates check failed:', error);
        });
      }
    }

  } catch (error) {
    console.error('[Service Worker] Failed to sync all blogs:', error);
  }
}
