/**
 * Fetch utilities with retry logic and error handling
 */

import { FETCH_TIMEOUT, MAX_RETRIES, INITIAL_RETRY_DELAY } from './constants';

// Error types that should trigger a retry
export type FetchErrorType = 'network' | 'timeout' | 'server' | 'client' | 'validation';

export interface FetchError {
  type: FetchErrorType;
  message: string;
  retryable: boolean;
  status?: number;
}

/**
 * Normalize a URL for comparison by removing trailing slashes and lowercasing
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.href.toLowerCase();
  } catch {
    // If URL parsing fails, just lowercase and remove trailing slashes
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Categorize an error for better handling and retry decisions
 */
export function categorizeError(error: unknown, response?: Response): FetchError {
  // Network/timeout errors
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        type: 'timeout',
        message: `Network timeout after ${FETCH_TIMEOUT / 1000}s`,
        retryable: true,
      };
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        type: 'network',
        message: 'Network error - unable to connect',
        retryable: true,
      };
    }
  }

  // HTTP status errors
  if (response) {
    const status = response.status;
    if (status >= 500) {
      return {
        type: 'server',
        message: `Server error (${status})`,
        retryable: true,
        status,
      };
    }
    if (status >= 400) {
      return {
        type: 'client',
        message: `Client error (${status})`,
        retryable: false,
        status,
      };
    }
  }

  // Unknown error
  return {
    type: 'network',
    message: error instanceof Error ? error.message : 'Unknown error',
    retryable: true,
  };
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic and exponential backoff
 * Only retries on network errors, timeouts, and server errors (5xx)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  let lastError: FetchError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for server errors that might be retryable
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const error = categorizeError(null, response);
        console.warn(
          `[Service Worker] Server error on attempt ${attempt + 1}/${MAX_RETRIES + 1}: ${error.message}`
        );
        lastError = error;
        await sleep(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      const categorized = categorizeError(error);
      lastError = categorized;

      // Only retry on retryable errors
      if (!categorized.retryable || attempt >= MAX_RETRIES) {
        throw error;
      }

      console.warn(
        `[Service Worker] Retrying after ${categorized.type} error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${categorized.message}`
      );

      // Exponential backoff: 1s, 2s, 4s
      await sleep(INITIAL_RETRY_DELAY * Math.pow(2, attempt));
    }
  }

  // This should never happen, but TypeScript needs it
  throw new Error(lastError?.message || 'Max retries exceeded');
}

/**
 * Process items in batches with concurrency limit and optional delay
 */
export async function processBatchWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { maxConcurrent: number; delayMs: number }
): Promise<R[]> {
  const { maxConcurrent, delayMs } = options;
  const results: R[] = [];
  let activePromises: Promise<void>[] = [];
  let index = 0;

  const processNext = async (): Promise<void> => {
    if (index >= items.length) return;

    const currentIndex = index++;
    const item = items[currentIndex];

    // Add delay if configured and not the first item
    if (delayMs > 0 && currentIndex > 0) {
      await sleep(delayMs);
    }

    try {
      const result = await processor(item);
      results[currentIndex] = result;
    } catch (error) {
      // Re-throw to be handled by caller
      throw error;
    }
  };

  // Process items with concurrency limit
  while (index < items.length || activePromises.length > 0) {
    // Start new tasks up to the concurrency limit
    while (activePromises.length < maxConcurrent && index < items.length) {
      const promise = processNext().finally(() => {
        activePromises = activePromises.filter(p => p !== promise);
      });
      activePromises.push(promise);
    }

    // Wait for at least one to complete
    if (activePromises.length > 0) {
      await Promise.race(activePromises);
    }
  }

  return results;
}
