// Message from web app to extension - Feed fetching
export interface FetchFeedRequest {
  type: 'FETCH_FEED';
  feedUrl: string;
  requestId: string;
}

// Message from extension to web app - Feed response
export interface FeedResponse {
  type: 'FEED_RESPONSE';
  requestId: string;
  success: boolean;
  data?: string;
  error?: string;
  status?: number;
}

// Message from web app to extension - Page fetching (raw HTML, no extraction)
export interface FetchPageRequest {
  type: 'FETCH_PAGE';
  url: string;
  requestId: string;
}

// Message from extension to web app - Page response (raw HTML)
export interface FetchPageResponse {
  type: 'PAGE_RESPONSE';
  requestId: string;
  success: boolean;
  data?: string; // Raw HTML content
  error?: string;
  status?: number;
}

// Message from web app to extension - Readable text extraction
export interface ExtractReadableTextRequest {
  type: 'EXTRACT_READABLE_TEXT';
  url: string;
  requestId: string;
}

// Extracted article data
export interface ReadableTextData {
  title: string;
  textContent: string;
  image: string | null;
  bodyHtml?: string | null;
  [key: string]: any;
}

// Message from extension to web app - Readable text response
export interface ReadableTextResponse {
  type: 'READABLE_TEXT_RESPONSE';
  requestId: string;
  success: boolean;
  data?: ReadableTextData;
  error?: string;
  status?: number;
}

// Message from web app to extension - Readable HTML extraction
export interface ExtractReadableHtmlRequest {
  type: 'EXTRACT_READABLE_HTML';
  url: string;
  requestId: string;
}

// Extracted article HTML data
export interface ReadableHtmlData {
  title: string;
  htmlContent: string;
  image: string | null;
}

// Message from extension to web app - Readable HTML response
export interface ReadableHtmlResponse {
  type: 'READABLE_HTML_RESPONSE';
  requestId: string;
  success: boolean;
  data?: ReadableHtmlData;
  error?: string;
  status?: number;
}

// Feed link discovered on a page
export interface FeedLink {
  href: string;
  title?: string;
  type?: string; // e.g., 'application/rss+xml', 'application/atom+xml'
}

// Message from feed-discovery content script to service worker
export interface FeedsDetectedMessage {
  type: 'FEEDS_DETECTED';
  pageUrl: string;
  feeds: FeedLink[];
  tabId?: number;
  /** Request probing common feed paths when no feeds found via <link> tags */
  probeRequested?: boolean;
}

// Cached probe result for a domain
export interface ProbeCacheEntry {
  domain: string;
  feeds: FeedLink[];
  timestamp: number; // When the probe was performed
}

// Queued subscription data stored in chrome.storage
export interface QueuedSubscription {
  feedUrl: string;
  pageUrl: string;
  feedTitle?: string;
  queuedAt: number; // Timestamp when queued
}

// Message to subscribe to feed(s) - sent from content script to web app
export interface SubscribeToFeedRequest {
  type: 'SUBSCRIBE_TO_FEED';
  subscriptions: QueuedSubscription[]; // Array of subscriptions (supports batch)
}

// Popup message: Request discovered feeds for current tab
export interface GetDiscoveredFeedsRequest {
  type: 'GET_DISCOVERED_FEEDS';
  tabId: number;
}

// Popup message: Response with discovered feeds
export interface GetDiscoveredFeedsResponse {
  type: 'DISCOVERED_FEEDS_RESPONSE';
  feeds: FeedLink[];
  pageUrl: string | null;
}

// Popup message: Request to subscribe to a feed
export interface PopupSubscribeRequest {
  type: 'POPUP_SUBSCRIBE';
  feed: FeedLink;
  pageUrl: string;
}

// Popup message: Response confirming subscription was queued
export interface PopupSubscribeResponse {
  type: 'POPUP_SUBSCRIBE_RESPONSE';
  success: boolean;
  error?: string;
}

// Popup/Queue page message: Request subscription queue
export interface GetSubscriptionQueueRequest {
  type: 'GET_SUBSCRIPTION_QUEUE';
}

// Popup/Queue page message: Response with subscription queue
export interface GetSubscriptionQueueResponse {
  type: 'SUBSCRIPTION_QUEUE_RESPONSE';
  queue: QueuedSubscription[];
}

// ============================================
// Directory Updates Sync Messages
// ============================================

// Sync status for followed blogs
export type SyncStatus = 'not_synced' | 'synced' | 'synced_empty';

/**
 * Directory blog data synced from web app (with title for display)
 */
export interface DirectoryBlogSyncData {
  id: string; // directory_blog_id
  title: string; // Blog title for display
}

/**
 * Community blog data synced from web app (with title for display)
 */
export interface CommunityBlogSyncData {
  id: string; // community_blog_id
  title: string; // Blog title for display
}

/**
 * Unified catalog source updates state
 * Used for both directory and community blog update tracking
 */
export interface CatalogSourceUpdatesState {
  status: 'idle' | 'checking' | 'success' | 'error' | 'disabled';
  isEnabled: boolean;
  updatedCount: number; // Number of followed blogs with new posts
  followedCount: number; // Total blogs user follows from this source
  totalBlogs: number | null; // Total blogs server monitors
  lastCheckedAt: number | null; // Timestamp (ms) when extension last checked API
  nextCheckAt: number | null; // Timestamp (ms) for next server check
  sinceTimestamp: number | null; // Timestamp (ms) used for checking
  error?: string;
  syncStatus: SyncStatus; // Whether blogs have been synced from web app
  lastSyncAt: number | null; // Timestamp (ms) when blogs were last synced
  updatedBlogs?: Array<{ id: string; title: string }>; // For popup display
}

// Type aliases for backward compatibility
export type DirectoryUpdatesState = CatalogSourceUpdatesState;
export type CommunityUpdatesState = CatalogSourceUpdatesState;

// Combined catalog updates state (for UI display)
export interface CatalogUpdatesState {
  directory: CatalogSourceUpdatesState | null;
  community: CatalogSourceUpdatesState | null;
  totalUpdatedCount: number;
  totalFollowedCount: number;
}

// Message from web app to extension - Sync directory updates state
export interface SyncDirectoryStateRequest {
  type: 'SYNC_DIRECTORY_STATE';
  state: DirectoryUpdatesState;
}

// Message from web app to extension - Sync followed blog IDs
export interface SyncFollowedBlogsRequest {
  type: 'SYNC_FOLLOWED_BLOGS';
  blogIds: string[]; // directory_blog_id values
  lastVisit: number | null; // Timestamp (ms) of last visit
}

// Message from extension to web app - Request current directory state
export interface RequestDirectoryStateMessage {
  type: 'REQUEST_DIRECTORY_STATE';
  requestId: string;
}

// Message from extension to web app - Directory state response
export interface DirectoryStateResponse {
  type: 'DIRECTORY_STATE_RESPONSE';
  requestId: string;
  state: DirectoryUpdatesState | null;
}

// Message from popup to service worker - Get directory updates state
export interface GetDirectoryUpdatesRequest {
  type: 'GET_DIRECTORY_UPDATES';
}

// Message from service worker to popup - Directory updates state response
export interface GetDirectoryUpdatesResponse {
  type: 'DIRECTORY_UPDATES_RESPONSE';
  state: DirectoryUpdatesState | null;
}

// Message from popup to service worker - Force check for directory updates
export interface ForceCheckDirectoryUpdatesRequest {
  type: 'FORCE_CHECK_DIRECTORY_UPDATES';
}

// Message from service worker to popup - Force check response
export interface ForceCheckDirectoryUpdatesResponse {
  type: 'FORCE_CHECK_DIRECTORY_UPDATES_RESPONSE';
  success: boolean;
  error?: string;
}

// Message from popup to service worker - Get community updates state
export interface GetCommunityUpdatesRequest {
  type: 'GET_COMMUNITY_UPDATES';
}

// Message from service worker to popup - Community updates state response
export interface GetCommunityUpdatesResponse {
  type: 'COMMUNITY_UPDATES_RESPONSE';
  state: CommunityUpdatesState | null;
}

// Message from popup to service worker - Force check for community updates
export interface ForceCheckCommunityUpdatesRequest {
  type: 'FORCE_CHECK_COMMUNITY_UPDATES';
}

// Message from service worker to popup - Force check response
export interface ForceCheckCommunityUpdatesResponse {
  type: 'FORCE_CHECK_COMMUNITY_UPDATES_RESPONSE';
  success: boolean;
  error?: string;
}

// Message from popup to service worker - Get combined catalog updates state
export interface GetCatalogUpdatesRequest {
  type: 'GET_CATALOG_UPDATES';
}

// Message from service worker to popup - Combined catalog updates state response
export interface GetCatalogUpdatesResponse {
  type: 'CATALOG_UPDATES_RESPONSE';
  state: CatalogUpdatesState | null;
}

// Message from popup to service worker - Force check for all catalog updates
export interface ForceCheckCatalogUpdatesRequest {
  type: 'FORCE_CHECK_CATALOG_UPDATES';
}

// Message from service worker to popup - Force check response
export interface ForceCheckCatalogUpdatesResponse {
  type: 'FORCE_CHECK_CATALOG_UPDATES_RESPONSE';
  success: boolean;
  error?: string;
}

// Chrome extension message envelope
export type ExtensionMessage =
  | FetchFeedRequest
  | FeedResponse
  | FetchPageRequest
  | FetchPageResponse
  | ExtractReadableTextRequest
  | ReadableTextResponse
  | ExtractReadableHtmlRequest
  | ReadableHtmlResponse
  | FeedsDetectedMessage
  | SubscribeToFeedRequest
  | GetDiscoveredFeedsRequest
  | GetDiscoveredFeedsResponse
  | PopupSubscribeRequest
  | PopupSubscribeResponse
  | GetSubscriptionQueueRequest
  | GetSubscriptionQueueResponse
  | SyncDirectoryStateRequest
  | SyncFollowedBlogsRequest
  | SyncAllBlogsRequest
  | RequestDirectoryStateMessage
  | DirectoryStateResponse
  | GetDirectoryUpdatesRequest
  | GetDirectoryUpdatesResponse
  | ForceCheckDirectoryUpdatesRequest
  | ForceCheckDirectoryUpdatesResponse
  | GetCommunityUpdatesRequest
  | GetCommunityUpdatesResponse
  | ForceCheckCommunityUpdatesRequest
  | ForceCheckCommunityUpdatesResponse
  | GetCatalogUpdatesRequest
  | GetCatalogUpdatesResponse
  | ForceCheckCatalogUpdatesRequest
  | ForceCheckCatalogUpdatesResponse
  | GetCustomBlogUpdatesRequest
  | GetCustomBlogUpdatesResponse
  | ForceCheckCustomBlogUpdatesRequest
  | ForceCheckCustomBlogUpdatesResponse
  | DiscoverFeedsRequest
  | DiscoverFeedsResponse
  | TestBlogStatusRequest
  | TestBlogStatusResponse
  | GetAnalyticsRequest
  | GetAnalyticsResponse
  | GetUpdateStateRequest
  | GetUpdateStateResponse
  | AcknowledgeUpdatesRequest
  | AcknowledgeUpdatesResponse;

// Statistics tracking

/** Types of operations tracked in statistics */
export type OperationType = 'feedFetch' | 'pageFetch' | 'readableText' | 'readableHtml';

/** Error categories for granular tracking */
export type ErrorCategory = 'network' | 'timeout' | 'server' | 'client' | 'validation';

/** Statistics for a single operation type */
export interface OperationStats {
  total: number;
  success: number;
  errors: number;
  /** Breakdown of errors by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Last operation details */
  lastOperation?: {
    url: string;
    timestamp: number;
    success: boolean;
    errorCategory?: ErrorCategory;
    errorMessage?: string;
    /** Response time in milliseconds */
    responseTimeMs?: number;
  };
  /** Average response time in milliseconds (rolling average of last 100) */
  avgResponseTimeMs?: number;
  /** Running sum for avg calculation */
  _responseTimeSum?: number;
  /** Count for avg calculation */
  _responseTimeCount?: number;
}

/** Complete statistics structure with per-operation tracking */
export interface FetchStats {
  /** Version for migration support */
  version: 2;
  /** Per-operation-type statistics */
  operations: Record<OperationType, OperationStats>;
  /** When stats were first tracked */
  startedAt: number;
  /** When stats were last updated */
  lastUpdatedAt: number;
}

/** Legacy stats structure for migration */
export interface LegacyFetchStats {
  totalFetches: number;
  errors: number;
  lastFetch?: {
    url: string;
    timestamp: number;
    success: boolean;
  };
}

// ============================================
// Analytics (for web app reporting)
// ============================================

/** Daily operation counts for a single operation type */
export interface DailyOperationCounts {
  total: number;
  success: number;
  errors: number;
}

/** Stats for a single day */
export interface DailyStats {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Per-operation counts */
  operations: Record<OperationType, DailyOperationCounts>;
  /** Total errors by category for the day */
  errorsByCategory: Record<ErrorCategory, number>;
}

/** Analytics data structure for web app reporting */
export interface AnalyticsData {
  /** Version for future migration */
  version: 1;

  /** Rolling daily stats (last 30 days) */
  dailyStats: DailyStats[];

  /** Lifetime aggregate stats */
  lifetime: {
    /** First use timestamp (ms) */
    firstUseAt: number;
    /** Number of unique days with activity */
    daysActive: number;
    /** Per-operation lifetime totals */
    operations: Record<OperationType, DailyOperationCounts>;
    /** Lifetime errors by category */
    errorsByCategory: Record<ErrorCategory, number>;
  };

  /** Last updated timestamp */
  lastUpdatedAt: number;
}

/** Summary stats returned to web app */
export interface AnalyticsSummary {
  /** Extension version */
  extensionVersion: string;

  /** Last 7 days summary */
  last7Days: {
    totalOperations: number;
    successRate: number;
    operationBreakdown: Record<OperationType, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    daysActive: number;
  };

  /** Last 30 days summary */
  last30Days: {
    totalOperations: number;
    successRate: number;
    operationBreakdown: Record<OperationType, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    daysActive: number;
  };

  /** Lifetime summary */
  lifetime: {
    firstUseAt: number;
    daysActive: number;
    totalOperations: number;
    successRate: number;
    operationBreakdown: Record<OperationType, number>;
  };

  /** Today's stats */
  today: {
    totalOperations: number;
    successCount: number;
    errorCount: number;
    operationBreakdown: Record<OperationType, number>;
  };
}

/** Message from web app to extension - Request analytics */
export interface GetAnalyticsRequest {
  type: 'GET_ANALYTICS';
  requestId: string;
}

/** Message from extension to web app - Analytics response */
export interface GetAnalyticsResponse {
  type: 'ANALYTICS_RESPONSE';
  requestId: string;
  success: boolean;
  data?: AnalyticsSummary;
  error?: string;
}

// ============================================
// Extension Mode
// ============================================

/**
 * Extension operating mode:
 * - 'basic': CORS proxy only, no sync/notifications
 * - 'featured': Full experience with update notifications
 */
export type ExtensionMode = 'basic' | 'featured';

// ============================================
// Extension Settings
// ============================================

export interface ExtensionSettings {
  // Extension Mode
  extensionMode: ExtensionMode;

  // Feed Discovery
  feedDiscoveryEnabled: boolean;
  showBadgeCount: boolean;

  // Notifications
  notificationsEnabled: boolean;
  blogUpdateNotificationsEnabled: boolean; // Notify when directory blogs have new posts
  customBlogNotificationsEnabled: boolean; // Notify when custom blogs have new posts

  // Performance
  /** Pre-fetch feed content when updates are detected (uses more bandwidth) */
  prefetchOnUpdate: boolean;

  // Advanced Settings
  /** Interval for automatic feed checks in minutes (0 = disabled) */
  feedCheckIntervalMinutes: number;
  /** Timeout for individual requests in seconds */
  requestTimeoutSeconds: number;
  /** Maximum concurrent feed check requests */
  maxConcurrentRequests: number;
  /** Delay between consecutive requests in milliseconds */
  requestDelayMs: number;

  // UI Preferences
  /** Whether the advanced settings section is expanded */
  advancedSettingsExpanded: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  extensionMode: 'basic', // Default to basic mode (conservative)
  feedDiscoveryEnabled: true,
  showBadgeCount: true,
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

// ============================================
// Custom Blog Sync Types
// ============================================

/**
 * Custom blog data synced from web app
 */
export interface CustomBlogSyncData {
  feedUrl: string;
  title: string;
  lastPostDate: number | null; // Timestamp (ms) of newest known post
}

/**
 * State tracking for a custom blog's update status
 */
export interface CustomBlogState {
  feedUrl: string;
  title: string;
  lastKnownPostDate: number | null; // Timestamp (ms) of last known newest post
  currentPostDate: number | null; // Timestamp (ms) of current newest post (after check)
  lastCheckedAt: number | null; // Timestamp (ms) when last checked
  hasUpdates: boolean; // True if currentPostDate > lastKnownPostDate
  lastError?: string;
  errorCount: number;
}

/**
 * Overall state for custom blog update checking
 */
export interface CustomBlogUpdatesState {
  status: 'idle' | 'checking' | 'success' | 'error';
  blogs: CustomBlogState[];
  updatedCount: number; // Number of blogs with new posts
  totalCount: number; // Total custom blogs
  lastCheckedAt: number | null;
  lastSyncAt: number | null;
  error?: string;
}

/**
 * Message from web app to extension - Sync all blogs (directory + community + custom)
 */
export interface SyncAllBlogsRequest {
  type: 'SYNC_ALL_BLOGS';
  directoryBlogs: DirectoryBlogSyncData[] | string[]; // directory_blog_id values with titles (or legacy string[] for backward compat)
  communityBlogs: CommunityBlogSyncData[]; // community_blog_id values with titles
  customBlogs: CustomBlogSyncData[];
  followedFeedUrls: string[]; // All followed feed URLs for duplicate detection
  lastVisit: number | null; // Timestamp (ms) of last visit
}

/**
 * Message from popup to service worker - Get custom blog updates state
 */
export interface GetCustomBlogUpdatesRequest {
  type: 'GET_CUSTOM_BLOG_UPDATES';
}

/**
 * Message from service worker to popup - Custom blog updates state response
 */
export interface GetCustomBlogUpdatesResponse {
  type: 'CUSTOM_BLOG_UPDATES_RESPONSE';
  state: CustomBlogUpdatesState | null;
}

/**
 * Message from popup to service worker - Force check for custom blog updates
 */
export interface ForceCheckCustomBlogUpdatesRequest {
  type: 'FORCE_CHECK_CUSTOM_BLOG_UPDATES';
}

/**
 * Message from service worker to popup - Force check response
 */
export interface ForceCheckCustomBlogUpdatesResponse {
  type: 'FORCE_CHECK_CUSTOM_BLOG_UPDATES_RESPONSE';
  success: boolean;
  error?: string;
}

// Settings messages
export interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}

export interface GetSettingsResponse {
  type: 'SETTINGS_RESPONSE';
  settings: ExtensionSettings;
}

export interface UpdateSettingsRequest {
  type: 'UPDATE_SETTINGS';
  settings: Partial<ExtensionSettings>;
}

export interface UpdateSettingsResponse {
  type: 'UPDATE_SETTINGS_RESPONSE';
  success: boolean;
  settings: ExtensionSettings;
}

export interface ClearDataRequest {
  type: 'CLEAR_DATA';
  dataType: 'queue' | 'stats' | 'all';
}

export interface ClearDataResponse {
  type: 'CLEAR_DATA_RESPONSE';
  success: boolean;
}

// ============================================
// Feed Discovery Messages
// ============================================

/**
 * Discovered feed from a blog URL
 */
export interface DiscoveredFeed {
  url: string;
  title?: string;
  type: 'rss' | 'atom' | 'unknown';
}

/**
 * Message from web app to extension - Discover feeds from a blog URL
 */
export interface DiscoverFeedsRequest {
  type: 'DISCOVER_FEEDS';
  blogUrl: string;
  requestId: string;
}

/**
 * Message from extension to web app - Discovered feeds response
 */
export interface DiscoverFeedsResponse {
  type: 'DISCOVER_FEEDS_RESPONSE';
  requestId: string;
  success: boolean;
  feeds?: DiscoveredFeed[];
  error?: string;
}

// ============================================
// Blog Status Testing Messages
// ============================================

/**
 * Blog status test results
 */
export interface BlogStatusTestResult {
  requiresProxy: boolean | null;
  hasFullContent: boolean | null;
  postsRequireProxy: boolean | null;
  blocksIframe: boolean | null;
  errors: string[];
  details?: {
    feedCors?: { corsHeader: string | null; statusCode?: number };
    postCors?: { corsHeader: string | null; testedUrl: string | null; statusCode?: number };
    iframe?: { xFrameOptions: string | null; cspFrameAncestors: string | null; testedUrl: string | null; statusCode?: number };
  };
}

/**
 * Message from web app to extension - Test blog status values
 */
export interface TestBlogStatusRequest {
  type: 'TEST_BLOG_STATUS';
  feedUrl: string;
  requestId: string;
}

/**
 * Message from extension to web app - Blog status test response
 */
export interface TestBlogStatusResponse {
  type: 'TEST_BLOG_STATUS_RESPONSE';
  requestId: string;
  success: boolean;
  result?: BlogStatusTestResult;
  error?: string;
}

// ============================================
// Unified Update State Query Messages (for web app integration)
// ============================================

/**
 * Summary of update state for a catalog source
 */
export interface CatalogSourceUpdateSummary {
  updatedCount: number;
  followedCount: number;
  lastCheckedAt: number | null;
  isEnabled: boolean;
  status: 'idle' | 'checking' | 'success' | 'error' | 'disabled';
}

/**
 * Summary of custom blog update state
 */
export interface CustomBlogUpdateSummary {
  updatedCount: number;
  totalCount: number;
  lastCheckedAt: number | null;
  blogs: Array<{
    feedUrl: string;
    title: string;
    hasUpdates: boolean;
  }>;
}

/**
 * Combined update state for all sources
 */
export interface CombinedUpdateState {
  directory: CatalogSourceUpdateSummary | null;
  community: CatalogSourceUpdateSummary | null;
  custom: CustomBlogUpdateSummary | null;
  mode: ExtensionMode;
  totalUpdatedCount: number;
}

/**
 * Message from web app to extension - Get combined update state
 * This allows the web app to query extension's cached update state
 * instead of making redundant API calls
 */
export interface GetUpdateStateRequest {
  type: 'GET_UPDATE_STATE';
  requestId: string;
}

/**
 * Message from extension to web app - Combined update state response
 */
export interface GetUpdateStateResponse {
  type: 'UPDATE_STATE_RESPONSE';
  requestId: string;
  success: boolean;
  data?: CombinedUpdateState;
  error?: string;
}

// ============================================
// Update Acknowledgment Messages
// ============================================

/**
 * Message from web app to extension - Acknowledge user has seen updates
 * Clears the badge and resets update counts
 */
export interface AcknowledgeUpdatesRequest {
  type: 'ACKNOWLEDGE_UPDATES';
  requestId: string;
  /** Optional: acknowledge only specific sources. If not provided, acknowledges all. */
  sources?: Array<'directory' | 'community' | 'custom'>;
}

/**
 * Message from extension to web app - Acknowledgment response
 */
export interface AcknowledgeUpdatesResponse {
  type: 'ACKNOWLEDGE_UPDATES_RESPONSE';
  requestId: string;
  success: boolean;
  /** Number of updates that were acknowledged */
  acknowledgedCount?: number;
  error?: string;
}

// ============================================
// Feed Cache Types (for conditional GET support)
// ============================================

/**
 * Cached feed entry for conditional GET optimization
 */
export interface FeedCacheEntry {
  /** The feed URL */
  url: string;
  /** Hash of URL for storage key */
  urlHash: string;
  /** ETag header from response */
  etag: string | null;
  /** Last-Modified header from response */
  lastModified: string | null;
  /** The feed content */
  content: string;
  /** When the cache entry was created (ms) */
  cachedAt: number;
  /** When the cache entry expires (ms) */
  expiresAt: number;
  /** Size of content in bytes */
  size: number;
}

/**
 * Options for feed fetching with cache support
 */
export interface FetchFeedOptions {
  /** Skip cache and force fresh fetch */
  skipCache?: boolean;
  /** Custom timeout in ms */
  timeout?: number;
}

// Window augmentation for extension flags
declare global {
  interface Window {
    __BLOGS_ARE_BACK_EXTENSION__?: boolean;
    __BLOGS_ARE_BACK_EXTENSION_VERSION__?: string;
  }
}
