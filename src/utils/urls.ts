/**
 * Attempts to convert a string into a proper, absolute URL object.
 *
 * This function is designed to handle various user inputs gracefully and
 * produce a predictable, valid URL string if possible.
 *
 * - If the input is already a valid URL (e.g., "https://example.com"), it's normalized.
 * - If the input looks like a domain (e.g., "overreacted.io"), it prepends "https://".
 * - If the input is not a valid URL or domain-like string (e.g., "overreacted"), it returns null.
 * - It also handles null, undefined, and empty/whitespace inputs by returning null.
 *
 * @param input The string to parse.
 * @returns A valid, absolute URL string (e.g., "https://overreacted.io/") or null if the input cannot be resolved to a URL.
 */
export function toURL(input: string | null | undefined, enforceHttps: boolean = false): string | null {
  // 1. Handle empty or invalid inputs
  if (!input) {
    return null;
  }

  const trimmedInput = input.trim();
  if (trimmedInput === '') {
    return null;
  }

  // 2. Prepend "https://" if the string doesn't have a protocol
  // This is a simple but effective way to handle inputs like "overreacted.io"
  let urlString = trimmedInput;
  if (!/^[a-z][a-z0-9+.-]*:/.test(urlString)) {
    urlString = 'https://' + urlString;
  }

  // 3. Use the URL constructor to validate and parse the string
  try {
    const url = new URL(urlString);

    // Optional: You could enforce HTTPS for security
    if (enforceHttps && url.protocol === 'http:') {
      url.protocol = 'https:';
    }

    // The 'href' property provides the full, normalized URL string.
    // For a root domain, it often includes a trailing slash (e.g., "https://example.com/").
    return url.href;
  } catch (error) {
    // If the URL constructor throws an error, the input was not valid.
    // This catches cases like "https://invalid-domain" or just "words".
    return null;
  }
}



/**
 * Normalizes a URL by adding https:// protocol if missing
 * @param url - The URL to normalize (e.g., "example.com" or "https://example.com")
 * @returns A valid URL string with protocol
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()

  // If URL already has a protocol, return as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // Add https:// protocol
  return `https://${trimmed}`
}
