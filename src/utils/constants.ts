// Fetch timeout in milliseconds (30 seconds)
export const FETCH_TIMEOUT = 30000;

// Extension version - injected from package.json at build time (see vite.config.ts)
export const EXTENSION_VERSION = __EXTENSION_VERSION__;

// User agent string for feed requests
export const USER_AGENT = `BlogsAreBack-Extension/${EXTENSION_VERSION}`;

// Maximum number of redirects to follow
export const MAX_REDIRECTS = 5;

// Storage keys
export const STORAGE_KEY_STATS = 'stats';
export const STORAGE_KEY_SUBSCRIPTION_QUEUE = 'subscriptionQueue';
export const STORAGE_KEY_DIRECTORY_UPDATES = 'directoryUpdates';
export const STORAGE_KEY_FOLLOWED_BLOGS = 'followedBlogs';
export const STORAGE_KEY_FOLLOWED_FEED_URLS = 'followedFeedUrls'; // All feed URLs for duplicate detection
export const STORAGE_KEY_LAST_DIRECTORY_VISIT = 'lastDirectoryVisit';
export const STORAGE_KEY_SETTINGS = 'settings';
export const STORAGE_KEY_CUSTOM_BLOGS = 'customBlogs';
export const STORAGE_KEY_CUSTOM_BLOG_UPDATES = 'customBlogUpdates';
export const STORAGE_KEY_FLOATING_BUTTON_DISMISSED = 'floatingButtonDismissed'; // Domains where floating button is hidden

// Directory updates API endpoint
export const DIRECTORY_UPDATES_API_URL = 'https://www.blogsareback.com/api/directory/updates';

// Directory updates badge color (distinct from feed discovery blue)
export const DIRECTORY_BADGE_COLOR = '#ef4444'; // Red

// Custom blog update checking
export const CUSTOM_BLOG_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const CUSTOM_BLOG_CHECK_TIMEOUT_MS = 15000; // 15 seconds per feed
export const MAX_CONCURRENT_CUSTOM_CHECKS = 10; // Max feeds to check in parallel
export const CUSTOM_BLOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Alarm names
export const ALARM_DIRECTORY_UPDATES = 'checkDirectoryUpdates';
export const ALARM_CUSTOM_BLOG_UPDATES = 'checkCustomBlogUpdates';
