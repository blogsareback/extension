/**
 * Notification utilities for the service worker
 */

import browser from '../../utils/browser';

/**
 * Send a push notification about blog updates
 */
export async function sendBlogUpdatesNotification(
  updatedCount: number,
  totalFollowed: number
): Promise<void> {
  try {
    const title = updatedCount === 1
      ? '1 blog has new posts'
      : `${updatedCount} blogs have new posts`;

    const message = updatedCount === totalFollowed
      ? 'All your followed blogs have updates!'
      : `${updatedCount} of ${totalFollowed} followed blogs have new content.`;

    await browser.notifications.create('blog-updates', {
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 1,
    });

    console.log('[Service Worker] Sent blog updates notification');
  } catch (error) {
    console.error('[Service Worker] Failed to send notification:', error);
  }
}

/**
 * Send a push notification about custom blog updates
 */
export async function sendCustomBlogNotification(
  updatedCount: number,
  totalCount: number
): Promise<void> {
  try {
    const title = updatedCount === 1
      ? '1 custom blog has new posts'
      : `${updatedCount} custom blogs have new posts`;

    const message = updatedCount === totalCount
      ? 'All your custom blogs have updates!'
      : `${updatedCount} of ${totalCount} custom blogs have new content.`;

    await browser.notifications.create('custom-blog-updates', {
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 1,
    });

    console.log('[Service Worker] Sent custom blog updates notification');
  } catch (error) {
    console.error('[Service Worker] Failed to send notification:', error);
  }
}
