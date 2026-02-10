/**
 * Directory updates handler - checks for updates to followed blogs from the directory.
 * Delegates to the unified catalog snapshot API.
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_LAST_DIRECTORY_VISIT,
  STORAGE_KEY_DIRECTORY_UPDATES,
} from '../utils/constants';
import { isFeatureMode } from '../storage/settings';
import { getDirectoryUpdatesState, updateCatalogBadge } from '../storage/state';
import { checkCatalogSnapshotFromAPI } from './catalog-updates';
import type {
  CatalogSourceUpdatesState,
  SyncFollowedBlogsRequest,
} from '../../utils/types';

/**
 * Force check for directory updates (bypasses cache, used by popup refresh button).
 * Uses the unified snapshot endpoint which checks both catalogs in one request.
 */
export async function forceCheckDirectoryUpdates(): Promise<void> {
  await checkCatalogSnapshotFromAPI({ skipCache: true, silent: true });
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
      const basicState: CatalogSourceUpdatesState = {
        status: 'idle',
        isEnabled: false, // Disabled in basic mode
        updatedCount: 0,
        followedCount: blogIds.length,
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
      await updateCatalogBadge(0);
      return;
    }

    // Featured mode: proceed with update checking

    // If no blogs to follow, update state to reflect that (no API call needed)
    if (blogIds.length === 0) {
      const emptyState: CatalogSourceUpdatesState = {
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
        [STORAGE_KEY_DIRECTORY_UPDATES]: emptyState,
      });

      // Clear any existing badge
      await updateCatalogBadge(0);

      console.log('[Service Worker] No directory blogs followed, state updated');
      return;
    }

    // Update state to show we're synced and about to check
    const currentState = await getDirectoryUpdatesState();
    const checkingState: CatalogSourceUpdatesState = {
      status: 'checking',
      isEnabled: true,
      updatedCount: currentState?.updatedCount ?? 0,
      followedCount: blogIds.length,
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

    // Immediately check for updates after syncing via snapshot (gets both catalogs)
    await checkCatalogSnapshotFromAPI({ skipCache: true, silent: true });

  } catch (error) {
    console.error('[Service Worker] Failed to sync followed blogs:', error);
  }
}
