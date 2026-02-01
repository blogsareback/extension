/**
 * Image discovery handler
 *
 * Discovers site icon (favicon) and OG image from a blog URL.
 * Used by the web app for OPML imports and bulk blog additions.
 */

import { parseHTML } from 'linkedom';
import { isValidFeedUrl } from '../../utils/security';
import { fetchWithRetry, categorizeError } from '../utils/fetch';
import { FETCH_TIMEOUT, USER_AGENT, MAX_CONTENT_SIZE } from '../utils/constants';
import type { DiscoverImagesResponse, DiscoveredImages } from '../../utils/types';

// Common favicon paths to try if not found in HTML
const FAVICON_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
];

/**
 * Resolve a potentially relative URL to an absolute URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Parse HTML to extract site icon and OG image
 */
function parseImagesFromHTML(html: string, baseUrl: string): DiscoveredImages {
  const images: DiscoveredImages = {};

  try {
    const { document } = parseHTML(html);

    // Find OG image
    const ogImageMeta = document.querySelector('meta[property="og:image"]');
    if (ogImageMeta) {
      const content = ogImageMeta.getAttribute('content');
      if (content) {
        images.ogImage = resolveUrl(content, baseUrl);
      }
    }

    // Fall back to twitter:image if no og:image
    if (!images.ogImage) {
      const twitterImageMeta = document.querySelector('meta[name="twitter:image"]');
      if (twitterImageMeta) {
        const content = twitterImageMeta.getAttribute('content');
        if (content) {
          images.ogImage = resolveUrl(content, baseUrl);
        }
      }
    }

    // Find favicon from link tags (in priority order)
    const iconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
    ];

    for (const selector of iconSelectors) {
      const link = document.querySelector(selector);
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          images.siteIcon = resolveUrl(href, baseUrl);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[Image Discovery] Error parsing HTML:', error);
  }

  return images;
}

/**
 * Check if a URL returns a valid image via HEAD request
 */
async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    return response.ok && !!contentType && contentType.startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * Try common favicon paths for a given domain
 */
async function checkCommonFaviconPaths(baseUrl: string): Promise<string | undefined> {
  try {
    const url = new URL(baseUrl);
    const origin = url.origin;

    // Try common paths sequentially (not parallel to avoid rate limiting)
    for (const path of FAVICON_PATHS) {
      const faviconUrl = origin + path;
      const isValid = await isValidImageUrl(faviconUrl);
      if (isValid) {
        return faviconUrl;
      }
    }
  } catch (error) {
    console.warn('[Image Discovery] Error checking favicon paths:', error);
  }

  return undefined;
}

/**
 * Discover images (favicon and OG image) from a blog URL
 */
export async function discoverImagesFromUrl(
  blogUrl: string,
  requestId: string
): Promise<DiscoverImagesResponse> {
  // 1. Validate URL (SSRF check)
  if (!isValidFeedUrl(blogUrl)) {
    console.error('[Image Discovery] Invalid or blocked URL:', blogUrl);
    return {
      type: 'DISCOVER_IMAGES_RESPONSE',
      requestId,
      success: false,
      error: 'Invalid or blocked URL',
    };
  }

  try {
    console.log('[Image Discovery] Discovering images from:', blogUrl);

    // 2. Fetch the page HTML
    const response = await fetchWithRetry(
      blogUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      },
      FETCH_TIMEOUT
    );

    // 3. Validate final URL after redirects (SSRF check)
    if (!isValidFeedUrl(response.url)) {
      console.error('[Image Discovery] Redirect to blocked URL:', response.url);
      return {
        type: 'DISCOVER_IMAGES_RESPONSE',
        requestId,
        success: false,
        error: 'Redirect to blocked URL',
      };
    }

    // 4. Get response as text
    const html = await response.text();

    // 5. Check size
    const htmlSize = new Blob([html]).size;
    if (htmlSize > MAX_CONTENT_SIZE) {
      console.warn(`[Image Discovery] Content too large (${htmlSize} bytes) for: ${blogUrl}`);
      return {
        type: 'DISCOVER_IMAGES_RESPONSE',
        requestId,
        success: false,
        error: 'Page too large',
      };
    }

    console.log(`[Image Discovery] Downloaded HTML (${htmlSize} bytes) from: ${blogUrl}`);

    // 6. Parse HTML for images
    const images = parseImagesFromHTML(html, response.url);

    // 7. If no favicon found in HTML, try common paths
    if (!images.siteIcon) {
      console.log('[Image Discovery] No favicon in HTML, trying common paths...');
      const faviconFromCommonPaths = await checkCommonFaviconPaths(response.url);
      if (faviconFromCommonPaths) {
        images.siteIcon = faviconFromCommonPaths;
      }
    }

    console.log('[Image Discovery] Discovered images:', {
      siteIcon: images.siteIcon ? 'found' : 'not found',
      ogImage: images.ogImage ? 'found' : 'not found',
    });

    return {
      type: 'DISCOVER_IMAGES_RESPONSE',
      requestId,
      success: true,
      images,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error('[Image Discovery] Error:', categorized.message, error);

    return {
      type: 'DISCOVER_IMAGES_RESPONSE',
      requestId,
      success: false,
      error: `Failed to discover images: ${categorized.message}`,
    };
  }
}
