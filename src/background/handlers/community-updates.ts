/**
 * Community updates handler - checks for updates to followed community blogs
 * Uses the unified catalog-updates module for the core check logic.
 */

import {
  STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS,
  STORAGE_KEY_COMMUNITY_UPDATES,
  STORAGE_KEY_COMMUNITY_BLOG_TITLES,
  COMMUNITY_UPDATES_API,
} from '../utils/constants';
import { checkCatalogSourceUpdates, forceCheckCatalogSource, type CatalogSourceConfig } from './catalog-updates';

/**
 * Configuration for community updates
 */
const COMMUNITY_CONFIG: CatalogSourceConfig = {
  name: 'community',
  followedBlogsKey: STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS,
  updatesStateKey: STORAGE_KEY_COMMUNITY_UPDATES,
  blogTitlesKey: STORAGE_KEY_COMMUNITY_BLOG_TITLES,
  apiUrl: COMMUNITY_UPDATES_API,
  totalBlogsField: 'total_community_blogs',
};

/**
 * Check community updates by calling the API directly
 * @param options.skipCache - If true, bypass the cache TTL check
 * @param options.silent - If true, don't send push notifications
 *
 * NOTE: This function respects the extension mode setting.
 * In basic mode, it will skip the API check entirely.
 */
export async function checkCommunityUpdatesFromAPI(options?: {
  skipCache?: boolean;
  silent?: boolean;
}): Promise<void> {
  await checkCatalogSourceUpdates(COMMUNITY_CONFIG, options);
}

/**
 * Force check for community updates (bypasses cache, used by popup refresh button)
 */
export async function forceCheckCommunityUpdates(): Promise<void> {
  await forceCheckCatalogSource(COMMUNITY_CONFIG);
}
