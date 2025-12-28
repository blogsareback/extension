/**
 * Cross-browser API wrapper
 *
 * This module provides a unified API that works across Chrome and Firefox.
 * It uses webextension-polyfill to normalize the differences between browsers.
 *
 * Usage:
 *   import browser from '@/utils/browser';
 *   await browser.storage.local.get('key');
 *
 * The polyfill:
 * - Provides Promise-based APIs (Firefox-style) for both browsers
 * - Handles chrome.* vs browser.* namespace differences
 * - Works in service workers, content scripts, and popup pages
 */

import Browser, { Runtime } from 'webextension-polyfill';

// Re-export the polyfill as the default export
export default Browser;

// Also export as named export for flexibility
export { Browser as browser };

// Type re-exports for convenience
export type {
  Storage,
  Tabs,
  Runtime,
  Notifications,
  Alarms,
  ContextMenus,
  Action,
} from 'webextension-polyfill';

// Convenience type aliases for common message handler patterns
export type MessageSender = Runtime.MessageSender;
