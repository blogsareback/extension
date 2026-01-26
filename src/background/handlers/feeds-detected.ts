/**
 * Feeds detected handler - manages feed discovery badge, context menus, and subscription queue
 */

import browser from '../../utils/browser';
import type { Menus, Tabs } from 'webextension-polyfill';
import {
  STORAGE_KEY_SUBSCRIPTION_QUEUE,
  STORAGE_KEY_FOLLOWED_FEED_URLS,
  STORAGE_KEY_PROBE_CACHE,
  FEED_DISCOVERY_BADGE_COLOR,
  PROBE_CACHE_TTL_MS,
} from '../utils/constants';
import { normalizeUrl } from '../utils/fetch';
import { getSettings } from '../storage/settings';
import { probeCommonPaths } from './feed-probe';
import type { FeedLink, FeedsDetectedMessage, QueuedSubscription, ProbeCacheEntry } from '../../utils/types';

/**
 * Check if a feed URL matches stricter recognition rules.
 * Returns true if the URL contains "feed", "atom", or "rss" (case-insensitive).
 */
function matchesStricterRules(feedUrl: string): boolean {
  const lowerUrl = feedUrl.toLowerCase();
  return lowerUrl.includes('feed') || lowerUrl.includes('atom') || lowerUrl.includes('rss');
}

/**
 * Store discovered feeds per tab
 * Key: tabId, Value: { pageUrl, feeds }
 */
export const discoveredFeeds = new Map<
  number,
  { pageUrl: string; feeds: FeedLink[] }
>();

/**
 * Update browser action badge with feed count
 */
export async function updateBadge(tabId: number, feedCount: number): Promise<void> {
  try {
    if (feedCount > 0) {
      await browser.action.setBadgeText({
        text: feedCount.toString(),
        tabId,
      });
      await browser.action.setBadgeBackgroundColor({
        color: FEED_DISCOVERY_BADGE_COLOR,
        tabId,
      });
      await browser.action.setTitle({
        title: `${feedCount} feed${feedCount > 1 ? 's' : ''} available`,
        tabId,
      });
    } else {
      await browser.action.setBadgeText({ text: '', tabId });
      await browser.action.setTitle({ title: 'Blogs Are Back', tabId });
    }
  } catch (error) {
    console.error('[Service Worker] Failed to update badge:', error);
  }
}

/**
 * Create/update context menus for discovered feeds
 */
export async function updateContextMenus(
  tabId: number,
  feeds: FeedLink[]
): Promise<void> {
  try {
    // Remove all existing context menus
    await browser.contextMenus.removeAll();

    if (feeds.length === 0) {
      return;
    }

    // Create parent menu item
    browser.contextMenus.create({
      id: 'blogs-are-back-parent',
      title: 'Subscribe to feed',
      contexts: ['page', 'link'],
    });

    // Add menu items for each feed
    feeds.forEach((feed, index) => {
      const feedTitle = feed.title || 'Untitled Feed';
      const menuId = `subscribe-feed-${index}`;

      browser.contextMenus.create({
        id: menuId,
        parentId: 'blogs-are-back-parent',
        title: feedTitle,
        contexts: ['page', 'link'],
      });
    });

    console.log(
      `[Service Worker] Created context menus for ${feeds.length} feed(s)`
    );
  } catch (error) {
    console.error('[Service Worker] Failed to update context menus:', error);
  }
}

/**
 * Handle feeds detected on a page
 */
export async function handleFeedsDetected(
  message: FeedsDetectedMessage,
  tabId: number
): Promise<void> {
  const settings = await getSettings();

  // Skip if feed discovery is disabled
  if (!settings.feedDiscoveryEnabled) {
    return;
  }

  let feeds = message.feeds;

  // If no feeds found via <link> tags and probing is requested, probe common paths
  if (feeds.length === 0 && message.probeRequested) {
    console.log(
      `[Service Worker] No <link> feeds on ${message.pageUrl}, probing common paths...`
    );
    const probedFeeds = await probeCommonPaths(message.pageUrl);
    feeds = probedFeeds;
  }

  console.log(
    `[Service Worker] Detected ${feeds.length} feed(s) on ${message.pageUrl}${message.probeRequested && message.feeds.length === 0 ? ' (via probing)' : ''}`
  );

  // Store feeds for this tab
  discoveredFeeds.set(tabId, {
    pageUrl: message.pageUrl,
    feeds: feeds,
  });

  // Get followed feed URLs to filter out already-followed feeds from badge count
  const storageResult = await browser.storage.local.get([STORAGE_KEY_FOLLOWED_FEED_URLS]);
  const followedFeedUrls = (storageResult[STORAGE_KEY_FOLLOWED_FEED_URLS] as string[] | undefined) || [];
  const normalizedFollowedUrls = new Set(followedFeedUrls.map(normalizeUrl));

  // Count only feeds that aren't already followed
  const unfollowedFeedCount = feeds.filter(
    (feed) => !normalizedFollowedUrls.has(normalizeUrl(feed.href))
  ).length;

  // Update badge (only if setting enabled)
  if (settings.showBadgeCount) {
    await updateBadge(tabId, unfollowedFeedCount);
  } else {
    await updateBadge(tabId, 0); // Clear badge
  }

  // Update context menus with discovered feeds (still show all for now)
  await updateContextMenus(tabId, feeds);

  // Notify floating button content script about unfollowed feeds
  if (settings.floatingButtonEnabled && unfollowedFeedCount > 0) {
    let unfollowedFeeds = feeds.filter(
      (feed) => !normalizedFollowedUrls.has(normalizeUrl(feed.href))
    );

    // Apply stricter feed recognition if enabled
    if (settings.stricterFeedRecognition) {
      unfollowedFeeds = unfollowedFeeds.filter((feed) => matchesStricterRules(feed.href));
      console.log(
        `[Service Worker] Stricter feed recognition: ${unfollowedFeeds.length} of ${feeds.length} feeds match rules`
      );
    }

    if (unfollowedFeeds.length > 0) {
      await notifyFloatingButton(tabId, unfollowedFeeds);
    }
  }
}

/**
 * Notify the floating button content script about available feeds
 */
async function notifyFloatingButton(tabId: number, feeds: FeedLink[]): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, {
      type: 'FLOATING_BUTTON_UPDATE',
      feeds,
    });
    console.log(`[Service Worker] Notified floating button with ${feeds.length} feed(s)`);
  } catch (error) {
    // Content script may not be ready yet, this is expected
    // The floating button will request feeds when it initializes
  }
}

/**
 * Add a subscription to the queue in chrome.storage
 */
export async function queueSubscription(
  subscription: Omit<QueuedSubscription, 'queuedAt'>
): Promise<void> {
  try {
    const result = await browser.storage.local.get(
      STORAGE_KEY_SUBSCRIPTION_QUEUE
    );
    const queue: QueuedSubscription[] =
      (result[STORAGE_KEY_SUBSCRIPTION_QUEUE] as QueuedSubscription[] | undefined) || [];

    // Add timestamp and push to queue
    queue.push({
      ...subscription,
      queuedAt: Date.now(),
    });

    await browser.storage.local.set({
      [STORAGE_KEY_SUBSCRIPTION_QUEUE]: queue,
    });

    console.log(
      `[Service Worker] Queued subscription: ${subscription.feedTitle || subscription.feedUrl}`
    );
    console.log(`[Service Worker] Queue now has ${queue.length} subscription(s)`);

    // Notify any open Blogs Are Back tabs about the new subscription
    await notifyWebAppTabs();
  } catch (error) {
    console.error('[Service Worker] Failed to queue subscription:', error);
  }
}

/**
 * Notify Blogs Are Back tabs that new subscriptions are available
 * Sends a message to content scripts which forward to the web app
 */
export async function notifyWebAppTabs(): Promise<void> {
  try {
    // Find all tabs matching Blogs Are Back URLs
    const tabs = await browser.tabs.query({
      url: [
        'https://blogsareback.com/*',
        'https://www.blogsareback.com/*',
        'http://localhost:3000/*',
        'http://localhost:*/*',
      ],
    });

    console.log(`[Service Worker] Found ${tabs.length} Blogs Are Back tab(s) to notify`);

    // Send message to each tab's content script
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: 'SUBSCRIPTION_QUEUE_UPDATED',
          });
          console.log(`[Service Worker] Notified tab ${tab.id}`);
        } catch (error) {
          // Tab might not have content script loaded yet
          console.warn(`[Service Worker] Failed to notify tab ${tab.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[Service Worker] Failed to notify web app tabs:', error);
  }
}

/**
 * Handle context menu click for subscribing to a feed
 */
export async function handleContextMenuClick(
  info: Menus.OnClickData,
  tab: Tabs.Tab | undefined
): Promise<void> {
  if (!tab?.id || !info.menuItemId.toString().startsWith('subscribe-feed-')) {
    return;
  }

  const tabData = discoveredFeeds.get(tab.id);
  if (!tabData) {
    console.error('[Service Worker] No feed data found for tab:', tab.id);
    return;
  }

  // Extract feed index from menu item ID
  const feedIndex = parseInt(
    info.menuItemId.toString().replace('subscribe-feed-', ''),
    10
  );
  const feed = tabData.feeds[feedIndex];

  if (!feed) {
    console.error('[Service Worker] Feed not found at index:', feedIndex);
    return;
  }

  console.log('[Service Worker] Context menu click - subscribing to:', feed);

  // Queue the subscription instead of sending immediately
  await queueSubscription({
    feedUrl: feed.href,
    pageUrl: tabData.pageUrl,
    feedTitle: feed.title,
  });

  // Show a notification that the feed was queued (if enabled)
  const settings = await getSettings();
  if (settings.notificationsEnabled) {
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon48.png'),
      title: 'Feed Queued',
      message: `"${feed.title || 'Feed'}" will be added when you visit Blogs Are Back`,
    });
  }
}

/**
 * Clean up feed data when tab is closed
 */
export function handleTabRemoved(tabId: number): void {
  discoveredFeeds.delete(tabId);
}

/**
 * Clear feed data and badge when navigating away
 */
export async function handleTabUpdated(
  tabId: number,
  changeInfo: Tabs.OnUpdatedChangeInfoType
): Promise<void> {
  if (changeInfo.url) {
    discoveredFeeds.delete(tabId);
    await updateBadge(tabId, 0);
  }
}
