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

  // Google web apps
  'mail.google.com',
  'docs.google.com',
  'drive.google.com',
  'calendar.google.com',
  'meet.google.com',
  'chat.google.com',
  'photos.google.com',
  'keep.google.com',
  'sheets.google.com',
  'slides.google.com',
  'forms.google.com',
  'sites.google.com',
  'contacts.google.com',
  'groups.google.com',
  'hangouts.google.com',
  'voice.google.com',
  'messages.google.com',
  'one.google.com',
  'myaccount.google.com',
  'admin.google.com',
  'console.cloud.google.com',
  'analytics.google.com',
  'ads.google.com',
  'tagmanager.google.com',
  'search.google.com',
  'play.google.com',
  'music.youtube.com',
  'studio.youtube.com',

  // Microsoft web apps
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'onedrive.live.com',
  'onedrive.com',
  'office.com',
  'www.office.com',
  'teams.microsoft.com',
  'sharepoint.com',
  'portal.azure.com',
  'dev.azure.com',

  // Apple web apps
  'icloud.com',
  'www.icloud.com',

  // Other major SaaS/web apps
  'notion.so',
  'www.notion.so',
  'figma.com',
  'www.figma.com',
  'canva.com',
  'www.canva.com',
  'airtable.com',
  'www.airtable.com',
  'slack.com',
  'app.slack.com',
  'discord.com',
  'www.discord.com',
  'trello.com',
  'www.trello.com',
  'asana.com',
  'app.asana.com',
  'monday.com',
  'www.monday.com',
  'clickup.com',
  'app.clickup.com',
  'linear.app',
  'height.app',
  'shortcut.com',
  'app.shortcut.com',
  'basecamp.com',
  'www.basecamp.com',
  'todoist.com',
  'app.todoist.com',
  'evernote.com',
  'www.evernote.com',
  'dropbox.com',
  'www.dropbox.com',
  'box.com',
  'app.box.com',
  'zoom.us',
  'www.zoom.us',
  'webex.com',
  'www.webex.com',
  'salesforce.com',
  'login.salesforce.com',
  'zendesk.com',
  'www.zendesk.com',
  'hubspot.com',
  'app.hubspot.com',
  'mailchimp.com',
  'www.mailchimp.com',
  'stripe.com',
  'dashboard.stripe.com',
  'paypal.com',
  'www.paypal.com',
  'quickbooks.intuit.com',
  'mint.intuit.com',
  'turbotax.intuit.com',
  'jira.atlassian.com',
  'confluence.atlassian.com',
  'bitbucket.atlassian.com',

  // Developer tools & platforms
  'vercel.com',
  'app.vercel.com',
  'netlify.com',
  'app.netlify.com',
  'heroku.com',
  'dashboard.heroku.com',
  'railway.app',
  'render.com',
  'dashboard.render.com',
  'supabase.com',
  'app.supabase.com',
  'firebase.google.com',
  'console.firebase.google.com',
  'aws.amazon.com',
  'console.aws.amazon.com',
  'cloudflare.com',
  'dash.cloudflare.com',
  'digitalocean.com',
  'cloud.digitalocean.com',
  'codepen.io',
  'codesandbox.io',
  'replit.com',
  'stackblitz.com',
  'jsfiddle.net',

  // E-commerce platforms (user dashboards)
  'shopify.com',
  'admin.shopify.com',
  'amazon.com',
  'www.amazon.com',
  'ebay.com',
  'www.ebay.com',
  'etsy.com',
  'www.etsy.com',

  // Banking & finance (never show follow button here)
  'chase.com',
  'www.chase.com',
  'bankofamerica.com',
  'www.bankofamerica.com',
  'wellsfargo.com',
  'www.wellsfargo.com',
  'citi.com',
  'www.citi.com',
  'capitalone.com',
  'www.capitalone.com',
  'americanexpress.com',
  'www.americanexpress.com',
  'discover.com',
  'www.discover.com',
  'fidelity.com',
  'www.fidelity.com',
  'schwab.com',
  'www.schwab.com',
  'vanguard.com',
  'www.vanguard.com',
  'robinhood.com',
  'www.robinhood.com',
  'coinbase.com',
  'www.coinbase.com',
]

/**
 * App-like subdomain prefixes that indicate web applications rather than blogs
 * These are checked against the first subdomain of any hostname
 */
export const APP_SUBDOMAIN_PREFIXES: string[] = [
  // Email & communication
  'mail',
  'email',
  'webmail',
  'chat',
  'meet',
  'call',
  'video',
  'messages',
  'messaging',
  'voice',

  // Productivity & docs
  'docs',
  'doc',
  'documents',
  'drive',
  'files',
  'storage',
  'calendar',
  'cal',
  'sheets',
  'slides',
  'forms',
  'notes',
  'keep',

  // Generic app patterns
  'app',
  'apps',
  'application',
  'webapp',
  'web',
  'my',
  'portal',
  'dashboard',
  'dash',
  'panel',
  'control',
  'manage',
  'manager',
  'admin',
  'console',
  'studio',

  // Workspace & team
  'workspace',
  'workspaces',
  'team',
  'teams',
  'office',
  'work',

  // Cloud & infrastructure
  'cloud',
  'api',
  'apis',

  // Account & auth
  'account',
  'accounts',
  'myaccount',
  'login',
  'signin',
  'auth',
  'sso',
  'id',
  'identity',

  // Commerce & billing
  'checkout',
  'cart',
  'pay',
  'payment',
  'payments',
  'billing',
  'invoice',
  'orders',
  'shop',

  // Support & help
  'support',
  'help',
  'helpdesk',
  'ticket',
  'tickets',

  // Analytics & monitoring
  'analytics',
  'stats',
  'metrics',
  'monitor',
  'monitoring',
  'status',

  // Dev tools
  'dev',
  'developer',
  'developers',
  'sandbox',
  'staging',
  'test',
]

/**
 * Hash patterns that indicate SPA/web app routing rather than anchor links
 * These suggest the page is a web application with client-side routing
 */
export const APP_HASH_PATTERNS: RegExp[] = [
  // Path-like hash routing: #/path, #/path/subpath
  /^#\/[a-zA-Z]/,

  // Common app hash routes
  /^#(inbox|compose|sent|drafts|trash|spam|starred|archive)/i,
  /^#(settings|preferences|options|config)/i,
  /^#(dashboard|home|overview|summary)/i,
  /^#(profile|account|user)/i,
  /^#(notifications|alerts|messages)/i,
  /^#(search|find|query)/i,
  /^#(create|new|add|edit|delete|remove)/i,
  /^#(project|task|issue|ticket|board|list|view)/i,
  /^#(file|folder|document|doc)/i,
  /^#(chat|channel|conversation|thread|room)/i,
  /^#(calendar|event|schedule|agenda)/i,
  /^#(report|analytics|stats)/i,
  /^#(admin|manage|control)/i,

  // Hash with ID patterns: #item/123, #user-abc123
  /^#[a-zA-Z]+[/-][a-zA-Z0-9-_]{6,}/,

  // React Router / Angular style: #/app/route
  /^#\/app\//i,

  // Query-like hash: #?param=value
  /^#\?/,
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
 * Extract the first subdomain from a hostname
 * e.g., 'mail.google.com' -> 'mail', 'www.blog.example.com' -> 'www'
 */
function getFirstSubdomain(hostname: string): string | null {
  const parts = hostname.toLowerCase().split('.')

  // Need at least 3 parts for a subdomain (sub.domain.tld)
  // Or 4 parts for .co.uk style TLDs (sub.domain.co.uk)
  if (parts.length < 3) {
    return null
  }

  // Handle common two-part TLDs
  const twoPartTlds = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in']
  const lastTwo = parts.slice(-2).join('.')

  if (twoPartTlds.includes(lastTwo)) {
    // Need at least 4 parts for subdomain with two-part TLD
    return parts.length >= 4 ? parts[0] : null
  }

  // Skip 'www' to get the meaningful subdomain
  if (parts[0] === 'www' && parts.length >= 4) {
    return parts[1]
  }

  return parts[0]
}

/**
 * Check if the hostname has an app-like subdomain prefix
 */
export function hasAppSubdomain(hostname: string): boolean {
  const subdomain = getFirstSubdomain(hostname)
  if (!subdomain) {
    return false
  }

  // Skip 'www' - it's not an app indicator
  if (subdomain === 'www') {
    return false
  }

  return APP_SUBDOMAIN_PREFIXES.includes(subdomain)
}

/**
 * Check if the URL hash indicates SPA/web app routing
 */
export function hasAppHashRouting(hash: string): boolean {
  if (!hash || hash === '#' || hash === '') {
    return false
  }

  // Check against known app hash patterns
  for (const pattern of APP_HASH_PATTERNS) {
    if (pattern.test(hash)) {
      return true
    }
  }

  return false
}

/**
 * Check if a URL should be excluded from feed discovery
 * Combines domain, subdomain, path, and hash checks
 */
export function shouldExcludeUrl(url: URL | Location): boolean {
  // Check exact domain matches first (fastest)
  if (isExcludedDomain(url.hostname)) {
    return true
  }

  // Check for app-like subdomain prefixes (e.g., mail.*, app.*, dashboard.*)
  if (hasAppSubdomain(url.hostname)) {
    return true
  }

  // Check for ActivityPub path patterns
  if (isActivityPubPath(url.pathname)) {
    return true
  }

  // Check for SPA/web app hash routing
  if (hasAppHashRouting(url.hash)) {
    return true
  }

  return false
}
