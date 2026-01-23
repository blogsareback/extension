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
export const STORAGE_KEY_COMMUNITY_UPDATES = 'communityUpdates';
export const STORAGE_KEY_FOLLOWED_BLOGS = 'followedBlogs';
export const STORAGE_KEY_FOLLOWED_COMMUNITY_BLOGS = 'followedCommunityBlogs';
export const STORAGE_KEY_FOLLOWED_FEED_URLS = 'followedFeedUrls';
export const STORAGE_KEY_LAST_DIRECTORY_VISIT = 'lastDirectoryVisit';
export const STORAGE_KEY_SETTINGS = 'settings';
export const STORAGE_KEY_CUSTOM_BLOGS = 'customBlogs';
export const STORAGE_KEY_CUSTOM_BLOG_UPDATES = 'customBlogUpdates';
export const STORAGE_KEY_DIRECTORY_BLOG_TITLES = 'directoryBlogTitles'; // ID -> title mapping
export const STORAGE_KEY_COMMUNITY_BLOG_TITLES = 'communityBlogTitles'; // ID -> title mapping
export const STORAGE_KEY_ANALYTICS = 'analytics'; // Daily/aggregate stats for web app

// Analytics configuration
export const ANALYTICS_MAX_DAILY_RECORDS = 30; // Keep 30 days of daily stats

// Dashboard URL for opening blog in new tab
export const DASHBOARD_BASE_URL = 'https://www.blogsareback.com/dashboard';

// API endpoints
export const DIRECTORY_UPDATES_API = 'https://www.blogsareback.com/api/directory/updates';
export const COMMUNITY_UPDATES_API = 'https://www.blogsareback.com/api/community/updates';

// Cache TTL for catalog updates (5 minutes, matches server CDN cache)
export const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
// Backwards compatibility
export const DIRECTORY_CACHE_TTL_MS = CATALOG_CACHE_TTL_MS;

// Badge colors
export const CATALOG_BADGE_COLOR = '#ef4444'; // Red for catalog updates
export const DIRECTORY_BADGE_COLOR = CATALOG_BADGE_COLOR; // Backwards compatibility
export const FEED_DISCOVERY_BADGE_COLOR = '#3b82f6'; // Blue for feed discovery

// Alarm names
export const CATALOG_CHECK_ALARM = 'catalog-updates-check';
export const DIRECTORY_CHECK_ALARM = CATALOG_CHECK_ALARM; // Backwards compatibility

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

// Feed cache configuration (conditional GET optimization)
export const STORAGE_KEY_FEED_CACHE_PREFIX = 'feedCache:'; // + urlHash
export const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
export const FEED_CACHE_MAX_ENTRIES = 100; // Max cached feeds
export const FEED_CACHE_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB total cache size

// HEAD request configuration (for custom blog update checking)
export const HEAD_REQUEST_TIMEOUT = 5000; // 5 seconds for HEAD requests
