import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import type { ReadableTextData, ReadableHtmlData } from './types';

/**
 * Extract text from HTML with proper spacing between elements
 * Prevents word concatenation by adding spaces after block-level elements
 *
 * Note: Uses regex-based extraction instead of DOM parsing for reliability
 * linkedom has issues parsing HTML fragments from Readability output
 */
export function extractTextWithSpacing(html: string, _baseUrl: string): string {
  // Use regex-based extraction - more reliable than DOM parsing for fragments
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
    .replace(/<br\s*\/?>/gi, ' ') // BR to space
    .replace(/<\/?(p|div|li|td|th|h[1-6]|blockquote|pre|article|section|header|footer|aside|nav)[^>]*>/gi, ' ') // Block elements to space
    .replace(/<[^>]+>/g, '') // Remove all other tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Decode common entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract metadata from document (og:image, twitter:image, etc.)
 */
export function extractMetadata(
  document: Document,
  property: string,
  attr: string = 'property'
): string | null {
  const element = document.querySelector(`meta[${attr}='${property}']`);
  return element?.getAttribute('content') || null;
}

/**
 * Get the best image URL from meta tags
 * Checks og:image first, then twitter:image as fallback
 * Resolves relative URLs to absolute URLs using the document's base URL
 */
export function extractImageUrl(document: Document, baseUrl: string): string | null {
  const ogImage = extractMetadata(document, 'og:image');
  if (ogImage) {
    // Resolve to absolute URL if needed
    const absoluteUrl = resolveUrl(ogImage, baseUrl);
    return absoluteUrl || ogImage; // Fallback to original if resolution fails
  }

  const twitterImage = extractMetadata(document, 'twitter:image', 'name');
  if (twitterImage) {
    // Resolve to absolute URL if needed
    const absoluteUrl = resolveUrl(twitterImage, baseUrl);
    return absoluteUrl || twitterImage; // Fallback to original if resolution fails
  }

  return null;
}

/**
 * Parse HTML and extract readable content using Mozilla Readability
 * Returns structured data with title, text content, and image
 */
export function parseReadableContent(
  html: string,
  url: string
): ReadableTextData | null {
  // IMPORTANT: linkedom doesn't respect the { url } option in service worker context
  // We need to explicitly inject a <base> tag to set the document's base URL
  const htmlWithBase = html.replace(
    /<head[^>]*>/i,
    (match) => `${match}<base href="${url}">`
  );

  const { document } = parseHTML(htmlWithBase, { url });
  const reader = new Readability(document);
  const article = reader.parse();

  // Extract image metadata (with absolute URL resolution)
  const image = extractImageUrl(document, url);

  if (article && article.content) {
    // Successfully parsed article
    const textContent = extractTextWithSpacing(article.content, url);
    return {
      title: article.title,
      textContent,
      image,
    };
  }

  // Fallback: extract text from body if Readability fails
  const bodyHtml = document.body?.innerHTML;
  const pageTitle = document.title || 'Unknown Title';

  if (bodyHtml) {
    const bodyText = extractTextWithSpacing(bodyHtml, url);
    return {
      title: pageTitle,
      textContent: bodyText,
      bodyHtml: bodyHtml,
      image,
    };
  }

  return null;
}

/**
 * Resolve a relative URL to an absolute URL using a base URL
 * Returns null if the URL cannot be resolved
 */
function resolveUrl(relativeUrl: string, baseUrl: string): string | null {
  try {
    const absoluteUrl = new URL(relativeUrl, baseUrl);
    return absoluteUrl.href;
  } catch (error) {
    console.warn(`[resolveUrl] Failed to resolve URL: ${relativeUrl}`, error);
    return null;
  }
}

/**
 * Clean HTML by removing unnecessary attributes while preserving structure
 * Keeps only essential attributes like src (for images) and href (for links)
 * Resolves all relative URLs to absolute URLs based on the page's base URL
 */
export function cleanHtmlAttributes(html: string, baseUrl: string): string {
  // Wrap the HTML fragment in a full document structure to ensure proper parsing
  const wrappedHtml = `<!DOCTYPE html><html><head></head><body>${html}</body></html>`;

  // console.log('[cleanHtmlAttributes] Base URL:', baseUrl);
  const { document } = parseHTML(wrappedHtml, { url: baseUrl });
  const body = document.body;

  if (!body) {
    console.error('[cleanHtmlAttributes] No body element found');
    return '';
  }

  // Walk through all elements and clean attributes
  const allElements = body.querySelectorAll('*');
  allElements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    // Save essential attributes before removing (resolve relative URLs to absolute)
    const essentialAttrs: Record<string, string> = {};

    if (tagName === 'img') {
      // For images, keep src and alt
      const srcAttr = element.getAttribute('src');
      const alt = element.getAttribute('alt');

      if (srcAttr) {
        // Use element.src property which should give resolved URL based on document's baseURI
        const resolvedSrc = (element as any).src;
        // console.log('[cleanHtmlAttributes] IMG - Raw src:', srcAttr, '| Resolved:', resolvedSrc, '| BaseURL:', baseUrl);

        // Fallback to manual resolution if element.src is not available or incorrect
        const absoluteSrc = resolvedSrc && resolvedSrc.startsWith('http')
          ? resolvedSrc
          : resolveUrl(srcAttr, baseUrl);

        if (absoluteSrc) {
          essentialAttrs.src = absoluteSrc;
        }
      }
      if (alt) {
        essentialAttrs.alt = alt;
      }
    } else if (tagName === 'a') {
      // For links, keep href
      const hrefAttr = element.getAttribute('href');

      if (hrefAttr) {
        // Use element.href property which should give resolved URL based on document's baseURI
        const resolvedHref = (element as any).href;
        // console.log('[cleanHtmlAttributes] A - Raw href:', hrefAttr, '| Resolved:', resolvedHref, '| BaseURL:', baseUrl);

        // Fallback to manual resolution if element.href is not available or incorrect
        const absoluteHref = resolvedHref && resolvedHref.startsWith('http')
          ? resolvedHref
          : resolveUrl(hrefAttr, baseUrl);

        if (absoluteHref) {
          essentialAttrs.href = absoluteHref;
        }
      }
    }

    // Remove all attributes
    const attributeNames = element.getAttributeNames();
    attributeNames.forEach((attr) => {
      element.removeAttribute(attr);
    });

    // Restore essential attributes (now with absolute URLs)
    Object.entries(essentialAttrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  });

  return body.innerHTML;
}

/**
 * Parse HTML and extract readable content as cleaned HTML using Mozilla Readability
 * Returns structured data with title, cleaned HTML content, and image
 */
export function parseReadableHtml(
  html: string,
  url: string
): ReadableHtmlData | null {
  // IMPORTANT: linkedom doesn't respect the { url } option in service worker context
  // We need to explicitly inject a <base> tag to set the document's base URL
  // This ensures all relative URLs are resolved against the correct page URL
  const htmlWithBase = html.replace(
    /<head[^>]*>/i,
    (match) => `${match}<base href="${url}">`
  );

  console.log('[parseReadableHtml] URL:', url);
  const { document } = parseHTML(htmlWithBase, { url });
  const reader = new Readability(document);
  const article = reader.parse();

  // Extract image metadata (with absolute URL resolution)
  const image = extractImageUrl(document, url);

  if (article && article.content) {
    // Successfully parsed article - clean the HTML and resolve relative URLs
    const cleanedHtml = cleanHtmlAttributes(article.content, url);
    return {
      title: article.title,
      htmlContent: cleanedHtml,
      image,
    };
  }

  // Fallback: if Readability fails, return null
  // (we don't want to return full body HTML as it may contain unwanted elements)
  return null;
}
