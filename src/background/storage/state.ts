/**
 * State storage for directory and custom blog updates
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_CUSTOM_BLOG_UPDATES,
  DIRECTORY_BADGE_COLOR,
} from '../utils/constants';
import type { DirectoryUpdatesState, CustomBlogUpdatesState } from '../../utils/types';

/**
 * Get current directory updates state from storage
 */
export async function getDirectoryUpdatesState(): Promise<DirectoryUpdatesState | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_DIRECTORY_UPDATES);
    return (result[STORAGE_KEY_DIRECTORY_UPDATES] as DirectoryUpdatesState | undefined) || null;
  } catch (error) {
    console.error('[Service Worker] Failed to get directory state:', error);
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
 * Update the global directory updates badge
 * This badge shows across all tabs (not per-tab like feed discovery)
 */
export async function updateDirectoryBadge(updatedCount: number): Promise<void> {
  try {
    if (updatedCount > 0) {
      // Set badge text globally (no tabId means all tabs)
      await browser.action.setBadgeText({ text: updatedCount.toString() });
      await browser.action.setBadgeBackgroundColor({ color: DIRECTORY_BADGE_COLOR });
      console.log(`[Service Worker] Set directory badge: ${updatedCount}`);
    } else {
      // Clear badge if no updates
      // Note: This will be overridden by per-tab feed discovery badges when on those pages
      await browser.action.setBadgeText({ text: '' });
      console.log('[Service Worker] Cleared directory badge');
    }
  } catch (error) {
    console.error('[Service Worker] Failed to update directory badge:', error);
  }
}
