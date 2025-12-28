/**
 * Shared constants for the service worker
 */

// Fetch configuration
export const FETCH_TIMEOUT = 30000;
export const USER_AGENT = 'BlogsAreBack-Extension/1.0';
export const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB limit
export const MAX_RETRIES = 2; // Retry up to 2 times (3 total attempts)
export const INITIAL_RETRY_DELAY = 1000; // 1 second initial delay

// Custom blog update checking
export const CUSTOM_BLOG_CHECK_TIMEOUT = 15000; // 15 seconds per feed
export const MAX_CONCURRENT_CUSTOM_CHECKS = 10; // Max feeds to check in parallel

// Storage keys
export const STORAGE_KEY_STATS = 'stats';
export const STORAGE_KEY_SUBSCRIPTION_QUEUE = 'subscriptionQueue';
export const STORAGE_KEY_DIRECTORY_UPDATES = 'directoryUpdates';
export const STORAGE_KEY_FOLLOWED_BLOGS = 'followedBlogs';
export const STORAGE_KEY_FOLLOWED_FEED_URLS = 'followedFeedUrls';
export const STORAGE_KEY_LAST_DIRECTORY_VISIT = 'lastDirectoryVisit';
export const STORAGE_KEY_SETTINGS = 'settings';
export const STORAGE_KEY_CUSTOM_BLOGS = 'customBlogs';
export const STORAGE_KEY_CUSTOM_BLOG_UPDATES = 'customBlogUpdates';
export const STORAGE_KEY_DIRECTORY_BLOG_TITLES = 'directoryBlogTitles'; // ID -> title mapping

// Dashboard URL for opening blog in new tab
export const DASHBOARD_BASE_URL = 'https://www.blogsareback.com/dashboard';

// API endpoints
export const DIRECTORY_UPDATES_API = 'https://www.blogsareback.com/api/directory/updates';

// Cache TTL for directory updates (5 minutes, matches server CDN cache)
export const DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;

// Badge colors
export const DIRECTORY_BADGE_COLOR = '#ef4444'; // Red for directory updates
export const FEED_DISCOVERY_BADGE_COLOR = '#3b82f6'; // Blue for feed discovery

// Alarm names
export const DIRECTORY_CHECK_ALARM = 'directory-updates-check';

// Common feed paths to try when no feed links found in HTML
export const COMMON_FEED_PATHS = [
  '/feed',
  '/rss',
  '/atom.xml',
  '/feed.xml',
  '/rss.xml',
  '/index.xml',
  '/feeds/posts/default',
  '/blog/feed',
  '/blog/rss',
];

// Feed path probing configuration
export const STORAGE_KEY_PROBE_CACHE = 'probeCache';
export const PROBE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PROBE_TIMEOUT = 8000; // 8 seconds per path check
export const PROBE_BATCH_SIZE = 3; // Check 3 paths in parallel
