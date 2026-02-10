/**
 * Catalog updates handler - checks for updates to followed blogs
 * via /api/catalog/snapshot (single CDN-cacheable request for both catalogs).
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_LAST_DIRECTORY_VISIT,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS,
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_COMMUNITY_UPDATES,
  STORAGE_KEY_DIRECTORY_BLOG_TITLES,
  STORAGE_KEY_COMMUNITY_BLOG_TITLES,
  CATALOG_CACHE_TTL_MS,
  CATALOG_SNAPSHOT_API,
  USER_AGENT,
} from '../utils/constants';
import { sendBlogUpdatesNotification } from '../utils/notifications';
import { DEFAULT_SETTINGS } from '../storage/settings';
import { getCustomBlogUpdatesState, updateCatalogBadge } from '../storage/state';
import type {
  CatalogSourceUpdatesState,
  ExtensionSettings,
} from '../../utils/types';

interface SnapshotSection {
  blog_last_post_dates: Record<string, string>;
  last_checked_at: string | null;
  next_check_at: string | null;
  total_blogs: number;
}

interface SnapshotResponse {
  directory: SnapshotSection;
  community: SnapshotSection;
}

/**
 * Check both catalogs in a single request via /api/catalog/snapshot.
 * One URL, no query params, fully CDN-cacheable.
 * Filters locally by lastVisit, updates both states and badge.
 */
export async function checkCatalogSnapshotFromAPI(options?: {
  skipCache?: boolean;
  silent?: boolean;
}): Promise<void> {
  const { skipCache = false, silent = false } = options ?? {};

  try {
    const result = await browser.storage.local.get([
      STORAGE_KEY_FOLLOWED_BLOGS,
      STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS,
      STORAGE_KEY_LAST_DIRECTORY_VISIT,
      STORAGE_KEY_DIRECTORY_UPDATES,
      STORAGE_KEY_COMMUNITY_UPDATES,
      STORAGE_KEY_SETTINGS,
      STORAGE_KEY_DIRECTORY_BLOG_TITLES,
      STORAGE_KEY_COMMUNITY_BLOG_TITLES,
    ]);

    const dirFollowed = (result[STORAGE_KEY_FOLLOWED_BLOGS] as string[] | undefined) || [];
    const commFollowed = (result[STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS] as string[] | undefined) || [];
    const lastVisit = (result[STORAGE_KEY_LAST_DIRECTORY_VISIT] as number | undefined) || null;
    const dirState = (result[STORAGE_KEY_DIRECTORY_UPDATES] as CatalogSourceUpdatesState | undefined) || null;
    const commState = (result[STORAGE_KEY_COMMUNITY_UPDATES] as CatalogSourceUpdatesState | undefined) || null;
    const settings = (result[STORAGE_KEY_SETTINGS] as ExtensionSettings | undefined) || DEFAULT_SETTINGS;
    const dirTitles = (result[STORAGE_KEY_DIRECTORY_BLOG_TITLES] as Record<string, string> | undefined) || {};
    const commTitles = (result[STORAGE_KEY_COMMUNITY_BLOG_TITLES] as Record<string, string> | undefined) || {};

    const prevDirCount = dirState?.updatedCount ?? 0;
    const prevCommCount = commState?.updatedCount ?? 0;

    // Skip in basic mode
    if (settings.extensionMode === 'basic') {
      console.log('[Service Worker] Basic mode - skipping catalog snapshot check');
      return;
    }

    // Skip if no followed blogs in either catalog
    if (dirFollowed.length === 0 && commFollowed.length === 0) {
      console.log('[Service Worker] No followed catalog blogs, skipping snapshot check');
      return;
    }

    // Check cache freshness (use the earlier of the two lastCheckedAt values)
    if (!skipCache) {
      const dirAge = dirState?.lastCheckedAt ? Date.now() - dirState.lastCheckedAt : Infinity;
      const commAge = commState?.lastCheckedAt ? Date.now() - commState.lastCheckedAt : Infinity;
      const minAge = Math.min(dirAge, commAge);
      if (minAge < CATALOG_CACHE_TTL_MS) {
        console.log('[Service Worker] Catalog snapshot cache still fresh, skipping API call');
        return;
      }
    }

    console.log('[Service Worker] Checking catalog snapshot from API...', { skipCache, silent });

    const response = await fetch(CATALOG_SNAPSHOT_API, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Catalog snapshot API returned ${response.status}`);
    }

    const data: SnapshotResponse = await response.json();

    // Filter each catalog locally by lastVisit
    function filterSection(
      section: SnapshotSection,
      followedIds: string[],
      titles: Record<string, string>
    ) {
      const allIds = Object.keys(section.blog_last_post_dates);
      let relevant = allIds;
      if (lastVisit) {
        relevant = relevant.filter((id) => {
          const date = section.blog_last_post_dates[id];
          return date && new Date(date).getTime() >= lastVisit;
        });
      }
      const updatedSet = new Set(relevant);
      const followedWithUpdates = followedIds.filter(id => updatedSet.has(id));
      return {
        updatedCount: followedWithUpdates.length,
        updatedBlogs: Object.keys(titles).length > 0
          ? followedWithUpdates.map(id => ({ id, title: titles[id] || 'Unknown Blog' }))
          : undefined,
        nextCheckAt: section.next_check_at ? new Date(section.next_check_at).getTime() : null,
        totalBlogs: section.total_blogs,
      };
    }

    const dirResult = filterSection(data.directory, dirFollowed, dirTitles);
    const commResult = filterSection(data.community, commFollowed, commTitles);

    const now = Date.now();

    // Update directory state
    const newDirState: CatalogSourceUpdatesState = {
      status: 'success',
      isEnabled: true,
      updatedCount: dirResult.updatedCount,
      followedCount: dirFollowed.length,
      totalBlogs: dirResult.totalBlogs,
      lastCheckedAt: now,
      nextCheckAt: dirResult.nextCheckAt,
      sinceTimestamp: lastVisit,
      syncStatus: dirState?.syncStatus ?? 'synced',
      lastSyncAt: dirState?.lastSyncAt ?? null,
      updatedBlogs: dirResult.updatedBlogs,
    };

    // Update community state
    const newCommState: CatalogSourceUpdatesState = {
      status: 'success',
      isEnabled: true,
      updatedCount: commResult.updatedCount,
      followedCount: commFollowed.length,
      totalBlogs: commResult.totalBlogs,
      lastCheckedAt: now,
      nextCheckAt: commResult.nextCheckAt,
      sinceTimestamp: lastVisit,
      syncStatus: commState?.syncStatus ?? 'synced',
      lastSyncAt: commState?.lastSyncAt ?? null,
      updatedBlogs: commResult.updatedBlogs,
    };

    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_UPDATES]: newDirState,
      [STORAGE_KEY_COMMUNITY_UPDATES]: newCommState,
    });

    console.log(`[Service Worker] Catalog snapshot: dir=${dirResult.updatedCount}/${dirFollowed.length}, comm=${commResult.updatedCount}/${commFollowed.length}`);

    // Update badge with combined count
    const customState = await getCustomBlogUpdatesState();
    const customCount = customState?.updatedCount ?? 0;
    await updateCatalogBadge(dirResult.updatedCount + commResult.updatedCount + customCount);

    // Send notification if total updates increased
    const totalNew = dirResult.updatedCount + commResult.updatedCount;
    const totalPrev = prevDirCount + prevCommCount;
    if (!silent && totalNew > 0 && totalNew > totalPrev && settings.blogUpdateNotificationsEnabled) {
      const totalFollowed = dirFollowed.length + commFollowed.length;
      await sendBlogUpdatesNotification(totalNew, totalFollowed);
    }

  } catch (error) {
    console.error('[Service Worker] Failed to check catalog snapshot:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Update both states with error
    const [dirRes, commRes] = await Promise.all([
      browser.storage.local.get(STORAGE_KEY_DIRECTORY_UPDATES),
      browser.storage.local.get(STORAGE_KEY_COMMUNITY_UPDATES),
    ]);

    const existingDir = (dirRes[STORAGE_KEY_DIRECTORY_UPDATES] as CatalogSourceUpdatesState | undefined) || null;
    const existingComm = (commRes[STORAGE_KEY_COMMUNITY_UPDATES] as CatalogSourceUpdatesState | undefined) || null;

    const makeErrorState = (existing: CatalogSourceUpdatesState | null): CatalogSourceUpdatesState => ({
      status: 'error',
      isEnabled: true,
      updatedCount: existing?.updatedCount ?? 0,
      followedCount: existing?.followedCount ?? 0,
      totalBlogs: existing?.totalBlogs ?? null,
      lastCheckedAt: Date.now(),
      nextCheckAt: null,
      sinceTimestamp: existing?.sinceTimestamp ?? null,
      error: errorMsg,
      syncStatus: existing?.syncStatus ?? 'not_synced',
      lastSyncAt: existing?.lastSyncAt ?? null,
    });

    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_UPDATES]: makeErrorState(existingDir),
      [STORAGE_KEY_COMMUNITY_UPDATES]: makeErrorState(existingComm),
    });
  }
}
