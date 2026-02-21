/**
 * Telemetry storage and heartbeat
 *
 * Manages anonymous installation tracking and periodic heartbeat
 * to help understand how the extension is used.
 */

import browser from '../../utils/browser';
import { EXTENSION_VERSION } from '../../utils/constants';
import {
  STORAGE_KEY_INSTALLATION_ID,
  STORAGE_KEY_LINKED_USER_ID,
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_CUSTOM_BLOGS,
  TELEMETRY_API,
} from '../utils/constants';
import { getSettings } from './settings';
import { getAnalyticsSummary } from './analytics';
import { getStorageStats } from './saved-posts-db';
import type { TelemetryPayload, CustomBlogSyncData } from '../../utils/types';

/**
 * Detect current browser
 */
function detectBrowser(): 'chrome' | 'firefox' {
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')) {
    return 'firefox';
  }
  return 'chrome';
}

/**
 * Get or create a persistent installation ID (random UUID)
 */
export async function getOrCreateInstallationId(): Promise<string> {
  const result = await browser.storage.local.get(STORAGE_KEY_INSTALLATION_ID);
  const existing = result[STORAGE_KEY_INSTALLATION_ID] as string | undefined;

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  await browser.storage.local.set({ [STORAGE_KEY_INSTALLATION_ID]: id });
  console.log('[Service Worker] Generated installation ID:', id);
  return id;
}

/**
 * Get the linked Supabase user ID (if any)
 */
export async function getLinkedUserId(): Promise<string | null> {
  const result = await browser.storage.local.get(STORAGE_KEY_LINKED_USER_ID);
  return (result[STORAGE_KEY_LINKED_USER_ID] as string) || null;
}

/**
 * Link a Supabase user ID to this installation
 */
export async function setLinkedUserId(userId: string): Promise<void> {
  const existing = await getLinkedUserId();
  if (existing === userId) return; // Already linked to this user

  await browser.storage.local.set({ [STORAGE_KEY_LINKED_USER_ID]: userId });
  console.log('[Service Worker] Linked user ID:', userId);
}

/**
 * Build the telemetry payload from current extension state
 */
async function buildTelemetryPayload(): Promise<TelemetryPayload> {
  const [installationId, linkedUserId, settings, storage] = await Promise.all([
    getOrCreateInstallationId(),
    getLinkedUserId(),
    getSettings(),
    browser.storage.local.get([STORAGE_KEY_FOLLOWED_BLOGS, STORAGE_KEY_CUSTOM_BLOGS]),
  ]);

  // Get analytics summary (best-effort)
  let analyticsSummary = null;
  try {
    analyticsSummary = await getAnalyticsSummary();
  } catch {
    // Analytics not critical for telemetry
  }

  // Get saved posts count (best-effort)
  let savedPostsCount = 0;
  try {
    const stats = await getStorageStats();
    savedPostsCount = stats.count;
  } catch {
    // Saved posts count not critical
  }

  const followedBlogs = (storage[STORAGE_KEY_FOLLOWED_BLOGS] as string[] | undefined) || [];
  const customBlogs = (storage[STORAGE_KEY_CUSTOM_BLOGS] as CustomBlogSyncData[] | undefined) || [];

  return {
    installationId,
    userId: linkedUserId,
    extensionVersion: EXTENSION_VERSION,
    extensionMode: settings.extensionMode,
    browser: detectBrowser(),
    analytics: analyticsSummary,
    features: {
      feedDiscoveryEnabled: settings.feedDiscoveryEnabled,
      floatingButtonEnabled: settings.floatingButtonEnabled,
      notificationsEnabled: settings.notificationsEnabled,
      newPostBadgeEnabled: settings.newPostBadgeEnabled,
      prefetchOnUpdate: settings.prefetchOnUpdate,
      backgroundCustomBlogChecks: settings.backgroundCustomBlogChecks,
      followedBlogCount: followedBlogs.length,
      customBlogCount: customBlogs.length,
      savedPostsCount,
    },
  };
}

/**
 * Send a telemetry heartbeat to the server.
 * Best-effort: failures are logged but not thrown.
 */
export async function sendTelemetryHeartbeat(): Promise<void> {
  const settings = await getSettings();
  if (!settings.analyticsEnabled) {
    console.log('[Service Worker] Telemetry disabled, skipping heartbeat');
    return;
  }

  try {
    const payload = await buildTelemetryPayload();

    const response = await fetch(TELEMETRY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[Service Worker] Telemetry heartbeat sent successfully');
    } else {
      console.warn('[Service Worker] Telemetry heartbeat failed:', response.status);
    }
  } catch (error) {
    console.warn('[Service Worker] Telemetry heartbeat error:', error);
  }
}
