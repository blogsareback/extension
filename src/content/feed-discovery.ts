import browser from '../utils/browser'
import { shouldExcludeUrl } from './excluded-domains'
import type { FeedLink, FeedsDetectedMessage } from '../utils/types'

/**
 * Feed Discovery Content Script
 * Runs on all pages to detect RSS/Atom feeds and notify the service worker
 */

/**
 * Discover RSS/Atom feeds from <link> tags in the page
 */
function discoverFeeds(): FeedLink[] {
  const feeds: FeedLink[] = [];

  // Look for <link rel="alternate"> tags with RSS/Atom type
  const linkElements = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="alternate"]'
  );

  linkElements.forEach((link) => {
    const type = link.type?.toLowerCase() || '';
    const href = link.href;

    // Check if it's an RSS or Atom feed
    if (
      type.includes('rss') ||
      type.includes('atom') ||
      type.includes('xml') ||
      type.includes('feed')
    ) {
      feeds.push({
        href,
        title: link.title || document.title,
        type: link.type,
      });
    }
  });

  return feeds;
}

/**
 * Send discovered feeds to service worker
 * When no feeds are found, requests the service worker to probe common paths
 */
function notifyServiceWorker(feeds: FeedLink[]): void {
  const message: FeedsDetectedMessage = {
    type: 'FEEDS_DETECTED',
    pageUrl: window.location.href,
    feeds,
    // Request probing when no feeds found via <link> tags
    probeRequested: feeds.length === 0,
  };

  browser.runtime.sendMessage(message).catch((error: Error) => {
    // Silently fail if extension context is invalid
    // This can happen during extension reload
    if (error.message?.includes('Extension context invalidated')) {
      return;
    }
    console.error('[Feed Discovery] Error sending message:', error);
  });
}

/**
 * Check if we're on the BlogsAreBack domain
 */
function isBlogsAreBackDomain(): boolean {
  const hostname = window.location.hostname;
  return (
    hostname === 'blogsareback.com' ||
    hostname.endsWith('.blogsareback.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

/**
 * Initialize feed discovery
 */
function init(): void {
  // Skip feed discovery on BlogsAreBack domains - no need to discover feeds on the app itself
  if (isBlogsAreBackDomain()) {
    return
  }

  // Skip feed discovery on excluded domains (social media, platforms, Fediverse, etc.)
  // Users can still manually add feeds from these sites via direct URL entry
  if (shouldExcludeUrl(window.location)) {
    return
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const feeds = discoverFeeds();
      notifyServiceWorker(feeds);
    });
  } else {
    // DOM is already ready
    const feeds = discoverFeeds();
    notifyServiceWorker(feeds);
  }

  // Also check for dynamically added feeds.
  // Debounce to avoid rapid-fire messages when a page adds multiple <link> tags.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver((mutations) => {
    let hasNewFeedLink = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === 'alternate') {
            hasNewFeedLink = true;
            break;
          }
        }
      }
      if (hasNewFeedLink) break;
    }

    if (hasNewFeedLink) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const feeds = discoverFeeds();
        notifyServiceWorker(feeds);
      }, 500);
    }
  });

  // Observe <head> for dynamically added link tags
  if (document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });
  }
}

// Initialize when script loads
init();

console.log('[Feed Discovery] Content script loaded');
