/**
 * Feeds detected handler - manages feed discovery badge, context menus, and subscription queue
 */

import browser from '../../utils/browser';
import type { Menus, Tabs } from 'webextension-polyfill';
import {
  STORAGE_KEY_SUBSCRIPTION_QUEUE,
  STORAGE_KEY_FOLLOWED_FEED_URLS,
  STORAGE_KEY_PROBE_CACHE,
  PROBE_CACHE_TTL_MS,
} from '../utils/constants';

// Context menu IDs
const SETTINGS_MENU_ID = 'blogs-are-back-settings';
const SAVE_PAGE_MENU_ID = 'blogs-are-back-save-page';
const FEED_PARENT_MENU_ID = 'blogs-are-back-parent';
const FEED_MENU_PREFIX = 'subscribe-feed-';
import { normalizeUrl } from '../utils/fetch';
import { getSettings } from '../storage/settings';
import { incrementEngagement } from '../storage/telemetry';
import { probeCommonPaths } from './feed-probe';
import { handleSaveByUrl } from './save-post';
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
 * Track domains where floating button was shown/interacted with this session.
 * This map resets when the service worker restarts.
 * Key: domain (hostname without www), Value: timestamp of last interaction
 */
export const shownDomainsThisSession = new Map<string, number>();

/**
 * Check if a domain has already had the floating button shown this session
 */
export function hasShownThisSession(domain: string): boolean {
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
  return shownDomainsThisSession.has(normalizedDomain);
}

/**
 * Mark a domain as having shown the floating button this session
 */
export function markShownForSession(domain: string): void {
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
  shownDomainsThisSession.set(normalizedDomain, Date.now());
  console.log(`[Service Worker] Marked domain as shown this session: ${normalizedDomain}`);
}

/**
 * Get the domain from a URL
 */
function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Create the "Settings" context menu item that appears when right-clicking the extension icon.
 * This should be called once at service worker startup.
 */
export async function createOptionsContextMenu(): Promise<void> {
  try {
    // Remove first to avoid duplicate ID error on service worker restart
    try {
      await browser.contextMenus.remove(SETTINGS_MENU_ID);
    } catch {
      // Menu doesn't exist yet, that's fine
    }

    browser.contextMenus.create({
      id: SETTINGS_MENU_ID,
      title: 'Settings',
      contexts: ['action'], // Appears when right-clicking the extension icon
    });

    // "Save page offline" - appears on all pages
    try {
      await browser.contextMenus.remove(SAVE_PAGE_MENU_ID);
    } catch {
      // Menu doesn't exist yet, that's fine
    }

    browser.contextMenus.create({
      id: SAVE_PAGE_MENU_ID,
      title: 'Save page offline',
      contexts: ['page', 'link'],
    });

    console.log('[Service Worker] Created Settings and Save Page context menus');
  } catch (error) {
    console.log('[Service Worker] Settings context menu failed:', error);
  }
}

/**
 * Create/update context menus for discovered feeds.
 * Preserves the "Settings" menu item that appears on the extension icon.
 */
export async function updateContextMenus(
  tabId: number,
  feeds: FeedLink[]
): Promise<void> {
  try {
    // Remove only feed-related menus (preserve Options menu)
    // First, try to remove the parent menu (which cascades to children)
    try {
      await browser.contextMenus.remove(FEED_PARENT_MENU_ID);
    } catch {
      // Menu might not exist yet, that's fine
    }

    if (feeds.length === 0) {
      return;
    }

    // Create parent menu item
    browser.contextMenus.create({
      id: FEED_PARENT_MENU_ID,
      title: 'Subscribe to feed',
      contexts: ['page', 'link'],
    });

    // Add menu items for each feed
    feeds.forEach((feed, index) => {
      const feedTitle = feed.title || 'Untitled Feed';
      const menuId = `${FEED_MENU_PREFIX}${index}`;

      browser.contextMenus.create({
        id: menuId,
        parentId: FEED_PARENT_MENU_ID,
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

  // Update context menus with discovered feeds (still show all for now)
  await updateContextMenus(tabId, feeds);

  // Notify floating button content script about unfollowed feeds (featured mode only)
  if (settings.extensionMode === 'featured' && settings.floatingButtonEnabled && unfollowedFeedCount > 0) {
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
      await notifyFloatingButton(tabId, unfollowedFeeds, message.pageUrl);
    }
  }
}

/**
 * Notify the floating button content script about available feeds
 */
async function notifyFloatingButton(tabId: number, feeds: FeedLink[], pageUrl: string): Promise<void> {
  try {
    // Check if this domain was already shown this session
    const domain = getDomainFromUrl(pageUrl);
    if (domain && hasShownThisSession(domain)) {
      console.log(`[Service Worker] Skipping floating button for ${domain} (already shown this session)`);
      return;
    }

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
        'https://blogsareback.com/dashboard/*',
        'https://www.blogsareback.com/dashboard/*',

        // Dev mode
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
 * Handle context menu click for subscribing to a feed or opening settings
 */
export async function handleContextMenuClick(
  info: Menus.OnClickData,
  tab: Tabs.Tab | undefined
): Promise<void> {
  const menuId = info.menuItemId.toString();

  // Handle Settings menu click (opens settings page)
  if (menuId === SETTINGS_MENU_ID) {
    const settingsUrl = browser.runtime.getURL('src/main/main.html#/settings');
    await browser.tabs.create({ url: settingsUrl });
    return;
  }

  // Handle "Save page offline" menu click
  if (menuId === SAVE_PAGE_MENU_ID) {
    const pageUrl = info.linkUrl || info.pageUrl || tab?.url;
    if (!pageUrl) {
      console.error('[Service Worker] No URL available to save');
      return;
    }

    console.log('[Service Worker] Context menu: saving page offline:', pageUrl);

    const requestId = `ctx-save-${Date.now()}`;
    const result = await handleSaveByUrl(pageUrl, requestId);

    const settings = await getSettings();
    if (settings.notificationsEnabled) {
      if (result.success) {
        const title = result.post?.title || 'Page';
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('icons/icon48.png'),
          title: 'Page Saved',
          message: `"${title}" saved for offline reading`,
        });
      } else {
        browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('icons/icon48.png'),
          title: 'Save Failed',
          message: result.error || 'Could not save this page',
        });
      }
    }
    return;
  }

  // Handle feed subscription menu clicks
  if (!tab?.id || !menuId.startsWith(FEED_MENU_PREFIX)) {
    return;
  }

  const tabData = discoveredFeeds.get(tab.id);
  if (!tabData) {
    console.error('[Service Worker] No feed data found for tab:', tab.id);
    return;
  }

  // Extract feed index from menu item ID
  const feedIndex = parseInt(
    menuId.replace(FEED_MENU_PREFIX, ''),
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

  incrementEngagement('feedSubscriptions').catch(console.warn);

  // Show a notification that the feed was queued (if enabled)
  const settings = await getSettings();
  if (settings.notificationsEnabled) {
    incrementEngagement('notificationsShown').catch(console.warn);
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
 * Clear feed data when navigating away
 */
export function handleTabUpdated(
  tabId: number,
  changeInfo: Tabs.OnUpdatedChangeInfoType
): void {
  if (changeInfo.url) {
    discoveredFeeds.delete(tabId);
  }
}
