// Private IP ranges to block (SSRF protection)
const PRIVATE_IP_RANGES = [
  /^0\./, // 0.0.0.0/8 (often resolves to localhost)
  /^127\./, // 127.0.0.0/8 (localhost)
  /^10\./, // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 (private)
  /^192\.168\./, // 192.168.0.0/16 (private)
  /^169\.254\./, // 169.254.0.0/16 (link-local)
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // 100.64.0.0/10 (carrier-grade NAT)
  /^::$/, // IPv6 any address
  /^::1$/, // IPv6 localhost
  /^fe80:/i, // IPv6 link-local
  /^fc[0-9a-f]{2}:/i, // IPv6 unique local
  /^fd[0-9a-f]{2}:/i, // IPv6 unique local
];

// Blocked hostnames - exact matches and patterns
// Note: Use isBlockedHostname() which handles both exact and suffix matching
const BLOCKED_HOSTNAMES_EXACT = [
  'localhost',
  'metadata.google.internal',
  '169.254.169.254', // AWS/GCP/Azure metadata IP
];

// Domain suffixes to block (matches example.blockedsuffix.com)
const BLOCKED_HOSTNAME_SUFFIXES = [
  '.metadata.google.internal',
  '.metadata.azure.com',
  '.internal', // Generic internal domains
];

// Metadata service hostnames (cloud providers)
const METADATA_HOSTNAMES = [
  'metadata.google.internal', // GCP
  'metadata.azure.com', // Azure
  'instance-data', // Azure alternative
  'metadata.aws.amazon.com', // AWS (alternative)
];

/**
 * Check if IP address is private or blocked
 */
export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((range) => range.test(ip));
}

/**
 * Check if hostname is blocked
 * Uses exact matching for specific hostnames and suffix matching for domains
 */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Check exact matches
  if (BLOCKED_HOSTNAMES_EXACT.includes(lower)) {
    return true;
  }

  // Check metadata hostnames (exact match)
  if (METADATA_HOSTNAMES.includes(lower)) {
    return true;
  }

  // Check suffix matches (e.g., foo.metadata.google.internal)
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return true;
  }

  return false;
}

/**
 * Validate that URL is safe to fetch (SSRF protection)
 */
export function isValidFeedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // 1. Check protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      console.warn(`[Security] Blocked non-HTTP(S) protocol: ${url.protocol}`);
      return false;
    }

    // 2. Check hostname
    const hostname = url.hostname.toLowerCase();

    // Check blocked hostnames
    if (isBlockedHostname(hostname)) {
      console.warn(`[Security] Blocked hostname: ${hostname}`);
      return false;
    }

    // Check if hostname is an IP address
    // Simple regex for IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      if (isPrivateIP(hostname)) {
        console.warn(`[Security] Blocked private IP: ${hostname}`);
        return false;
      }
    }

    // Check for IPv6 (enclosed in brackets in URL)
    if (hostname.includes(':')) {
      if (isPrivateIP(hostname)) {
        console.warn(`[Security] Blocked private IPv6: ${hostname}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn('[Security] Invalid URL:', urlString, error);
    return false;
  }
}
