/**
 * Custom blog updates handler - checks for updates to user's custom blogs by fetching feeds
 */

import browser from '../../utils/browser';
import { isValidFeedUrl } from '../../utils/security';
import {
  STORAGE_KEY_CUSTOM_BLOGS,
  STORAGE_KEY_CUSTOM_BLOG_UPDATES,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_LAST_DIRECTORY_VISIT,
  STORAGE_KEY_DIRECTORY_UPDATES,
  STORAGE_KEY_FOLLOWED_FEED_URLS,
  STORAGE_KEY_DIRECTORY_BLOG_TITLES,
  CUSTOM_BLOG_CHECK_TIMEOUT,
  USER_AGENT,
} from '../utils/constants';
import { processBatchWithConcurrency } from '../utils/fetch';
import { sendCustomBlogNotification } from '../utils/notifications';
import { getSettings, isFeatureMode, DEFAULT_SETTINGS } from '../storage/settings';
import { getDirectoryUpdatesState, getCustomBlogUpdatesState, updateDirectoryBadge } from '../storage/state';
import { checkDirectoryUpdatesFromAPI } from './directory-updates';
import type {
  CustomBlogUpdatesState,
  CustomBlogState,
  CustomBlogSyncData,
  DirectoryBlogSyncData,
  ExtensionSettings,
  SyncAllBlogsRequest,
  DirectoryUpdatesState,
} from '../../utils/types';

/**
 * Fetch the newest post date from a feed
 * Returns timestamp in ms, or null if unable to determine
 * @param feedUrl - The URL of the feed to check
 * @param timeoutMs - Timeout in milliseconds (defaults to CUSTOM_BLOG_CHECK_TIMEOUT)
 */
async function fetchNewestPostDate(feedUrl: string, timeoutMs?: number): Promise<number | null> {
  const timeout = timeoutMs ?? CUSTOM_BLOG_CHECK_TIMEOUT;

  try {
    // Validate URL
    if (!isValidFeedUrl(feedUrl)) {
      console.warn('[Service Worker] Invalid feed URL:', feedUrl);
      return null;
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Service Worker] Feed fetch failed: ${response.status}`);
        return null;
      }

      const xml = await response.text();

      // Quick regex-based date extraction (much faster than full parsing)
      // Look for common date patterns in RSS/Atom feeds
      const datePatterns = [
        /<pubDate>([^<]+)<\/pubDate>/i,
        /<updated>([^<]+)<\/updated>/i,
        /<dc:date>([^<]+)<\/dc:date>/i,
        /<published>([^<]+)<\/published>/i,
      ];

      for (const pattern of datePatterns) {
        const match = xml.match(pattern);
        if (match && match[1]) {
          const date = new Date(match[1].trim());
          if (!isNaN(date.getTime())) {
            return date.getTime();
          }
        }
      }

      // If no date found, return null
      return null;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error) {
    console.warn(`[Service Worker] Failed to fetch newest post date from ${feedUrl}:`, error);
    return null;
  }
}

/**
 * Check custom blogs for updates by fetching each feed and comparing post dates
 * Respects concurrency and throttling settings
 */
export async function checkCustomBlogUpdates(options?: { silent?: boolean }): Promise<void> {
  const { silent = false } = options ?? {};

  try {
    // Check if in featured mode
    const isFeatured = await isFeatureMode();
    if (!isFeatured) {
      console.log('[Service Worker] Basic mode - skipping custom blog check');
      return;
    }

    // Get stored custom blogs and settings
    const result = await browser.storage.local.get([
      STORAGE_KEY_CUSTOM_BLOGS,
      STORAGE_KEY_CUSTOM_BLOG_UPDATES,
      STORAGE_KEY_SETTINGS,
    ]);

    const customBlogs = (result[STORAGE_KEY_CUSTOM_BLOGS] as CustomBlogSyncData[] | undefined) || [];
    const currentState = (result[STORAGE_KEY_CUSTOM_BLOG_UPDATES] as CustomBlogUpdatesState | undefined) || null;
    const settings = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY_SETTINGS] as Partial<ExtensionSettings> | undefined) };

    if (customBlogs.length === 0) {
      console.log('[Service Worker] No custom blogs to check');
      return;
    }

    const maxConcurrent = settings.maxConcurrentRequests;
    const delayMs = settings.requestDelayMs;

    console.log(`[Service Worker] Checking ${customBlogs.length} custom blogs (concurrency: ${maxConcurrent}, delay: ${delayMs}ms)...`);

    // Process blogs with configurable concurrency and throttling
    const blogStates: CustomBlogState[] = [];
    let updatedCount = 0;

    // Define processor for each blog
    const processBlog = async (blog: CustomBlogSyncData): Promise<CustomBlogState> => {
      try {
        const newestPostDate = await fetchNewestPostDate(blog.feedUrl, settings.requestTimeoutSeconds * 1000);

        const hasUpdates = newestPostDate !== null &&
          blog.lastPostDate !== null &&
          newestPostDate > blog.lastPostDate;

        return {
          feedUrl: blog.feedUrl,
          title: blog.title,
          lastKnownPostDate: blog.lastPostDate,
          currentPostDate: newestPostDate,
          lastCheckedAt: Date.now(),
          hasUpdates,
          errorCount: 0,
        };
      } catch (error) {
        console.warn(`[Service Worker] Failed to check ${blog.feedUrl}:`, error);

        // Find existing state for this blog if it exists
        const existingState = currentState?.blogs.find(b => b.feedUrl === blog.feedUrl);

        return {
          feedUrl: blog.feedUrl,
          title: blog.title,
          lastKnownPostDate: blog.lastPostDate,
          currentPostDate: existingState?.currentPostDate ?? null,
          lastCheckedAt: Date.now(),
          hasUpdates: existingState?.hasUpdates ?? false,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          errorCount: (existingState?.errorCount ?? 0) + 1,
        };
      }
    };

    // Process all blogs with concurrency control
    const processedStates = await processBatchWithConcurrency(
      customBlogs,
      processBlog,
      { maxConcurrent, delayMs }
    );

    // Count updates
    for (const state of processedStates) {
      blogStates.push(state);
      if (state.hasUpdates) {
        updatedCount++;
      }
    }

    // Update state
    const now = Date.now();
    const newState: CustomBlogUpdatesState = {
      status: 'success',
      blogs: blogStates,
      updatedCount,
      totalCount: customBlogs.length,
      lastCheckedAt: now,
      lastSyncAt: currentState?.lastSyncAt ?? now,
    };

    await browser.storage.local.set({
      [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: newState,
    });

    // Update badge (combine with directory updates count)
    const dirState = await getDirectoryUpdatesState();
    const totalUpdates = updatedCount + (dirState?.updatedCount ?? 0);
    await updateDirectoryBadge(totalUpdates);

    // Send notification if there are new updates and not silent
    if (!silent && updatedCount > 0 && settings.notificationsEnabled && settings.customBlogNotificationsEnabled) {
      await sendCustomBlogNotification(updatedCount, customBlogs.length);
    }

    console.log(`[Service Worker] Custom blog check complete: ${updatedCount} of ${customBlogs.length} have updates`);

  } catch (error) {
    console.error('[Service Worker] Custom blog check failed:', error);

    // Update state to show error
    const errorState: CustomBlogUpdatesState = {
      status: 'error',
      blogs: [],
      updatedCount: 0,
      totalCount: 0,
      lastCheckedAt: Date.now(),
      lastSyncAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await browser.storage.local.set({
      [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: errorState,
    });
  }
}

/**
 * Force check for custom blog updates (bypasses any cache)
 */
export async function forceCheckCustomBlogUpdates(): Promise<void> {
  console.log('[Service Worker] Force checking custom blog updates...');
  await checkCustomBlogUpdates({ silent: true });
}

/**
 * Handle the new SYNC_ALL_BLOGS message from web app
 * This syncs both directory and custom blogs
 */
export async function handleSyncAllBlogs(message: SyncAllBlogsRequest): Promise<void> {
  try {
    const { directoryBlogs, customBlogs, followedFeedUrls, lastVisit } = message;
    const now = Date.now();
    const isFeatured = await isFeatureMode();

    // Handle both old format (string[]) and new format (DirectoryBlogSyncData[])
    // This ensures backward compatibility with older web app versions
    let blogIds: string[];
    let blogTitles: Record<string, string> = {};

    if (directoryBlogs.length > 0 && typeof directoryBlogs[0] === 'string') {
      // Old format: just IDs (no titles available)
      blogIds = directoryBlogs as unknown as string[];
    } else {
      // New format: objects with id and title
      const typedBlogs = directoryBlogs as DirectoryBlogSyncData[];
      blogIds = typedBlogs.map(b => b.id);
      for (const blog of typedBlogs) {
        blogTitles[blog.id] = blog.title;
      }
    }

    console.log('[Service Worker] Syncing all blogs:', {
      directoryCount: blogIds.length,
      customCount: customBlogs.length,
      feedUrlCount: followedFeedUrls?.length ?? 0,
      lastVisit: lastVisit ? new Date(lastVisit).toISOString() : null,
      mode: isFeatured ? 'featured' : 'basic',
      hasBlogTitles: Object.keys(blogTitles).length > 0,
    });

    // Store directory blog IDs
    await browser.storage.local.set({
      [STORAGE_KEY_FOLLOWED_BLOGS]: blogIds,
    });

    // Store directory blog titles (ID -> title mapping)
    await browser.storage.local.set({
      [STORAGE_KEY_DIRECTORY_BLOG_TITLES]: blogTitles,
    });

    // Store custom blogs
    await browser.storage.local.set({
      [STORAGE_KEY_CUSTOM_BLOGS]: customBlogs,
    });

    // Store all followed feed URLs for duplicate detection in feed discovery
    if (followedFeedUrls) {
      await browser.storage.local.set({
        [STORAGE_KEY_FOLLOWED_FEED_URLS]: followedFeedUrls,
      });
    }

    // Store last visit timestamp if provided
    if (lastVisit !== null) {
      await browser.storage.local.set({
        [STORAGE_KEY_LAST_DIRECTORY_VISIT]: lastVisit,
      });
    }

    // In basic mode, just store the data and skip update checking
    if (!isFeatured) {
      console.log('[Service Worker] Basic mode - skipping update checks');

      // Update directory state to show disabled
      const basicDirState: DirectoryUpdatesState = {
        status: 'idle',
        isEnabled: false,
        updatedCount: 0,
        followedDirectoryCount: blogIds.length,
        totalBlogs: null,
        lastCheckedAt: null,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: blogIds.length > 0 ? 'synced' : 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: basicDirState,
      });

      // Update custom blog state to show disabled
      const basicCustomState: CustomBlogUpdatesState = {
        status: 'idle',
        blogs: [],
        updatedCount: 0,
        totalCount: customBlogs.length,
        lastCheckedAt: null,
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: basicCustomState,
      });

      // Clear any existing badge in basic mode
      await updateDirectoryBadge(0);
      return;
    }

    // Featured mode: proceed with update checking

    // Handle directory blogs (same logic as handleSyncFollowedBlogs)
    if (blogIds.length === 0) {
      const emptyDirState: DirectoryUpdatesState = {
        status: 'success',
        isEnabled: true,
        updatedCount: 0,
        followedDirectoryCount: 0,
        totalBlogs: null,
        lastCheckedAt: now,
        nextCheckAt: null,
        sinceTimestamp: lastVisit,
        syncStatus: 'synced_empty',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: emptyDirState,
      });
    } else {
      // Check directory updates
      const currentDirState = await getDirectoryUpdatesState();
      const checkingDirState: DirectoryUpdatesState = {
        status: 'checking',
        isEnabled: true,
        updatedCount: currentDirState?.updatedCount ?? 0,
        followedDirectoryCount: blogIds.length,
        totalBlogs: currentDirState?.totalBlogs ?? null,
        lastCheckedAt: currentDirState?.lastCheckedAt ?? null,
        nextCheckAt: currentDirState?.nextCheckAt ?? null,
        sinceTimestamp: lastVisit,
        syncStatus: 'synced',
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_DIRECTORY_UPDATES]: checkingDirState,
      });

      // Check directory updates (don't await - let it run in background)
      checkDirectoryUpdatesFromAPI({ skipCache: true, silent: true }).catch((error) => {
        console.error('[Service Worker] Directory updates check failed:', error);
      });
    }

    // Handle custom blogs
    if (customBlogs.length === 0) {
      const emptyCustomState: CustomBlogUpdatesState = {
        status: 'success',
        blogs: [],
        updatedCount: 0,
        totalCount: 0,
        lastCheckedAt: now,
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: emptyCustomState,
      });
    } else {
      // Initialize custom blog state
      const blogStates: CustomBlogState[] = customBlogs.map((blog) => ({
        feedUrl: blog.feedUrl,
        title: blog.title,
        lastKnownPostDate: blog.lastPostDate,
        currentPostDate: null,
        lastCheckedAt: null,
        hasUpdates: false,
        errorCount: 0,
      }));

      const checkingCustomState: CustomBlogUpdatesState = {
        status: 'checking',
        blogs: blogStates,
        updatedCount: 0,
        totalCount: customBlogs.length,
        lastCheckedAt: null,
        lastSyncAt: now,
      };
      await browser.storage.local.set({
        [STORAGE_KEY_CUSTOM_BLOG_UPDATES]: checkingCustomState,
      });

      // Check custom blog updates (don't await - let it run in background)
      checkCustomBlogUpdates({ silent: true }).catch((error) => {
        console.error('[Service Worker] Custom blog updates check failed:', error);
      });
    }

  } catch (error) {
    console.error('[Service Worker] Failed to sync all blogs:', error);
  }
}
