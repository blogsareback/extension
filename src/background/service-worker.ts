/**
 * Blogs Are Back - Service Worker
 *
 * Main entry point for the extension's background service worker.
 * Handles message routing, event listeners, and periodic tasks.
 */

import browser, { type MessageSender } from '../utils/browser';

// Storage and settings
import {
  STORAGE_KEY_SUBSCRIPTION_QUEUE,
  STORAGE_KEY_SETTINGS,
  DIRECTORY_CHECK_ALARM,
} from './utils/constants';
import { getSettings, updateSettings, clearData } from './storage/settings';
import { updateStats } from './storage/stats';
import { getDirectoryUpdatesState, getCustomBlogUpdatesState } from './storage/state';

// Handlers
import { fetchFeed } from './handlers/feed-fetch';
import { fetchPage } from './handlers/page-fetch';
import { extractReadableText, extractReadableHtml } from './handlers/readable-extract';
import { discoverFeedsFromUrl } from './handlers/feed-discovery';
import { testBlogStatus } from './handlers/blog-status';
import {
  checkDirectoryUpdatesFromAPI,
  forceCheckDirectoryUpdates,
  handleSyncFollowedBlogs,
} from './handlers/directory-updates';
import {
  checkCustomBlogUpdates,
  forceCheckCustomBlogUpdates,
  handleSyncAllBlogs,
} from './handlers/custom-blog-updates';
import {
  discoveredFeeds,
  handleFeedsDetected,
  queueSubscription,
  handleContextMenuClick,
  handleTabRemoved,
  handleTabUpdated,
  updateBadge,
} from './handlers/feeds-detected';

// Types
import type {
  FeedResponse,
  ReadableTextResponse,
  ReadableHtmlResponse,
  FetchFeedRequest,
  FetchPageRequest,
  ExtractReadableTextRequest,
  ExtractReadableHtmlRequest,
  GetDiscoveredFeedsRequest,
  GetDiscoveredFeedsResponse,
  PopupSubscribeRequest,
  PopupSubscribeResponse,
  GetSubscriptionQueueResponse,
  GetDirectoryUpdatesResponse,
  ForceCheckDirectoryUpdatesResponse,
  GetCustomBlogUpdatesResponse,
  ForceCheckCustomBlogUpdatesResponse,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  ClearDataRequest,
  ClearDataResponse,
  DiscoverFeedsRequest,
  DiscoverFeedsResponse,
  TestBlogStatusRequest,
  TestBlogStatusResponse,
  FeedsDetectedMessage,
  SyncFollowedBlogsRequest,
  SyncAllBlogsRequest,
  ExtensionSettings,
} from '../utils/types';

// ============================================
// Context Menu Listener
// ============================================

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  await handleContextMenuClick(info, tab);
});

// ============================================
// Tab Event Listeners
// ============================================

browser.tabs.onRemoved.addListener((tabId) => {
  handleTabRemoved(tabId);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  await handleTabUpdated(tabId, changeInfo);
});

// ============================================
// Message Handler
// ============================================

// Response type for message handlers
type MessageResponse =
  | FeedResponse
  | ReadableTextResponse
  | ReadableHtmlResponse
  | GetDiscoveredFeedsResponse
  | PopupSubscribeResponse
  | GetSubscriptionQueueResponse
  | GetDirectoryUpdatesResponse
  | ForceCheckDirectoryUpdatesResponse
  | GetCustomBlogUpdatesResponse
  | ForceCheckCustomBlogUpdatesResponse
  | GetSettingsResponse
  | UpdateSettingsResponse
  | ClearDataResponse
  | DiscoverFeedsResponse
  | TestBlogStatusResponse
  | { success: boolean };

/**
 * Listen for messages from content script and popup
 * Note: Using 'as unknown' cast because webextension-polyfill types are stricter
 * than the actual runtime behavior which supports sendResponse callbacks
 */
browser.runtime.onMessage.addListener(
  ((
    message: unknown,
    sender: MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): true | void => {
    // Validate message structure
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message
    ) {
      // Handle GET_DISCOVERED_FEEDS from popup
      if (message.type === 'GET_DISCOVERED_FEEDS') {
        const request = message as GetDiscoveredFeedsRequest;
        const tabData = discoveredFeeds.get(request.tabId);

        sendResponse({
          type: 'DISCOVERED_FEEDS_RESPONSE',
          feeds: tabData?.feeds || [],
          pageUrl: tabData?.pageUrl || null,
        } as GetDiscoveredFeedsResponse);

        return undefined; // Synchronous response
      }

      // Handle POPUP_SUBSCRIBE from popup
      if (message.type === 'POPUP_SUBSCRIBE') {
        const request = message as PopupSubscribeRequest;

        queueSubscription({
          feedUrl: request.feed.href,
          pageUrl: request.pageUrl,
          feedTitle: request.feed.title,
        })
          .then(async () => {
            // Show notification (if enabled)
            const settings = await getSettings();
            if (settings.notificationsEnabled) {
              browser.notifications.create({
                type: 'basic',
                iconUrl: browser.runtime.getURL('icons/icon48.png'),
                title: 'Feed Queued',
                message: `"${request.feed.title || 'Feed'}" will be added when you visit Blogs Are Back`,
              });
            }

            sendResponse({
              type: 'POPUP_SUBSCRIBE_RESPONSE',
              success: true,
            } as PopupSubscribeResponse);
          })
          .catch((error) => {
            sendResponse({
              type: 'POPUP_SUBSCRIBE_RESPONSE',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            } as PopupSubscribeResponse);
          });

        return true; // Async response
      }

      // Handle GET_SUBSCRIPTION_QUEUE from popup/queue page
      if (message.type === 'GET_SUBSCRIPTION_QUEUE') {
        browser.storage.local
          .get(STORAGE_KEY_SUBSCRIPTION_QUEUE)
          .then((result) => {
            sendResponse({
              type: 'SUBSCRIPTION_QUEUE_RESPONSE',
              queue: result[STORAGE_KEY_SUBSCRIPTION_QUEUE] || [],
            } as GetSubscriptionQueueResponse);
          });

        return true; // Async response
      }

      // Handle SYNC_FOLLOWED_BLOGS from web app (via content script)
      // This is the legacy message type - still supported for backwards compatibility
      if (message.type === 'SYNC_FOLLOWED_BLOGS') {
        const request = message as SyncFollowedBlogsRequest;
        handleSyncFollowedBlogs(request).then(() => {
          sendResponse({ success: true });
        });
        return true; // Async response
      }

      // Handle SYNC_ALL_BLOGS from web app (via content script)
      // This is the new message type that syncs both directory and custom blogs
      if (message.type === 'SYNC_ALL_BLOGS') {
        const request = message as SyncAllBlogsRequest;
        handleSyncAllBlogs(request).then(() => {
          sendResponse({ success: true });
        });
        return true; // Async response
      }

      // Handle GET_DIRECTORY_UPDATES from popup
      if (message.type === 'GET_DIRECTORY_UPDATES') {
        getDirectoryUpdatesState().then((state) => {
          sendResponse({
            type: 'DIRECTORY_UPDATES_RESPONSE',
            state,
          } as GetDirectoryUpdatesResponse);
        });
        return true; // Async response
      }

      // Handle FORCE_CHECK_DIRECTORY_UPDATES from popup
      if (message.type === 'FORCE_CHECK_DIRECTORY_UPDATES') {
        forceCheckDirectoryUpdates()
          .then(() => {
            sendResponse({
              type: 'FORCE_CHECK_DIRECTORY_UPDATES_RESPONSE',
              success: true,
            });
          })
          .catch((error) => {
            sendResponse({
              type: 'FORCE_CHECK_DIRECTORY_UPDATES_RESPONSE',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        return true; // Async response
      }

      // Handle GET_CUSTOM_BLOG_UPDATES from popup
      if (message.type === 'GET_CUSTOM_BLOG_UPDATES') {
        getCustomBlogUpdatesState().then((state) => {
          sendResponse({
            type: 'CUSTOM_BLOG_UPDATES_RESPONSE',
            state,
          } as GetCustomBlogUpdatesResponse);
        });
        return true; // Async response
      }

      // Handle FORCE_CHECK_CUSTOM_BLOG_UPDATES from popup
      if (message.type === 'FORCE_CHECK_CUSTOM_BLOG_UPDATES') {
        forceCheckCustomBlogUpdates()
          .then(() => {
            sendResponse({
              type: 'FORCE_CHECK_CUSTOM_BLOG_UPDATES_RESPONSE',
              success: true,
            } as ForceCheckCustomBlogUpdatesResponse);
          })
          .catch((error) => {
            sendResponse({
              type: 'FORCE_CHECK_CUSTOM_BLOG_UPDATES_RESPONSE',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            } as ForceCheckCustomBlogUpdatesResponse);
          });
        return true; // Async response
      }

      // Handle GET_SETTINGS
      if (message.type === 'GET_SETTINGS') {
        getSettings().then((settings) => {
          sendResponse({
            type: 'SETTINGS_RESPONSE',
            settings,
          } as GetSettingsResponse);
        });
        return true; // Async response
      }

      // Handle UPDATE_SETTINGS
      if (message.type === 'UPDATE_SETTINGS') {
        const request = message as UpdateSettingsRequest;
        updateSettings(request.settings)
          .then((settings) => {
            sendResponse({
              type: 'UPDATE_SETTINGS_RESPONSE',
              success: true,
              settings,
            } as UpdateSettingsResponse);
          })
          .catch(() => {
            getSettings().then((settings) => {
              sendResponse({
                type: 'UPDATE_SETTINGS_RESPONSE',
                success: false,
                settings,
              } as UpdateSettingsResponse);
            });
          });
        return true; // Async response
      }

      // Handle CLEAR_DATA
      if (message.type === 'CLEAR_DATA') {
        const request = message as ClearDataRequest;
        clearData(request.dataType).then((success) => {
          sendResponse({
            type: 'CLEAR_DATA_RESPONSE',
            success,
          } as ClearDataResponse);
        });
        return true; // Async response
      }

      // Handle DISCOVER_FEEDS from web app (via content script)
      if (message.type === 'DISCOVER_FEEDS') {
        const request = message as DiscoverFeedsRequest;
        discoverFeedsFromUrl(request.blogUrl, request.requestId).then(
          (response) => {
            sendResponse(response);
          }
        );
        return true; // Async response
      }

      // Handle TEST_BLOG_STATUS from web app (via content script)
      if (message.type === 'TEST_BLOG_STATUS') {
        const request = message as TestBlogStatusRequest;
        testBlogStatus(request.feedUrl, request.requestId).then((response) => {
          sendResponse(response);
        });
        return true; // Async response
      }

      // Handle feed discovery messages
      if (message.type === 'FEEDS_DETECTED') {
        const request = message as FeedsDetectedMessage;
        const tabId = sender.tab?.id;

        if (tabId) {
          handleFeedsDetected(request, tabId);
        }

        return undefined; // No async response needed
      }

      // Handle feed fetch requests
      if (message.type === 'FETCH_FEED') {
        const request = message as FetchFeedRequest;

        console.log(
          '[Service Worker] Received fetch request:',
          request.requestId,
          request.feedUrl
        );

        // Handle async fetch
        fetchFeed(request.feedUrl, request.requestId).then((result) => {
          // Update statistics
          updateStats(result.success, request.feedUrl);

          // Send response
          sendResponse(result);
        });

        // Return true to indicate async response
        return true;
      }

      // Handle page fetch requests (raw HTML, no extraction)
      if (message.type === 'FETCH_PAGE') {
        const request = message as FetchPageRequest;

        console.log(
          '[Service Worker] Received page fetch request:',
          request.requestId,
          request.url
        );

        // Handle async fetch
        fetchPage(request.url, request.requestId).then((result) => {
          // Update statistics
          updateStats(result.success, request.url);

          // Send response
          sendResponse(result);
        });

        // Return true to indicate async response
        return true;
      }

      // Handle readable text extraction requests
      if (message.type === 'EXTRACT_READABLE_TEXT') {
        const request = message as ExtractReadableTextRequest;

        console.log(
          '[Service Worker] Received readable text extraction request:',
          request.requestId,
          request.url
        );

        // Handle async extraction
        extractReadableText(request.url, request.requestId).then((result) => {
          // Update statistics
          updateStats(result.success, request.url);

          // Send response
          sendResponse(result);
        });

        // Return true to indicate async response
        return true;
      }

      // Handle readable HTML extraction requests
      if (message.type === 'EXTRACT_READABLE_HTML') {
        const request = message as ExtractReadableHtmlRequest;

        console.log(
          '[Service Worker] Received readable HTML extraction request:',
          request.requestId,
          request.url
        );

        // Handle async extraction
        extractReadableHtml(request.url, request.requestId).then((result) => {
          // Update statistics
          updateStats(result.success, request.url);

          // Send response
          sendResponse(result);
        });

        // Return true to indicate async response
        return true;
      }
    }

    return undefined;
  }) as Parameters<typeof browser.runtime.onMessage.addListener>[0]
);

console.log('[Service Worker] Blogs Are Back extension loaded');

// ============================================
// Startup & Periodic Directory Updates Check
// ============================================

/**
 * Setup or update the periodic check alarm based on settings
 */
async function setupPeriodicCheckAlarm(): Promise<void> {
  const settings = await getSettings();
  const intervalMinutes = settings.feedCheckIntervalMinutes;

  // Clear existing alarm first
  await browser.alarms.clear(DIRECTORY_CHECK_ALARM);

  if (intervalMinutes > 0) {
    // Create alarm with configured interval
    await browser.alarms.create(DIRECTORY_CHECK_ALARM, {
      periodInMinutes: intervalMinutes,
    });
    console.log(`[Service Worker] Periodic check alarm set for every ${intervalMinutes} minutes`);
  } else {
    console.log('[Service Worker] Periodic check alarm disabled (interval = 0)');
  }
}

// Check for directory updates on startup (if we have stored followed blogs)
checkDirectoryUpdatesFromAPI().catch((error) => {
  console.log('[Service Worker] Startup directory check failed:', error);
});

// Set up periodic check alarm based on settings
setupPeriodicCheckAlarm().catch((error) => {
  console.log('[Service Worker] Failed to setup periodic check alarm:', error);
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DIRECTORY_CHECK_ALARM) {
    console.log('[Service Worker] Periodic directory updates check triggered');
    checkDirectoryUpdatesFromAPI().catch((error) => {
      console.log('[Service Worker] Periodic directory check failed:', error);
    });
  }
});

// Listen for settings changes to update the alarm
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEY_SETTINGS]) {
    const oldSettings = changes[STORAGE_KEY_SETTINGS].oldValue as ExtensionSettings | undefined;
    const newSettings = changes[STORAGE_KEY_SETTINGS].newValue as ExtensionSettings | undefined;

    // Update alarm if interval changed
    if (oldSettings?.feedCheckIntervalMinutes !== newSettings?.feedCheckIntervalMinutes) {
      console.log('[Service Worker] Feed check interval changed, updating alarm...');
      setupPeriodicCheckAlarm().catch((error) => {
        console.error('[Service Worker] Failed to update periodic check alarm:', error);
      });
    }
  }
});

// Handle notification clicks - open Blogs Are Back
browser.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'blog-updates') {
    browser.tabs.create({ url: 'https://www.blogsareback.com' });
    browser.notifications.clear(notificationId);
  }
});
