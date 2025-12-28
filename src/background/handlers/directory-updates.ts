/**
 * Directory updates handler - checks for updates to followed blogs from the directory
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_LAST_DIRECTORY_VISIT,
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_DIRECTORY_BLOG_TITLES,
  DIRECTORY_UPDATES_API,
  DIRECTORY_CACHE_TTL_MS,
  USER_AGENT,
} from '../utils/constants';
import { sendBlogUpdatesNotification } from '../utils/notifications';
import { getSettings, isFeatureMode, DEFAULT_SETTINGS } from '../storage/settings';
import { getDirectoryUpdatesState, updateDirectoryBadge } from '../storage/state';
import type {
  DirectoryUpdatesState,
  ExtensionSettings,
  SyncFollowedBlogsRequest,
} from '../../utils/types';

/**
 * Check directory updates by calling the API directly
 * @param options.skipCache - If true, bypass the cache TTL check
 * @param options.silent - If true, don't send push notifications
 *
 * NOTE: This function respects the extension mode setting.
 * In basic mode, it will skip the API check entirely.
 */
export async function checkDirectoryUpdatesFromAPI(options?: {
  skipCache?: boolean;
  silent?: boolean;
}): Promise<void> {
  const { skipCache = false, silent = false } = options ?? {};

  try {
    // Get stored followed blogs, last visit, current state, settings, and blog titles
    const result = await browser.storage.local.get([
      STORAGE_KEY_FOLLOWED_BLOGS,
      STORAGE_KEY_LAST_DIRECTORY_VISIT,
      STORAGE_KEY_DIRECTORY_UPDATES,
      STORAGE_KEY_SETTINGS,
      STORAGE_KEY_DIRECTORY_BLOG_TITLES,
    ]);

    const followedBlogIds = (result[STORAGE_KEY_FOLLOWED_BLOGS] as string[] | undefined) || [];
    const lastVisit = (result[STORAGE_KEY_LAST_DIRECTORY_VISIT] as number | undefined) || null;
    const currentState = (result[STORAGE_KEY_DIRECTORY_UPDATES] as DirectoryUpdatesState | undefined) || null;
    const settings = (result[STORAGE_KEY_SETTINGS] as ExtensionSettings | undefined) || DEFAULT_SETTINGS;
    const blogTitles = (result[STORAGE_KEY_DIRECTORY_BLOG_TITLES] as Record<string, string> | undefined) || {};
    const previousUpdateCount = currentState?.updatedCount ?? 0;

    // Skip update checking in basic mode
    if (settings.extensionMode === 'basic') {
      console.log('[Service Worker] Basic mode - skipping directory API check');
      return;
    }

    // Skip if no followed blogs - but preserve sync status in state
    if (followedBlogIds.length === 0) {
      console.log('[Service Worker] No followed blogs, skipping directory check');
      // Don't just return - update state so popup knows why
      if (!currentState || currentState.syncStatus !== 'synced_empty') {
        const noFollowsState: DirectoryUpdatesState = {
          status: 'success',
          isEnabled: true,
          updatedCount: 0,
          followedDirectoryCount: 0,
          totalBlogs: null,
          lastCheckedAt: Date.now(),
          nextCheckAt: null,
          sinceTimestamp: lastVisit,
          syncStatus: currentState?.syncStatus ?? 'not_synced',
          lastSyncAt: currentState?.lastSyncAt ?? null,
        };
        await browser.storage.local.set({
          [STORAGE_KEY_DIRECTORY_UPDATES]: noFollowsState,
        });
      }
      return;
    }

    // Check cache freshness - skip if we checked recently (unless skipCache is true)
    if (!skipCache && currentState?.lastCheckedAt) {
      const cacheAge = Date.now() - currentState.lastCheckedAt;
      if (cacheAge < DIRECTORY_CACHE_TTL_MS) {
        console.log('[Service Worker] Directory cache still fresh, skipping API call');
        return;
      }
    }

    console.log('[Service Worker] Checking directory updates from API...', { skipCache, silent });

    // Build URL with since parameter
    let url = DIRECTORY_UPDATES_API;
    if (lastVisit) {
      const sinceISO = new Date(lastVisit).toISOString();
      url += `?since=${encodeURIComponent(sinceISO)}`;
    }

    // Call the API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json() as {
      updated_blog_ids: string[];
      last_checked_at: string | null;
      next_check_at: string | null;
      total_directory_blogs: number;
    };

    // Count how many of the user's followed blogs have updates
    const updatedBlogIds = new Set(data.updated_blog_ids);
    const followedWithUpdates = followedBlogIds.filter(id => updatedBlogIds.has(id));
    const updatedCount = followedWithUpdates.length;

    // Build array of updated blogs with titles for popup display
    const updatedBlogs = followedWithUpdates.map(id => ({
      id,
      title: blogTitles[id] || 'Unknown Blog',
    }));

    console.log(`[Service Worker] Directory check: ${updatedCount} of ${followedBlogIds.length} followed blogs have updates`);

    // Store the state (preserve sync status from current state)
    const newState: DirectoryUpdatesState = {
      status: 'success',
      isEnabled: true,
      updatedCount,
      followedDirectoryCount: followedBlogIds.length,
      totalBlogs: data.total_directory_blogs,
      lastCheckedAt: Date.now(),
      nextCheckAt: data.next_check_at ? new Date(data.next_check_at).getTime() : null,
      sinceTimestamp: lastVisit,
      syncStatus: currentState?.syncStatus ?? 'synced',
      lastSyncAt: currentState?.lastSyncAt ?? null,
      // Include updated blogs with titles for popup display
      updatedBlogs: Object.keys(blogTitles).length > 0 ? updatedBlogs : undefined,
    };

    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_UPDATES]: newState,
    });

    // Update badge
    await updateDirectoryBadge(updatedCount);

    // Send push notification if updates increased and notifications enabled
    if (
      !silent &&
      updatedCount > 0 &&
      updatedCount > previousUpdateCount &&
      settings.blogUpdateNotificationsEnabled
    ) {
      await sendBlogUpdatesNotification(updatedCount, followedBlogIds.length);
    }

  } catch (error) {
    console.error('[Service Worker] Failed to check directory updates:', error);

    // Get current state to preserve sync info
    const result = await browser.storage.local.get(STORAGE_KEY_DIRECTORY_UPDATES);
    const existingState = (result[STORAGE_KEY_DIRECTORY_UPDATES] as DirectoryUpdatesState | undefined) || null;

    // Store error state but preserve sync info and don't clear badge
    const errorState: DirectoryUpdatesState = {
      status: 'error',
      isEnabled: true,
      updatedCount: existingState?.updatedCount ?? 0,
      followedDirectoryCount: existingState?.followedDirectoryCount ?? 0,
      totalBlogs: existingState?.totalBlogs ?? null,
      lastCheckedAt: Date.now(),
      nextCheckAt: null,
      sinceTimestamp: existingState?.sinceTimestamp ?? null,
      error: error instanceof Error ? error.message : 'Unknown error',
      syncStatus: existingState?.syncStatus ?? 'not_synced',
      lastSyncAt: existingState?.lastSyncAt ?? null,
    };

    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_UPDATES]: errorState,
    });
  }
}

/**
 * Force check for directory updates (bypasses cache, used by popup refresh button)
 */
export async function forceCheckDirectoryUpdates(): Promise<void> {
  console.log('[Service Worker] Force checking directory updates...');
  await checkDirectoryUpdatesFromAPI({ skipCache: true, silent: true });
}

/**
 * Handle followed blogs sync from web app
 * After syncing, immediately check for updates
 *
 * NOTE: In basic mode, we still store the data but skip the API check.
 * This allows switching to featured mode without requiring a new sync.
 */
export async function handleSyncFollowedBlogs(
  message: SyncFollowedBlogsRequest
): Promise<void> {
  try {
    const { blogIds, lastVisit } = message;
    const now = Date.now();

    // Check if we're in featured mode
    const isFeatured = await isFeatureMode();

    console.log('[Service Worker] Syncing followed blogs:', {
      count: blogIds.length,
      lastVisit: lastVisit ? new Date(lastVisit).toISOString() : null,
      mode: isFeatured ? 'featured' : 'basic',
    });

    // Store followed blog IDs
    await browser.storage.local.set({
      [STORAGE_KEY_FOLLOWED_BLOGS]: blogIds,
    });

    // Store last visit timestamp if provided
    if (lastVisit !== null) {
      await browser.storage.local.set({
        [STORAGE_KEY_LAST_DIRECTORY_VISIT]: lastVisit,
      });
    }

    // In basic mode, just store the data and skip update checking
    if (!isFeatured) {
      console.log('[Service Worker] Basic mode - skipping directory update check');
      // Still update the sync status so popup can show accurate state
      const basicState: DirectoryUpdatesState = {
        status: 'idle',
        isEnabled: false, // Disabled in basic mode
        updatedCount: 0,
        followedDirectoryCount: blogIds.length,
        totalBlogs: null,
        lastCheckedAt: null,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: blogIds.length > 0 ? 'synced' : 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: basicState,
      });
      // Clear any existing badge in basic mode
      await updateDirectoryBadge(0);
      return;
    }

    // Featured mode: proceed with update checking

    // If no blogs to follow, update state to reflect that (no API call needed)
    if (blogIds.length === 0) {
      const emptyState: DirectoryUpdatesState = {
        status: 'success',
        isEnabled: true,
        updatedCount: 0,
        followedDirectoryCount: 0,
        totalBlogs: null,
        lastCheckedAt: now,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: 'synced_empty',
        lastSyncAt: now,
      };

      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: emptyState,
      });

      // Clear any existing badge
      await updateDirectoryBadge(0);

      console.log('[Service Worker] No directory blogs followed, state updated');
      return;
    }

    // Update state to show we're synced and about to check
    const currentState = await getDirectoryUpdatesState();
    const checkingState: DirectoryUpdatesState = {
      status: 'checking',
      isEnabled: true,
      updatedCount: currentState?.updatedCount ?? 0,
      followedDirectoryCount: blogIds.length,
      totalBlogs: currentState?.totalBlogs ?? null,
      lastCheckedAt: currentState?.lastCheckedAt ?? null,
      nextCheckAt: currentState?.nextCheckAt ?? null,
      sinceTimestamp: lastVisit,
      syncStatus: 'synced',
      lastSyncAt: now,
    };

    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_UPDATES]: checkingState,
    });

    // Immediately check for updates after syncing (skip cache since we just synced)
    await checkDirectoryUpdatesFromAPI({ skipCache: true, silent: true });

  } catch (error) {
    console.error('[Service Worker] Failed to sync followed blogs:', error);
  }
}
