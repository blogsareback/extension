/**
 * State storage for catalog (directory + community) and custom blog updates
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_COMMUNITY_UPDATES,
  STORAGE_KEY_CUSTOM_BLOG_UPDATES,
  CATALOG_BADGE_COLOR,
} from '../utils/constants';
import type {
  CatalogSourceUpdatesState,
  CatalogUpdatesState,
  CustomBlogUpdatesState,
} from '../../utils/types';
import { getSettings } from './settings';

/**
 * Generic getter for catalog source state
 */
async function getCatalogSourceState(storageKey: string): Promise<CatalogSourceUpdatesState | null> {
  try {
    const result = await browser.storage.local.get(storageKey);
    return (result[storageKey] as CatalogSourceUpdatesState | undefined) || null;
  } catch (error) {
    console.error(`[Service Worker] Failed to get state for ${storageKey}:`, error);
    return null;
  }
}

/**
 * Get current directory updates state from storage
 */
export function getDirectoryUpdatesState(): Promise<CatalogSourceUpdatesState | null> {
  return getCatalogSourceState(STORAGE_KEY_DIRECTORY_UPDATES);
}

/**
 * Get current community updates state from storage
 */
export function getCommunityUpdatesState(): Promise<CatalogSourceUpdatesState | null> {
  return getCatalogSourceState(STORAGE_KEY_COMMUNITY_UPDATES);
}

/**
 * Get combined catalog updates state (directory + community)
 */
export async function getCatalogUpdatesState(): Promise<CatalogUpdatesState | null> {
  try {
    const result = await browser.storage.local.get([
      STORAGE_KEY_DIRECTORY_UPDATES,
      STORAGE_KEY_COMMUNITY_UPDATES,
    ]);

    const directoryState = (result[STORAGE_KEY_DIRECTORY_UPDATES] as CatalogSourceUpdatesState | undefined) || null;
    const communityState = (result[STORAGE_KEY_COMMUNITY_UPDATES] as CatalogSourceUpdatesState | undefined) || null;

    return {
      directory: directoryState,
      community: communityState,
      totalUpdatedCount: (directoryState?.updatedCount ?? 0) + (communityState?.updatedCount ?? 0),
      totalFollowedCount: (directoryState?.followedCount ?? 0) + (communityState?.followedCount ?? 0),
    };
  } catch (error) {
    console.error('[Service Worker] Failed to get catalog state:', error);
    return null;
  }
}

/**
 * Get current custom blog updates state from storage
 */
export async function getCustomBlogUpdatesState(): Promise<CustomBlogUpdatesState | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_CUSTOM_BLOG_UPDATES);
    return (result[STORAGE_KEY_CUSTOM_BLOG_UPDATES] as CustomBlogUpdatesState | undefined) || null;
  } catch (error) {
    console.error('[Service Worker] Failed to get custom blog state:', error);
    return null;
  }
}

/**
 * Update the global catalog updates badge
 * Combines directory + community + custom blog update counts
 */
export async function updateCatalogBadge(updatedCount: number): Promise<void> {
  try {
    const settings = await getSettings();
    if (updatedCount > 0 && settings.newPostBadgeEnabled) {
      await browser.action.setBadgeText({ text: updatedCount.toString() });
      await browser.action.setBadgeBackgroundColor({ color: CATALOG_BADGE_COLOR });
      console.log(`[Service Worker] Set catalog badge: ${updatedCount}`);
    } else {
      await browser.action.setBadgeText({ text: '' });
      console.log('[Service Worker] Cleared catalog badge');
    }
  } catch (error) {
    console.error('[Service Worker] Failed to update catalog badge:', error);
  }
}

// Backwards compatibility alias
export const updateDirectoryBadge = updateCatalogBadge;

/**
 * Acknowledge updates by resetting update counts for specified sources.
 * Also clears the badge.
 *
 * @param sources - Which sources to acknowledge. If not provided, acknowledges all.
 * @returns The total number of updates that were acknowledged
 */
export async function acknowledgeUpdates(
  sources?: Array<'directory' | 'community' | 'custom'>
): Promise<number> {
  const acknowledgeAll = !sources || sources.length === 0;
  const acknowledgeDirectory = acknowledgeAll || sources?.includes('directory');
  const acknowledgeCommunity = acknowledgeAll || sources?.includes('community');
  const acknowledgeCustom = acknowledgeAll || sources?.includes('custom');

  let totalAcknowledged = 0;

  try {
    // Fetch current states
    const result = await browser.storage.local.get([
      STORAGE_KEY_DIRECTORY_UPDATES,
      STORAGE_KEY_COMMUNITY_UPDATES,
      STORAGE_KEY_CUSTOM_BLOG_UPDATES,
    ]);

    const updates: Record<string, CatalogSourceUpdatesState | CustomBlogUpdatesState> = {};

    // Reset directory update count
    if (acknowledgeDirectory) {
      const dirState = result[STORAGE_KEY_DIRECTORY_UPDATES] as CatalogSourceUpdatesState | undefined;
      if (dirState && dirState.updatedCount > 0) {
        totalAcknowledged += dirState.updatedCount;
        updates[STORAGE_KEY_DIRECTORY_UPDATES] = {
          ...dirState,
          updatedCount: 0,
          updatedBlogs: [],
        };
        console.log(`[Service Worker] Acknowledged ${dirState.updatedCount} directory updates`);
      }
    }

    // Reset community update count
    if (acknowledgeCommunity) {
      const commState = result[STORAGE_KEY_COMMUNITY_UPDATES] as CatalogSourceUpdatesState | undefined;
      if (commState && commState.updatedCount > 0) {
        totalAcknowledged += commState.updatedCount;
        updates[STORAGE_KEY_COMMUNITY_UPDATES] = {
          ...commState,
          updatedCount: 0,
          updatedBlogs: [],
        };
        console.log(`[Service Worker] Acknowledged ${commState.updatedCount} community updates`);
      }
    }

    // Reset custom blog update counts
    if (acknowledgeCustom) {
      const customState = result[STORAGE_KEY_CUSTOM_BLOG_UPDATES] as CustomBlogUpdatesState | undefined;
      if (customState && customState.updatedCount > 0) {
        totalAcknowledged += customState.updatedCount;
        updates[STORAGE_KEY_CUSTOM_BLOG_UPDATES] = {
          ...customState,
          updatedCount: 0,
          blogs: customState.blogs.map((blog) => ({
            ...blog,
            hasUpdates: false,
            // Update lastKnownPostDate to current if there was an update
            lastKnownPostDate: blog.hasUpdates && blog.currentPostDate
              ? blog.currentPostDate
              : blog.lastKnownPostDate,
          })),
        };
        console.log(`[Service Worker] Acknowledged ${customState.updatedCount} custom blog updates`);
      }
    }

    // Save updated states
    if (Object.keys(updates).length > 0) {
      await browser.storage.local.set(updates);
    }

    // Clear badge
    await updateCatalogBadge(0);

    console.log(`[Service Worker] Total acknowledged: ${totalAcknowledged} updates`);
    return totalAcknowledged;
  } catch (error) {
    console.error('[Service Worker] Failed to acknowledge updates:', error);
    throw error;
  }
}
