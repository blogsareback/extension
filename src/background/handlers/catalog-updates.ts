/**
 * Unified catalog updates handler - checks for updates to followed blogs
 * Works for both directory and community blog sources.
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_LAST_DIRECTORY_VISIT,
  STORAGE_KEY_SETTINGS,
  CATALOG_CACHE_TTL_MS,
  USER_AGENT,
} from '../utils/constants';
import { sendBlogUpdatesNotification } from '../utils/notifications';
import { DEFAULT_SETTINGS } from '../storage/settings';
import { getDirectoryUpdatesState, getCommunityUpdatesState, getCustomBlogUpdatesState, updateCatalogBadge } from '../storage/state';
import type {
  CatalogSourceUpdatesState,
  ExtensionSettings,
} from '../../utils/types';

/**
 * Configuration for a catalog source (directory or community)
 */
export interface CatalogSourceConfig {
  /** Source name for logging */
  name: 'directory' | 'community';
  /** Storage key for followed blog IDs */
  followedBlogsKey: string;
  /** Storage key for update state */
  updatesStateKey: string;
  /** Storage key for blog titles mapping */
  blogTitlesKey: string;
  /** API endpoint URL */
  apiUrl: string;
  /** Field name for total blogs in API response */
  totalBlogsField: 'total_directory_blogs' | 'total_community_blogs';
}

/**
 * Get the other sources' update count for badge calculation
 */
async function getOtherSourcesUpdateCount(currentSource: 'directory' | 'community'): Promise<number> {
  const customState = await getCustomBlogUpdatesState();
  const customCount = customState?.updatedCount ?? 0;

  if (currentSource === 'directory') {
    const commState = await getCommunityUpdatesState();
    return (commState?.updatedCount ?? 0) + customCount;
  } else {
    const dirState = await getDirectoryUpdatesState();
    return (dirState?.updatedCount ?? 0) + customCount;
  }
}

/**
 * Check catalog source updates by calling the API directly
 */
export async function checkCatalogSourceUpdates(
  config: CatalogSourceConfig,
  options?: { skipCache?: boolean; silent?: boolean }
): Promise<void> {
  const { skipCache = false, silent = false } = options ?? {};
  const { name, followedBlogsKey, updatesStateKey, blogTitlesKey, apiUrl, totalBlogsField } = config;

  try {
    const result = await browser.storage.local.get([
      followedBlogsKey,
      STORAGE_KEY_LAST_DIRECTORY_VISIT,
      updatesStateKey,
      STORAGE_KEY_SETTINGS,
      blogTitlesKey,
    ]);

    const followedBlogIds = (result[followedBlogsKey] as string[] | undefined) || [];
    const lastVisit = (result[STORAGE_KEY_LAST_DIRECTORY_VISIT] as number | undefined) || null;
    const currentState = (result[updatesStateKey] as CatalogSourceUpdatesState | undefined) || null;
    const settings = (result[STORAGE_KEY_SETTINGS] as ExtensionSettings | undefined) || DEFAULT_SETTINGS;
    const blogTitles = (result[blogTitlesKey] as Record<string, string> | undefined) || {};
    const previousUpdateCount = currentState?.updatedCount ?? 0;

    // Skip in basic mode
    if (settings.extensionMode === 'basic') {
      console.log(`[Service Worker] Basic mode - skipping ${name} API check`);
      return;
    }

    // Skip if no followed blogs
    if (followedBlogIds.length === 0) {
      console.log(`[Service Worker] No followed ${name} blogs, skipping check`);
      if (!currentState || currentState.syncStatus !== 'synced_empty') {
        await browser.storage.local.set({
          [updatesStateKey]: {
            status: 'success',
            isEnabled: true,
            updatedCount: 0,
            followedCount: 0,
            totalBlogs: null,
            lastCheckedAt: Date.now(),
            nextCheckAt: null,
            sinceTimestamp: lastVisit,
            syncStatus: currentState?.syncStatus ?? 'not_synced',
            lastSyncAt: currentState?.lastSyncAt ?? null,
          } satisfies CatalogSourceUpdatesState,
        });
      }
      return;
    }

    // Check cache freshness
    if (!skipCache && currentState?.lastCheckedAt) {
      const cacheAge = Date.now() - currentState.lastCheckedAt;
      if (cacheAge < CATALOG_CACHE_TTL_MS) {
        console.log(`[Service Worker] ${name} cache still fresh, skipping API call`);
        return;
      }
    }

    console.log(`[Service Worker] Checking ${name} updates from API...`, { skipCache, silent });

    // Build URL with since parameter
    let url = apiUrl;
    if (lastVisit) {
      url += `?since=${encodeURIComponent(new Date(lastVisit).toISOString())}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json() as {
      updated_blog_ids: string[];
      last_checked_at: string | null;
      next_check_at: string | null;
      total_directory_blogs?: number;
      total_community_blogs?: number;
    };

    // Count followed blogs with updates
    const updatedBlogIds = new Set(data.updated_blog_ids);
    const followedWithUpdates = followedBlogIds.filter(id => updatedBlogIds.has(id));
    const updatedCount = followedWithUpdates.length;

    const updatedBlogs = followedWithUpdates.map(id => ({
      id,
      title: blogTitles[id] || 'Unknown Blog',
    }));

    console.log(`[Service Worker] ${name} check: ${updatedCount} of ${followedBlogIds.length} followed blogs have updates`);

    const newState: CatalogSourceUpdatesState = {
      status: 'success',
      isEnabled: true,
      updatedCount,
      followedCount: followedBlogIds.length,
      totalBlogs: data[totalBlogsField] ?? null,
      lastCheckedAt: Date.now(),
      nextCheckAt: data.next_check_at ? new Date(data.next_check_at).getTime() : null,
      sinceTimestamp: lastVisit,
      syncStatus: currentState?.syncStatus ?? 'synced',
      lastSyncAt: currentState?.lastSyncAt ?? null,
      updatedBlogs: Object.keys(blogTitles).length > 0 ? updatedBlogs : undefined,
    };

    await browser.storage.local.set({ [updatesStateKey]: newState });

    // Update badge
    const otherSourcesCount = await getOtherSourcesUpdateCount(name);
    await updateCatalogBadge(updatedCount + otherSourcesCount);

    // Send notification if updates increased
    if (!silent && updatedCount > 0 && updatedCount > previousUpdateCount && settings.blogUpdateNotificationsEnabled) {
      await sendBlogUpdatesNotification(updatedCount, followedBlogIds.length);
    }

  } catch (error) {
    console.error(`[Service Worker] Failed to check ${name} updates:`, error);

    const result = await browser.storage.local.get(updatesStateKey);
    const existingState = (result[updatesStateKey] as CatalogSourceUpdatesState | undefined) || null;

    const errorState: CatalogSourceUpdatesState = {
      status: 'error',
      isEnabled: true,
      updatedCount: existingState?.updatedCount ?? 0,
      followedCount: existingState?.followedCount ?? 0,
      totalBlogs: existingState?.totalBlogs ?? null,
      lastCheckedAt: Date.now(),
      nextCheckAt: null,
      sinceTimestamp: existingState?.sinceTimestamp ?? null,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncStatus: existingState?.syncStatus ?? 'not_synced',
      lastSyncAt: existingState?.lastSyncAt ?? null,
    };

    await browser.storage.local.set({ [updatesStateKey]: errorState });
  }
}

/**
 * Force check for catalog source updates (bypasses cache)
 */
export async function forceCheckCatalogSource(config: CatalogSourceConfig): Promise<void> {
  console.log(`[Service Worker] Force checking ${config.name} updates...`);
  await checkCatalogSourceUpdates(config, { skipCache: true, silent: true });
}
