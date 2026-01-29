/**
 * Settings storage and management
 */

import browser from '../../utils/browser';
import { STORAGE_KEY_SETTINGS, STORAGE_KEY_SUBSCRIPTION_QUEUE, STORAGE_KEY_STATS } from '../utils/constants';
import type { ExtensionSettings } from '../../utils/types';

// Default settings (must match types.ts DEFAULT_SETTINGS)
export const DEFAULT_SETTINGS: ExtensionSettings = {
  extensionMode: 'basic', // Default to basic mode (conservative)
  feedDiscoveryEnabled: true,
  showBadgeCount: true,
  floatingButtonEnabled: true,
  stricterFeedRecognition: false, // Off by default for broader feed detection
  // Floating button customization defaults
  floatingButtonStyle: 'solid',
  floatingButtonPosition: 'bottom-right',
  floatingButtonBehavior: 'always',
  floatingButtonShowDelay: 0, // Show immediately
  floatingButtonOnlyArticles: false, // Show on all pages with feeds
  // Notifications
  notificationsEnabled: true,
  blogUpdateNotificationsEnabled: true,
  customBlogNotificationsEnabled: true,
  // Performance
  prefetchOnUpdate: false, // Disabled by default to save bandwidth
  // Advanced defaults
  feedCheckIntervalMinutes: 10, // Check every 10 minutes
  requestTimeoutSeconds: 30, // 30 second timeout
  maxConcurrentRequests: 10, // Up to 10 concurrent requests
  requestDelayMs: 0, // No delay between requests by default
  // UI preferences
  advancedSettingsExpanded: false, // Collapsed by default
};

/**
 * Check if the extension is in featured mode
 */
export async function isFeatureMode(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
    const settings = (result[STORAGE_KEY_SETTINGS] as ExtensionSettings | undefined) || DEFAULT_SETTINGS;
    return settings.extensionMode === 'featured';
  } catch (error) {
    console.error('[Service Worker] Failed to check extension mode:', error);
    return false; // Default to basic mode on error
  }
}

/**
 * Get current settings from storage
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
    const stored = result[STORAGE_KEY_SETTINGS] as Partial<ExtensionSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (error) {
    console.error('[Service Worker] Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update settings in storage
 */
export async function updateSettings(
  updates: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  try {
    const current = await getSettings();
    const newSettings = { ...current, ...updates };
    await browser.storage.local.set({ [STORAGE_KEY_SETTINGS]: newSettings });
    console.log('[Service Worker] Settings updated:', newSettings);
    return newSettings;
  } catch (error) {
    console.error('[Service Worker] Failed to update settings:', error);
    throw error;
  }
}

/**
 * Clear extension data based on type
 */
export async function clearData(
  dataType: 'queue' | 'stats' | 'all'
): Promise<boolean> {
  try {
    switch (dataType) {
      case 'queue':
        await browser.storage.local.remove(STORAGE_KEY_SUBSCRIPTION_QUEUE);
        console.log('[Service Worker] Cleared subscription queue');
        break;
      case 'stats':
        await browser.storage.local.remove(STORAGE_KEY_STATS);
        console.log('[Service Worker] Cleared statistics');
        break;
      case 'all':
        await browser.storage.local.clear();
        console.log('[Service Worker] Cleared all extension data');
        break;
    }
    return true;
  } catch (error) {
    console.error('[Service Worker] Failed to clear data:', error);
    return false;
  }
}
