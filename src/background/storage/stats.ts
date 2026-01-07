/**
 * Statistics storage and management
 *
 * Tracks per-operation statistics for:
 * - Feed fetching (FETCH_FEED)
 * - Page fetching (FETCH_PAGE)
 * - Readable text extraction (EXTRACT_READABLE_TEXT)
 * - Readable HTML extraction (EXTRACT_READABLE_HTML)
 */

import browser from '../../utils/browser';
import { STORAGE_KEY_STATS } from '../utils/constants';
import type {
  FetchStats,
  LegacyFetchStats,
  OperationType,
  OperationStats,
  ErrorCategory,
} from '../../utils/types';

/** Maximum operations to include in rolling average */
const MAX_RESPONSE_TIME_SAMPLES = 100;

/**
 * Create empty stats for a single operation type
 */
function createEmptyOperationStats(): OperationStats {
  return {
    total: 0,
    success: 0,
    errors: 0,
    errorsByCategory: {
      network: 0,
      timeout: 0,
      server: 0,
      client: 0,
      validation: 0,
    },
  };
}

/**
 * Create empty stats structure
 */
export function createEmptyStats(): FetchStats {
  return {
    version: 2,
    operations: {
      feedFetch: createEmptyOperationStats(),
      pageFetch: createEmptyOperationStats(),
      readableText: createEmptyOperationStats(),
      readableHtml: createEmptyOperationStats(),
    },
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Migrate legacy stats to new format
 */
function migrateLegacyStats(legacy: LegacyFetchStats): FetchStats {
  const stats = createEmptyStats();

  // Put all legacy stats into feedFetch since that was the primary use
  stats.operations.feedFetch.total = legacy.totalFetches;
  stats.operations.feedFetch.success = legacy.totalFetches - legacy.errors;
  stats.operations.feedFetch.errors = legacy.errors;

  // Assume all legacy errors were network errors (most common)
  stats.operations.feedFetch.errorsByCategory.network = legacy.errors;

  // Migrate last fetch if present
  if (legacy.lastFetch) {
    stats.operations.feedFetch.lastOperation = {
      url: legacy.lastFetch.url,
      timestamp: legacy.lastFetch.timestamp,
      success: legacy.lastFetch.success,
    };
  }

  return stats;
}

/**
 * Check if stats object is legacy format
 */
function isLegacyStats(stats: unknown): stats is LegacyFetchStats {
  if (!stats || typeof stats !== 'object') return false;
  const obj = stats as Record<string, unknown>;
  return 'totalFetches' in obj && !('version' in obj);
}

/**
 * Get current stats from storage, migrating if necessary
 */
export async function getStats(): Promise<FetchStats> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_STATS);
    const stored = result[STORAGE_KEY_STATS];

    if (!stored) {
      return createEmptyStats();
    }

    // Migrate legacy format
    if (isLegacyStats(stored)) {
      console.log('[Service Worker] Migrating legacy stats to v2 format');
      const migrated = migrateLegacyStats(stored);
      await browser.storage.local.set({ [STORAGE_KEY_STATS]: migrated });
      return migrated;
    }

    return stored as FetchStats;
  } catch (error) {
    console.error('[Service Worker] Failed to get stats:', error);
    return createEmptyStats();
  }
}

/**
 * Parameters for updating statistics
 */
export interface UpdateStatsParams {
  /** The type of operation being tracked */
  operationType: OperationType;
  /** The URL that was fetched */
  url: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error category if the operation failed */
  errorCategory?: ErrorCategory;
  /** Error message if the operation failed */
  errorMessage?: string;
  /** Response time in milliseconds */
  responseTimeMs?: number;
}

/**
 * Update statistics for an operation
 *
 * This should only be called for operations triggered by the web app,
 * not for background feed discovery or other extension-internal operations.
 */
export async function updateStats(params: UpdateStatsParams): Promise<void> {
  const {
    operationType,
    url,
    success,
    errorCategory,
    errorMessage,
    responseTimeMs,
  } = params;

  try {
    const stats = await getStats();
    const opStats = stats.operations[operationType];

    // Update counts
    opStats.total += 1;
    if (success) {
      opStats.success += 1;
    } else {
      opStats.errors += 1;
      if (errorCategory) {
        opStats.errorsByCategory[errorCategory] += 1;
      }
    }

    // Update last operation
    opStats.lastOperation = {
      url,
      timestamp: Date.now(),
      success,
      ...(errorCategory && { errorCategory }),
      ...(errorMessage && { errorMessage }),
      ...(responseTimeMs !== undefined && { responseTimeMs }),
    };

    // Update rolling average response time
    if (responseTimeMs !== undefined) {
      const currentSum = opStats._responseTimeSum || 0;
      const currentCount = opStats._responseTimeCount || 0;

      if (currentCount < MAX_RESPONSE_TIME_SAMPLES) {
        // Still building up samples
        opStats._responseTimeSum = currentSum + responseTimeMs;
        opStats._responseTimeCount = currentCount + 1;
        opStats.avgResponseTimeMs =
          opStats._responseTimeSum / opStats._responseTimeCount;
      } else {
        // Rolling average - remove oldest (approximate by current avg) and add new
        const oldAvg = opStats.avgResponseTimeMs || 0;
        opStats._responseTimeSum =
          currentSum - oldAvg + responseTimeMs;
        opStats.avgResponseTimeMs =
          opStats._responseTimeSum / MAX_RESPONSE_TIME_SAMPLES;
      }
    }

    // Update global timestamp
    stats.lastUpdatedAt = Date.now();

    await browser.storage.local.set({ [STORAGE_KEY_STATS]: stats });
  } catch (error) {
    console.error('[Service Worker] Failed to update stats:', error);
  }
}

/**
 * Get aggregate statistics across all operation types
 */
export function getAggregateStats(stats: FetchStats): {
  total: number;
  success: number;
  errors: number;
  successRate: number;
} {
  let total = 0;
  let success = 0;
  let errors = 0;

  for (const opType of Object.keys(stats.operations) as OperationType[]) {
    const op = stats.operations[opType];
    total += op.total;
    success += op.success;
    errors += op.errors;
  }

  const successRate = total > 0 ? (success / total) * 100 : 0;

  return { total, success, errors, successRate };
}

/**
 * Get human-readable label for operation type
 */
export function getOperationLabel(type: OperationType): string {
  switch (type) {
    case 'feedFetch':
      return 'Feed Fetches';
    case 'pageFetch':
      return 'Page Fetches';
    case 'readableText':
      return 'Text Extractions';
    case 'readableHtml':
      return 'HTML Extractions';
    default:
      return type;
  }
}

/**
 * Get human-readable label for error category
 */
export function getErrorCategoryLabel(category: ErrorCategory): string {
  switch (category) {
    case 'network':
      return 'Network';
    case 'timeout':
      return 'Timeout';
    case 'server':
      return 'Server (5xx)';
    case 'client':
      return 'Client (4xx)';
    case 'validation':
      return 'Validation';
    default:
      return category;
  }
}
