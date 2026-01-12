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
    if (updatedCount > 0) {
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
