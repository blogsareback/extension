import browser from '../utils/browser';
import type {
  FetchFeedRequest,
  FeedResponse,
  FetchFeedsBatchRequest,
  FetchFeedsBatchResponse,
  FetchPageRequest,
  FetchPageResponse,
  ExtractReadableTextRequest,
  ReadableTextResponse,
  ExtractReadableHtmlRequest,
  ReadableHtmlResponse,
  SubscribeToFeedRequest,
  QueuedSubscription,
  SyncFollowedBlogsRequest,
  SyncAllBlogsRequest,
  DiscoverFeedsRequest,
  DiscoverFeedsResponse,
  DiscoverImagesRequest,
  DiscoverImagesResponse,
  DiscoverImagesBatchRequest,
  DiscoverImagesBatchResponse,
  TestBlogStatusRequest,
  TestBlogStatusResponse,
  GetAnalyticsRequest,
  GetAnalyticsResponse,
  AcknowledgeUpdatesRequest,
  AcknowledgeUpdatesResponse,
  SavePostOfflineRequest,
  SavePostOfflineResponse,
  IsPostSavedRequest,
  IsPostSavedResponse,
  DeleteSavedPostRequest,
  DeleteSavedPostResponse,
  GetSavedPostsCountRequest,
  SavedPostsCountResponse,
  ReextractSavedPostRequest,
  ReextractSavedPostResponse,
  GetAllSavedPostGuidsRequest,
  AllSavedPostGuidsResponse,
  GetSavedPostsIndexRequest,
  SavedPostsIndexResponse,
  GetSavedPostContentRequest,
  SavedPostContentResponse,
  SaveByUrlRequest,
  SaveByUrlResponse,
} from '../utils/types';
// Version injected at build time from package.json (see vite.config.ts)
const EXTENSION_VERSION = __EXTENSION_VERSION__;

// Inject script into page context so webapp can detect the extension
// Using browser.runtime.getURL to get the proper extension URL
const script = document.createElement('script');
script.src = browser.runtime.getURL('injected-script.js');
script.onload = () => {
  script.remove(); // Clean up after injection
};
(document.head || document.documentElement).appendChild(script);

// Unsure if the code below should work or the code above
// Set extension flags on window
window.__BLOGS_ARE_BACK_EXTENSION__ = true;
window.__BLOGS_ARE_BACK_EXTENSION_VERSION__ = EXTENSION_VERSION;

console.log(
  `[Content Script] Blogs Are Back extension v${EXTENSION_VERSION} loaded`
);

/**
 * Listen for messages from the web app
 */
window.addEventListener('message', (event: MessageEvent) => {
  // Security: Only accept messages from same origin
  if (event.origin !== window.location.origin) {
    return;
  }

  const message = event.data;
  if (typeof message !== 'object' || message === null || !message.type) {
    return;
  }

  // Handle feed fetch requests
  if (message.type === 'FETCH_FEED') {
    const request = message as FetchFeedRequest;

    console.log(
      '[Content Script] Received fetch request from web app:',
      request.requestId,
      request.feedUrl
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as FeedResponse;
        console.log(
          '[Content Script] Received response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'FEED_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as FeedResponse,
          window.location.origin
        );
      });
  }

  // Handle batch feed fetch requests
  if (message.type === 'FETCH_FEEDS_BATCH') {
    const request = message as FetchFeedsBatchRequest;

    console.log(
      '[Content Script] Received batch feed fetch request from web app:',
      request.requestId,
      request.feeds.length,
      'feeds'
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as FetchFeedsBatchResponse;
        console.log(
          '[Content Script] Received batch feed response from service worker:',
          response.requestId,
          response.successCount,
          '/',
          response.totalProcessed
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'FEEDS_BATCH_RESPONSE',
            requestId: request.requestId,
            success: false,
            results: [],
            totalProcessed: 0,
            successCount: 0,
            errorCount: request.feeds.length,
            error: 'Extension context invalid. Please reload the page.',
          } as FetchFeedsBatchResponse,
          window.location.origin
        );
      });
  }

  // Handle page fetch requests (raw HTML, no extraction)
  if (message.type === 'FETCH_PAGE') {
    const request = message as FetchPageRequest;

    console.log(
      '[Content Script] Received page fetch request from web app:',
      request.requestId,
      request.url
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as FetchPageResponse;
        console.log(
          '[Content Script] Received page response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'PAGE_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as FetchPageResponse,
          window.location.origin
        );
      });
  }

  // Handle readable text extraction requests
  if (message.type === 'EXTRACT_READABLE_TEXT') {
    const request = message as ExtractReadableTextRequest;

    console.log(
      '[Content Script] Received readable text extraction request from web app:',
      request.requestId,
      request.url
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as ReadableTextResponse;
        console.log(
          '[Content Script] Received readable text response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'READABLE_TEXT_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as ReadableTextResponse,
          window.location.origin
        );
      });
  }

  // Handle readable HTML extraction requests
  if (message.type === 'EXTRACT_READABLE_HTML') {
    const request = message as ExtractReadableHtmlRequest;

    console.log(
      '[Content Script] Received readable HTML extraction request from web app:',
      request.requestId,
      request.url
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as ReadableHtmlResponse;
        console.log(
          '[Content Script] Received readable HTML response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'READABLE_HTML_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as ReadableHtmlResponse,
          window.location.origin
        );
      });
  }

  // Handle followed blogs sync from web app (legacy - directory blogs only)
  // Extension will call the API directly to check for updates
  if (message.type === 'SYNC_FOLLOWED_BLOGS') {
    const request = message as SyncFollowedBlogsRequest;

    console.log(
      '[Content Script] Received followed blogs sync from web app:',
      request.blogIds.length,
      'directory blogs'
    );

    // Forward to service worker (which will check API directly)
    browser.runtime.sendMessage(request).catch((error: Error) => {
      console.error('[Content Script] Extension context invalid:', error);
    });
  }

  // Handle all blogs sync from web app (new - both directory and custom blogs)
  if (message.type === 'SYNC_ALL_BLOGS') {
    const request = message as SyncAllBlogsRequest;

    console.log(
      '[Content Script] Received all blogs sync from web app:',
      request.directoryBlogs.length,
      'directory blogs,',
      request.customBlogs.length,
      'custom blogs'
    );

    // Forward to service worker
    browser.runtime.sendMessage(request).catch((error: Error) => {
      console.error('[Content Script] Extension context invalid:', error);
    });
  }

  // Handle feed discovery requests from web app
  if (message.type === 'DISCOVER_FEEDS') {
    const request = message as DiscoverFeedsRequest;

    console.log(
      '[Content Script] Received feed discovery request from web app:',
      request.requestId,
      request.blogUrl
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as DiscoverFeedsResponse;
        console.log(
          '[Content Script] Received feed discovery response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'DISCOVER_FEEDS_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as DiscoverFeedsResponse,
          window.location.origin
        );
      });
  }

  // Handle image discovery requests from web app
  if (message.type === 'DISCOVER_IMAGES') {
    const request = message as DiscoverImagesRequest;

    console.log(
      '[Content Script] Received image discovery request from web app:',
      request.requestId,
      request.blogUrl
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as DiscoverImagesResponse;
        console.log(
          '[Content Script] Received image discovery response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'DISCOVER_IMAGES_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as DiscoverImagesResponse,
          window.location.origin
        );
      });
  }

  // Handle batch image discovery requests from web app
  if (message.type === 'DISCOVER_IMAGES_BATCH') {
    const request = message as DiscoverImagesBatchRequest;

    console.log(
      '[Content Script] Received batch image discovery request from web app:',
      request.requestId,
      request.blogUrls.length,
      'blogs'
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as DiscoverImagesBatchResponse;
        console.log(
          '[Content Script] Received batch image discovery response from service worker:',
          response.requestId,
          response.successCount,
          '/',
          response.totalProcessed
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'DISCOVER_IMAGES_BATCH_RESPONSE',
            requestId: request.requestId,
            success: false,
            results: [],
            totalProcessed: 0,
            successCount: 0,
            errorCount: request.blogUrls.length,
            error: 'Extension context invalid. Please reload the page.',
          } as DiscoverImagesBatchResponse,
          window.location.origin
        );
      });
  }

  // Handle blog status testing requests from web app
  if (message.type === 'TEST_BLOG_STATUS') {
    const request = message as TestBlogStatusRequest;

    console.log(
      '[Content Script] Received blog status test request from web app:',
      request.requestId,
      request.feedUrl
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as TestBlogStatusResponse;
        console.log(
          '[Content Script] Received blog status test response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'TEST_BLOG_STATUS_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as TestBlogStatusResponse,
          window.location.origin
        );
      });
  }

  // Handle analytics requests from web app
  if (message.type === 'GET_ANALYTICS') {
    const request = message as GetAnalyticsRequest;

    console.log(
      '[Content Script] Received analytics request from web app:',
      request.requestId
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as GetAnalyticsResponse;
        console.log(
          '[Content Script] Received analytics response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'ANALYTICS_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as GetAnalyticsResponse,
          window.location.origin
        );
      });
  }

  // Handle save post offline requests from web app
  if (message.type === 'SAVE_POST_OFFLINE') {
    const request = message as SavePostOfflineRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as SavePostOfflineResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'SAVE_POST_OFFLINE_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as SavePostOfflineResponse,
          window.location.origin
        );
      });
  }

  // Handle is post saved check from web app
  if (message.type === 'IS_POST_SAVED') {
    const request = message as IsPostSavedRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as IsPostSavedResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'IS_POST_SAVED_RESPONSE',
            requestId: request.requestId,
            success: false,
            isSaved: false,
            error: 'Extension context invalid. Please reload the page.',
          } as IsPostSavedResponse,
          window.location.origin
        );
      });
  }

  // Handle delete saved post from web app
  if (message.type === 'DELETE_SAVED_POST') {
    const request = message as DeleteSavedPostRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as DeleteSavedPostResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'DELETE_SAVED_POST_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as DeleteSavedPostResponse,
          window.location.origin
        );
      });
  }

  // Handle get saved posts count from web app
  if (message.type === 'GET_SAVED_POSTS_COUNT') {
    const request = message as GetSavedPostsCountRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as SavedPostsCountResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'SAVED_POSTS_COUNT_RESPONSE',
            requestId: request.requestId,
            success: false,
            count: 0,
            totalSizeBytes: 0,
            error: 'Extension context invalid. Please reload the page.',
          } as SavedPostsCountResponse,
          window.location.origin
        );
      });
  }

  // Handle re-extract saved post from web app
  if (message.type === 'REEXTRACT_SAVED_POST') {
    const request = message as ReextractSavedPostRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as ReextractSavedPostResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'REEXTRACT_SAVED_POST_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as ReextractSavedPostResponse,
          window.location.origin
        );
      });
  }

  // Handle get all saved post GUIDs from web app
  if (message.type === 'GET_ALL_SAVED_POST_GUIDS') {
    const request = message as GetAllSavedPostGuidsRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as AllSavedPostGuidsResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'ALL_SAVED_POST_GUIDS_RESPONSE',
            requestId: request.requestId,
            success: false,
            guids: [],
            error: 'Extension context invalid. Please reload the page.',
          } as AllSavedPostGuidsResponse,
          window.location.origin
        );
      });
  }

  // Handle get saved posts index from web app (v2.3.0+)
  if (message.type === 'GET_SAVED_POSTS_INDEX') {
    const request = message as GetSavedPostsIndexRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as SavedPostsIndexResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'SAVED_POSTS_INDEX_RESPONSE',
            requestId: request.requestId,
            success: false,
            posts: [],
            error: 'Extension context invalid. Please reload the page.',
          } as SavedPostsIndexResponse,
          window.location.origin
        );
      });
  }

  // Handle get saved post content from web app (v2.3.0+)
  if (message.type === 'GET_SAVED_POST_CONTENT') {
    const request = message as GetSavedPostContentRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as SavedPostContentResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'SAVED_POST_CONTENT_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as SavedPostContentResponse,
          window.location.origin
        );
      });
  }

  // Handle save by URL from web app (v2.3.0+)
  if (message.type === 'SAVE_BY_URL') {
    const request = message as SaveByUrlRequest;

    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as SaveByUrlResponse;
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        window.postMessage(
          {
            type: 'SAVE_BY_URL_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as SaveByUrlResponse,
          window.location.origin
        );
      });
  }

  // Handle acknowledge updates requests from web app
  // This clears the badge and resets update counts when user has seen updates
  if (message.type === 'ACKNOWLEDGE_UPDATES') {
    const request = message as AcknowledgeUpdatesRequest;

    console.log(
      '[Content Script] Received acknowledge updates request from web app:',
      request.requestId,
      request.sources
    );

    // Forward request to service worker (Promise-based API)
    browser.runtime
      .sendMessage(request)
      .then((rawResponse) => {
        const response = rawResponse as AcknowledgeUpdatesResponse;
        console.log(
          '[Content Script] Received acknowledge updates response from service worker:',
          response.requestId,
          response.success
        );

        // Forward response back to web app
        window.postMessage(response, window.location.origin);
      })
      .catch((error: Error) => {
        console.error('[Content Script] Extension context invalid:', error);

        // Send error response back to web app
        window.postMessage(
          {
            type: 'ACKNOWLEDGE_UPDATES_RESPONSE',
            requestId: request.requestId,
            success: false,
            error: 'Extension context invalid. Please reload the page.',
          } as AcknowledgeUpdatesResponse,
          window.location.origin
        );
      });
  }
});

const STORAGE_KEY_SUBSCRIPTION_QUEUE = 'subscriptionQueue';

/**
 * Send queued subscriptions to the web app
 * Uses CustomEvent on document for reliable cross-context communication
 * Does NOT clear the queue - waits for acknowledgment from web app
 */
async function sendQueuedSubscriptions(): Promise<void> {
  try {
    // Get queued subscriptions from storage
    const result = await browser.storage.local.get(
      STORAGE_KEY_SUBSCRIPTION_QUEUE
    );
    const queue: QueuedSubscription[] =
      (result[STORAGE_KEY_SUBSCRIPTION_QUEUE] as QueuedSubscription[] | undefined) || [];

    if (queue.length === 0) {
      console.log('[Content Script] No queued subscriptions to send');
      return;
    }

    console.log(
      `[Content Script] Found ${queue.length} queued subscription(s), sending to web app`
    );

    // Send all queued subscriptions to web app via CustomEvent
    // CustomEvent on document reliably crosses the content script boundary
    const message: SubscribeToFeedRequest = {
      type: 'SUBSCRIBE_TO_FEED',
      subscriptions: queue,
    };

    // Dispatch custom event on document (works across content script boundary)

    // We may want to remove the postMessage below and use this comment:
    //   Note: We only use CustomEvent (not postMessage) to avoid duplicate messages
    //   since the web app listens to both channels as a fallback strategy
    const event = new CustomEvent('bab-extension-subscriptions', {
      detail: message,
    });
    document.dispatchEvent(event);

    // Also try postMessage as fallback (some setups may prefer this)
    // (might be removed, depending on user experience with web app)
    window.postMessage(message, window.location.origin);

    // NOTE: Queue is NOT cleared here - we wait for acknowledgment from web app
    // This ensures the queue persists until user makes a decision
    console.log('[Content Script] Sent subscriptions (queue preserved until acknowledged)');
  } catch (error) {
    console.error(
      '[Content Script] Error sending queued subscriptions:',
      error
    );
  }
}

/**
 * Clear the subscription queue
 * Called when web app acknowledges the subscriptions (user made a decision)
 */
async function clearSubscriptionQueue(): Promise<void> {
  try {
    await browser.storage.local.set({
      [STORAGE_KEY_SUBSCRIPTION_QUEUE]: [],
    });
    console.log('[Content Script] Subscription queue cleared');
  } catch (error) {
    console.error('[Content Script] Error clearing subscription queue:', error);
  }
}

/**
 * Listen for subscription request from web app
 * The web app sends this event when it's ready to receive subscriptions
 */
document.addEventListener('bab-request-subscriptions', () => {
  console.log('[Content Script] Web app requested subscriptions');
  sendQueuedSubscriptions();
});

/**
 * Listen for acknowledgment from web app to clear the queue
 * The web app sends this when user has made a decision (add or cancel)
 */
document.addEventListener('bab-clear-subscription-queue', () => {
  console.log('[Content Script] Web app acknowledged, clearing queue');
  clearSubscriptionQueue();
});

/**
 * Listen for messages from the service worker
 * Used for real-time notifications when new subscriptions are queued
 */
browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type?: string }).type === 'SUBSCRIPTION_QUEUE_UPDATED'
  ) {
    console.log('[Content Script] Service worker notified: queue updated');
    // Send the updated queue to the web app
    sendQueuedSubscriptions();
  }
});
