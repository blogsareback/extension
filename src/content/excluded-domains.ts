/**
 * Excluded Domains Configuration
 *
 * Blogs Are Back focuses on indie blogs. These domains have RSS feeds but aren't
 * appropriate for automatic feed detection. Users can still manually add feeds
 * from these sites via direct URL entry if desired.
 */

/**
 * Exact domain matches (including common subdomains)
 */
export const EXCLUDED_DOMAINS: string[] = [
  // Video platforms
  'youtube.com',
  'www.youtube.com',
  'youtu.be',

  // Code hosting
  'github.com',
  'www.github.com',
  'gist.github.com',
  'gitlab.com',
  'www.gitlab.com',
  'bitbucket.org',
  'www.bitbucket.org',

  // Social media
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'linkedin.com',
  'www.linkedin.com',
  'threads.net',
  'www.threads.net',
  'bsky.app',

  // Publication platforms (individual blogs on custom domains are fine)
  'medium.com',
  'www.medium.com',
  'substack.com',
  'www.substack.com',
  'tumblr.com',
  'www.tumblr.com',

  // News aggregators
  'news.ycombinator.com',
  'lobste.rs',

  // Major Mastodon/Fediverse instances
  'mastodon.social',
  'mastodon.online',
  'mastodon.world',
  'mstdn.social',
  'fosstodon.org',
  'hachyderm.io',
  'infosec.exchange',
  'mas.to',
  'tech.lgbt',
  'universeodon.com',
  'masto.ai',
  'c.im',
]

/**
 * Domain suffix patterns (matches any subdomain)
 * e.g., 'mastodon.' matches 'mastodon.xyz', 'mastodon.example.com'
 */
export const EXCLUDED_DOMAIN_PREFIXES: string[] = [
  'mastodon.',
  'mstdn.',
]

/**
 * URL path patterns that indicate ActivityPub/Fediverse content
 * These patterns suggest the page is a social profile rather than a blog
 */
export const ACTIVITYPUB_PATH_PATTERNS: RegExp[] = [
  /^\/@[^/]+\/?$/, // /@username or /@username/
  /^\/users\/[^/]+\/?$/, // /users/username or /users/username/
  /^\/u\/[^/]+\/?$/, // /u/username (some instances)
]

/**
 * Check if a hostname should be excluded from feed discovery
 */
export function isExcludedDomain(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase()

  // Check exact domain matches
  if (EXCLUDED_DOMAINS.includes(normalizedHostname)) {
    return true
  }

  // Check domain prefix patterns (e.g., mastodon.* instances)
  for (const prefix of EXCLUDED_DOMAIN_PREFIXES) {
    if (normalizedHostname.startsWith(prefix)) {
      return true
    }
  }

  return false
}

/**
 * Check if a URL path indicates ActivityPub/Fediverse content
 */
export function isActivityPubPath(pathname: string): boolean {
  for (const pattern of ACTIVITYPUB_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return true
    }
  }
  return false
}

/**
 * Check if a URL should be excluded from feed discovery
 * Combines domain and path checks
 */
export function shouldExcludeUrl(url: URL | Location): boolean {
  // Check domain first (faster)
  if (isExcludedDomain(url.hostname)) {
    return true
  }

  // Check for ActivityPub path patterns
  if (isActivityPubPath(url.pathname)) {
    return true
  }

  return false
}
