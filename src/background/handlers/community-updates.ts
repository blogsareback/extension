/**
 * Community updates handler - checks for updates to followed community blogs.
 * Delegates to the unified catalog snapshot API.
 */

import { checkCatalogSnapshotFromAPI } from './catalog-updates';

/**
 * Force check for community updates (bypasses cache, used by popup refresh button).
 * Uses the unified snapshot endpoint which checks both catalogs in one request.
 */
export async function forceCheckCommunityUpdates(): Promise<void> {
  await checkCatalogSnapshotFromAPI({ skipCache: true, silent: true });
}
