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
  STORAGE_KEY_INSTALLED_AT,
  STORAGE_KEY_LINKED_USER_ID,
  STORAGE_KEY_FOLLOWED_BLOGS,
  STORAGE_KEY_CUSTOM_BLOGS,
  STORAGE_KEY_ENGAGEMENT,
  TELEMETRY_API,
} from '../utils/constants';
import { DEFAULT_SETTINGS, getSettings } from './settings';
import { getAnalyticsSummary } from './analytics';
import { getStorageStats } from './saved-posts-db';
import type {
  TelemetryPayload,
  CustomBlogSyncData,
  HeartbeatReason,
  EngagementCounters,
  ExtensionSettings,
} from '../../utils/types';

const DEFAULT_ENGAGEMENT: EngagementCounters = {
  feedSubscriptions: 0,
  notificationsShown: 0,
  notificationClicks: 0,
  popupOpens: 0,
  modeChanges: 0,
  postsSaved: 0,
  postsSavedByUrl: 0,
};

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
 * Get or create a persistent installation ID (random UUID).
 * Also stores `installedAt` timestamp on first install.
 */
export async function getOrCreateInstallationId(): Promise<string> {
  const result = await browser.storage.local.get([STORAGE_KEY_INSTALLATION_ID, STORAGE_KEY_INSTALLED_AT]);
  const existing = result[STORAGE_KEY_INSTALLATION_ID] as string | undefined;

  if (existing) {
    // Backfill installedAt for pre-existing installs that lack it
    if (!result[STORAGE_KEY_INSTALLED_AT]) {
      await browser.storage.local.set({ [STORAGE_KEY_INSTALLED_AT]: Date.now() });
    }
    return existing;
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await browser.storage.local.set({
    [STORAGE_KEY_INSTALLATION_ID]: id,
    [STORAGE_KEY_INSTALLED_AT]: now,
  });
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
 * Link a Supabase user ID to this installation.
 * Returns true if the link was new or changed, false if already linked to this user.
 */
export async function setLinkedUserId(userId: string): Promise<boolean> {
  const existing = await getLinkedUserId();
  if (existing === userId) return false; // Already linked to this user

  await browser.storage.local.set({ [STORAGE_KEY_LINKED_USER_ID]: userId });
  console.log('[Service Worker] Linked user ID:', userId);
  return true;
}

/**
 * Get the stored installedAt timestamp, or Date.now() as fallback
 */
async function getInstalledAt(): Promise<number> {
  const result = await browser.storage.local.get(STORAGE_KEY_INSTALLED_AT);
  return (result[STORAGE_KEY_INSTALLED_AT] as number) || Date.now();
}

/**
 * Get engagement counters from storage
 */
export async function getEngagement(): Promise<EngagementCounters> {
  const result = await browser.storage.local.get(STORAGE_KEY_ENGAGEMENT);
  const stored = result[STORAGE_KEY_ENGAGEMENT] as Partial<EngagementCounters> | undefined;
  return { ...DEFAULT_ENGAGEMENT, ...stored };
}

/**
 * Increment a single engagement counter (best-effort, catches errors)
 */
export async function incrementEngagement(counter: keyof EngagementCounters): Promise<void> {
  try {
    const current = await getEngagement();
    current[counter] += 1;
    await browser.storage.local.set({ [STORAGE_KEY_ENGAGEMENT]: current });
  } catch (error) {
    console.warn('[Service Worker] Failed to increment engagement counter:', counter, error);
  }
}

/**
 * Compute settings that differ from defaults.
 * Returns undefined if all settings match defaults.
 */
function computeCustomizations(settings: ExtensionSettings): Partial<ExtensionSettings> | undefined {
  const customizations: Partial<ExtensionSettings> = {};
  let hasCustomizations = false;

  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof ExtensionSettings>) {
    if (settings[key] !== DEFAULT_SETTINGS[key]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (customizations as Record<string, any>)[key] = settings[key];
      hasCustomizations = true;
    }
  }

  return hasCustomizations ? customizations : undefined;
}

interface HeartbeatOptions {
  reason: HeartbeatReason;
  previousVersion?: string;
}

/**
 * Build the telemetry payload from current extension state
 */
async function buildTelemetryPayload(options: HeartbeatOptions): Promise<TelemetryPayload> {
  const [installationId, linkedUserId, settings, storage, installedAt, engagement] = await Promise.all([
    getOrCreateInstallationId(),
    getLinkedUserId(),
    getSettings(),
    browser.storage.local.get([STORAGE_KEY_FOLLOWED_BLOGS, STORAGE_KEY_CUSTOM_BLOGS]),
    getInstalledAt(),
    getEngagement(),
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

  const customizations = computeCustomizations(settings);

  const payload: TelemetryPayload = {
    installationId,
    userId: linkedUserId,
    extensionVersion: EXTENSION_VERSION,
    extensionMode: settings.extensionMode,
    browser: detectBrowser(),
    installedAt,
    heartbeatReason: options.reason,
    analytics: analyticsSummary,
    engagement,
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

  if (options.previousVersion) {
    payload.previousVersion = options.previousVersion;
  }
  if (customizations) {
    payload.customizations = customizations;
  }

  return payload;
}

/**
 * Send a telemetry heartbeat to the server.
 * Best-effort: failures are logged but not thrown.
 */
export async function sendTelemetryHeartbeat(options: HeartbeatOptions): Promise<void> {
  const settings = await getSettings();
  if (!settings.analyticsEnabled) {
    console.log('[Service Worker] Telemetry disabled, skipping heartbeat');
    return;
  }

  try {
    const payload = await buildTelemetryPayload(options);

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
