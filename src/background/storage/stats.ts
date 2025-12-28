/**
 * Statistics storage and management
 */

import browser from '../../utils/browser';
import { STORAGE_KEY_STATS } from '../utils/constants';
import type { FetchStats } from '../../utils/types';

/**
 * Update fetch statistics in storage
 */
export async function updateStats(success: boolean, feedUrl: string): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_STATS);
    const stats: FetchStats = (result[STORAGE_KEY_STATS] as FetchStats) || {
      totalFetches: 0,
      errors: 0,
    };

    stats.totalFetches += 1;
    if (!success) {
      stats.errors += 1;
    }

    stats.lastFetch = {
      url: feedUrl,
      timestamp: Date.now(),
      success,
    };

    await browser.storage.local.set({ [STORAGE_KEY_STATS]: stats });
  } catch (error) {
    console.error('[Service Worker] Failed to update stats:', error);
  }
}
