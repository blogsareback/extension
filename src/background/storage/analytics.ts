/**
 * Analytics storage and management
 *
 * Tracks daily and aggregate statistics for web app reporting.
 * This is separate from the detailed stats shown in the popup.
 */

import browser from '../../utils/browser';
import {
  STORAGE_KEY_ANALYTICS,
  ANALYTICS_MAX_DAILY_RECORDS,
} from '../utils/constants';
import { EXTENSION_VERSION } from '../../utils/constants';
import type {
  AnalyticsData,
  AnalyticsSummary,
  DailyStats,
  DailyOperationCounts,
  OperationType,
  ErrorCategory,
} from '../../utils/types';

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Create empty operation counts
 */
function createEmptyOperationCounts(): DailyOperationCounts {
  return { total: 0, success: 0, errors: 0 };
}

/**
 * Create empty error category counts
 */
function createEmptyErrorCounts(): Record<ErrorCategory, number> {
  return {
    network: 0,
    timeout: 0,
    server: 0,
    client: 0,
    validation: 0,
  };
}

/**
 * Create empty daily stats for a given date
 */
function createEmptyDailyStats(date: string): DailyStats {
  return {
    date,
    operations: {
      feedFetch: createEmptyOperationCounts(),
      pageFetch: createEmptyOperationCounts(),
      readableText: createEmptyOperationCounts(),
      readableHtml: createEmptyOperationCounts(),
    },
    errorsByCategory: createEmptyErrorCounts(),
  };
}

/**
 * Create empty analytics data
 */
function createEmptyAnalytics(): AnalyticsData {
  return {
    version: 1,
    dailyStats: [],
    lifetime: {
      firstUseAt: Date.now(),
      daysActive: 0,
      operations: {
        feedFetch: createEmptyOperationCounts(),
        pageFetch: createEmptyOperationCounts(),
        readableText: createEmptyOperationCounts(),
        readableHtml: createEmptyOperationCounts(),
      },
      errorsByCategory: createEmptyErrorCounts(),
    },
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Get analytics data from storage
 */
export async function getAnalytics(): Promise<AnalyticsData> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_ANALYTICS);
    const stored = result[STORAGE_KEY_ANALYTICS];

    if (!stored) {
      return createEmptyAnalytics();
    }

    return stored as AnalyticsData;
  } catch (error) {
    console.error('[Service Worker] Failed to get analytics:', error);
    return createEmptyAnalytics();
  }
}

/**
 * Save analytics data to storage
 */
async function saveAnalytics(analytics: AnalyticsData): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEY_ANALYTICS]: analytics });
  } catch (error) {
    console.error('[Service Worker] Failed to save analytics:', error);
  }
}

/**
 * Update analytics when an operation is performed
 */
export async function updateAnalytics(params: {
  operationType: OperationType;
  success: boolean;
  errorCategory?: ErrorCategory;
}): Promise<void> {
  const { operationType, success, errorCategory } = params;
  const today = getTodayDate();

  try {
    const analytics = await getAnalytics();

    // Find or create today's stats
    let todayStats = analytics.dailyStats.find((d) => d.date === today);
    const isNewDay = !todayStats;

    if (!todayStats) {
      todayStats = createEmptyDailyStats(today);
      analytics.dailyStats.push(todayStats);

      // Sort by date descending
      analytics.dailyStats.sort((a, b) => b.date.localeCompare(a.date));

      // Trim to max records
      if (analytics.dailyStats.length > ANALYTICS_MAX_DAILY_RECORDS) {
        analytics.dailyStats = analytics.dailyStats.slice(
          0,
          ANALYTICS_MAX_DAILY_RECORDS
        );
      }
    }

    // Update daily stats
    const dailyOp = todayStats.operations[operationType];
    dailyOp.total += 1;
    if (success) {
      dailyOp.success += 1;
    } else {
      dailyOp.errors += 1;
      if (errorCategory) {
        todayStats.errorsByCategory[errorCategory] += 1;
      }
    }

    // Update lifetime stats
    const lifetimeOp = analytics.lifetime.operations[operationType];
    lifetimeOp.total += 1;
    if (success) {
      lifetimeOp.success += 1;
    } else {
      lifetimeOp.errors += 1;
      if (errorCategory) {
        analytics.lifetime.errorsByCategory[errorCategory] += 1;
      }
    }

    // Update days active if this is a new day
    if (isNewDay) {
      analytics.lifetime.daysActive += 1;
    }

    analytics.lastUpdatedAt = Date.now();

    await saveAnalytics(analytics);
  } catch (error) {
    console.error('[Service Worker] Failed to update analytics:', error);
  }
}

/**
 * Calculate summary for a date range
 */
function calculatePeriodSummary(
  dailyStats: DailyStats[],
  startDate: string
): {
  totalOperations: number;
  successRate: number;
  operationBreakdown: Record<OperationType, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  daysActive: number;
} {
  const operationTypes: OperationType[] = [
    'feedFetch',
    'pageFetch',
    'readableText',
    'readableHtml',
  ];

  const relevantDays = dailyStats.filter((d) => d.date >= startDate);
  let totalOps = 0;
  let totalSuccess = 0;
  const operationBreakdown: Record<OperationType, number> = {
    feedFetch: 0,
    pageFetch: 0,
    readableText: 0,
    readableHtml: 0,
  };
  const errorsByCategory: Record<ErrorCategory, number> = createEmptyErrorCounts();

  for (const day of relevantDays) {
    for (const opType of operationTypes) {
      const op = day.operations[opType];
      totalOps += op.total;
      totalSuccess += op.success;
      operationBreakdown[opType] += op.total;
    }

    for (const [category, count] of Object.entries(day.errorsByCategory)) {
      errorsByCategory[category as ErrorCategory] += count;
    }
  }

  return {
    totalOperations: totalOps,
    successRate: totalOps > 0 ? (totalSuccess / totalOps) * 100 : 0,
    operationBreakdown,
    errorsByCategory,
    daysActive: relevantDays.filter((d) => {
      // Count days with at least one operation
      return Object.values(d.operations).some((op) => op.total > 0);
    }).length,
  };
}

/**
 * Get analytics summary for web app
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const analytics = await getAnalytics();
  const today = getTodayDate();
  const sevenDaysAgo = getDateDaysAgo(7);
  const thirtyDaysAgo = getDateDaysAgo(30);

  // Get today's stats
  const todayStats = analytics.dailyStats.find((d) => d.date === today);
  const todayOperationBreakdown: Record<OperationType, number> = {
    feedFetch: 0,
    pageFetch: 0,
    readableText: 0,
    readableHtml: 0,
  };

  let todayTotal = 0;
  let todaySuccess = 0;
  let todayErrors = 0;

  if (todayStats) {
    for (const [opType, counts] of Object.entries(todayStats.operations)) {
      todayTotal += counts.total;
      todaySuccess += counts.success;
      todayErrors += counts.errors;
      todayOperationBreakdown[opType as OperationType] = counts.total;
    }
  }

  // Calculate lifetime totals
  const lifetime = analytics.lifetime;
  let lifetimeTotal = 0;
  let lifetimeSuccess = 0;
  const lifetimeOperationBreakdown: Record<OperationType, number> = {
    feedFetch: 0,
    pageFetch: 0,
    readableText: 0,
    readableHtml: 0,
  };

  for (const [opType, counts] of Object.entries(lifetime.operations)) {
    lifetimeTotal += counts.total;
    lifetimeSuccess += counts.success;
    lifetimeOperationBreakdown[opType as OperationType] = counts.total;
  }

  return {
    extensionVersion: EXTENSION_VERSION,

    last7Days: calculatePeriodSummary(analytics.dailyStats, sevenDaysAgo),
    last30Days: calculatePeriodSummary(analytics.dailyStats, thirtyDaysAgo),

    lifetime: {
      firstUseAt: lifetime.firstUseAt,
      daysActive: lifetime.daysActive,
      totalOperations: lifetimeTotal,
      successRate: lifetimeTotal > 0 ? (lifetimeSuccess / lifetimeTotal) * 100 : 0,
      operationBreakdown: lifetimeOperationBreakdown,
    },

    today: {
      totalOperations: todayTotal,
      successCount: todaySuccess,
      errorCount: todayErrors,
      operationBreakdown: todayOperationBreakdown,
    },
  };
}
