/**
 * Batch feed fetching handler
 *
 * Fetches multiple feeds concurrently with configurable concurrency limits.
 * Uses the existing fetchFeed handler for individual fetches to maintain
 * consistent caching, validation, and error handling.
 */

import { fetchFeed } from './feed-fetch';
import { processBatchWithConcurrency } from '../utils/fetch';
import { getSettings } from '../storage/settings';
import type {
  FetchFeedsBatchRequest,
  FetchFeedsBatchResponse,
  BatchFeedResult,
  BatchFeedItem,
} from '../../utils/types';

// Default concurrency for batch operations
const DEFAULT_BATCH_CONCURRENCY = 10;

/**
 * Fetch multiple feeds concurrently
 *
 * @param request - Batch feed fetch request
 * @returns Batch response with results for all feeds
 */
export async function fetchFeedsBatch(
  request: FetchFeedsBatchRequest
): Promise<FetchFeedsBatchResponse> {
  const { feeds, requestId, maxConcurrent } = request;

  console.log(
    `[Feed Batch] Starting batch fetch of ${feeds.length} feeds (requestId: ${requestId})`
  );

  // Get user's concurrency settings (fall back to request param, then default)
  const settings = await getSettings();
  const concurrency = maxConcurrent ?? settings.maxConcurrentRequests ?? DEFAULT_BATCH_CONCURRENCY;
  const delayMs = settings.requestDelayMs ?? 0;

  console.log(
    `[Feed Batch] Using concurrency: ${concurrency}, delay: ${delayMs}ms`
  );

  const results: BatchFeedResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Process feeds with concurrency control
  const feedResults = await processBatchWithConcurrency<BatchFeedItem, BatchFeedResult>(
    feeds,
    async (feedItem) => {
      // Generate a unique sub-request ID for this feed
      const subRequestId = `${requestId}-${feedItem.feedUrl.slice(-20)}`;

      try {
        const response = await fetchFeed(feedItem.feedUrl, subRequestId);

        const result: BatchFeedResult = {
          feedUrl: feedItem.feedUrl,
          success: response.success,
          data: response.data,
          error: response.error,
          status: response.status,
        };

        if (response.success) {
          successCount++;
        } else {
          errorCount++;
        }

        return result;
      } catch (error) {
        errorCount++;
        return {
          feedUrl: feedItem.feedUrl,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      maxConcurrent: concurrency,
      delayMs: delayMs,
    }
  );

  // Collect all results
  results.push(...feedResults);

  console.log(
    `[Feed Batch] Completed batch fetch: ${successCount} succeeded, ${errorCount} failed`
  );

  return {
    type: 'FEEDS_BATCH_RESPONSE',
    requestId,
    success: errorCount === 0, // Overall success only if all feeds succeeded
    results,
    totalProcessed: feeds.length,
    successCount,
    errorCount,
  };
}
