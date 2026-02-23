/**
 * Batch image discovery handler
 *
 * Discovers images (favicon and OG image) from multiple blog URLs concurrently.
 * Uses the existing discoverImagesFromUrl handler for individual discoveries.
 */

import { discoverImagesFromUrl } from './discover-images';
import { processBatchWithConcurrency } from '../utils/fetch';
import { getSettings } from '../storage/settings';
import type {
  DiscoverImagesBatchRequest,
  DiscoverImagesBatchResponse,
  BatchImageResult,
} from '../../utils/types';

// Default concurrency for image discovery (lower than feeds since it's I/O heavy)
const DEFAULT_IMAGE_BATCH_CONCURRENCY = 5;

/**
 * Discover images from multiple blog URLs concurrently
 *
 * @param request - Batch image discovery request
 * @returns Batch response with results for all URLs
 */
export async function discoverImagesBatch(
  request: DiscoverImagesBatchRequest
): Promise<DiscoverImagesBatchResponse> {
  const { blogUrls: rawBlogUrls, requestId, maxConcurrent } = request;

  // Deduplicate URLs to avoid discovering images for the same blog multiple times
  const blogUrls = [...new Set(rawBlogUrls)];

  if (blogUrls.length < rawBlogUrls.length) {
    console.log(
      `[Image Batch] Deduplicated ${rawBlogUrls.length} → ${blogUrls.length} URLs`
    );
  }

  console.log(
    `[Image Batch] Starting batch discovery for ${blogUrls.length} URLs (requestId: ${requestId})`
  );

  // Get user's concurrency settings (fall back to request param, then default)
  const settings = await getSettings();
  // Use lower concurrency for images since each discovery makes multiple requests
  const concurrency = maxConcurrent ?? Math.min(settings.maxConcurrentRequests ?? DEFAULT_IMAGE_BATCH_CONCURRENCY, DEFAULT_IMAGE_BATCH_CONCURRENCY);
  const delayMs = settings.requestDelayMs ?? 0;

  console.log(
    `[Image Batch] Using concurrency: ${concurrency}, delay: ${delayMs}ms`
  );

  let successCount = 0;
  let errorCount = 0;

  // Process URLs with concurrency control
  const imageResults = await processBatchWithConcurrency<string, BatchImageResult>(
    blogUrls,
    async (blogUrl) => {
      // Generate a unique sub-request ID for this URL
      const subRequestId = `${requestId}-${blogUrl.slice(-20)}`;

      try {
        const response = await discoverImagesFromUrl(blogUrl, subRequestId);

        const result: BatchImageResult = {
          blogUrl,
          success: response.success,
          images: response.images,
          error: response.error,
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
          blogUrl,
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

  console.log(
    `[Image Batch] Completed batch discovery: ${successCount} succeeded, ${errorCount} failed`
  );

  return {
    type: 'DISCOVER_IMAGES_BATCH_RESPONSE',
    requestId,
    success: errorCount === 0, // Overall success only if all discoveries succeeded
    results: imageResults,
    totalProcessed: blogUrls.length,
    successCount,
    errorCount,
  };
}
