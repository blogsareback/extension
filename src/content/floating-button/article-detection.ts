/**
 * Article Page Detection
 *
 * Analyzes page content to determine if the current page is likely a blog article.
 * Uses multiple heuristics: page structure, CMS fingerprinting, URL patterns, and content signals.
 */

export interface ArticleDetectionResult {
  isArticle: boolean
  confidence: number // 0-1 scale
  signals: string[] // List of detected signals for debugging
}

/**
 * Check for semantic article structure in the page
 */
function checkPageStructure(): string[] {
  const signals: string[] = []

  // Check for <article> tag
  const articles = document.querySelectorAll('article')
  if (articles.length === 1) {
    signals.push('single-article-tag')
  } else if (articles.length > 1) {
    // Multiple articles suggests a list page, not a single article
    return [] // Return empty - this is a negative signal
  }

  // Check for role="article"
  if (document.querySelector('[role="article"]')) {
    signals.push('article-role')
  }

  // Check for <main> with article-like content
  const main = document.querySelector('main')
  if (main && main.querySelector('article, [role="article"]')) {
    signals.push('main-with-article')
  }

  return signals
}

/**
 * Check for byline patterns (author, date)
 */
function checkBylinePatterns(): string[] {
  const signals: string[] = []

  // Check for <time> element with datetime attribute
  const timeElements = document.querySelectorAll('time[datetime]')
  if (timeElements.length > 0) {
    signals.push('time-element')
  }

  // Check for common author/byline class patterns
  const bylineSelectors = [
    '.author',
    '.byline',
    '.post-author',
    '.entry-author',
    '.article-author',
    '[rel="author"]',
    '.post-meta',
    '.entry-meta',
    '.article-meta',
    '.post-date',
    '.entry-date',
    '.published',
    '.pubdate',
  ]

  for (const selector of bylineSelectors) {
    if (document.querySelector(selector)) {
      signals.push(`byline:${selector}`)
      break // One is enough
    }
  }

  // Check for schema.org Article markup
  const schemaArticle = document.querySelector('[itemtype*="Article"], [itemtype*="BlogPosting"], [itemtype*="NewsArticle"]')
  if (schemaArticle) {
    signals.push('schema-article')
  }

  // Check for JSON-LD structured data
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || '')
      const type = data['@type'] || (Array.isArray(data) ? data[0]?.['@type'] : null)
      if (type && /Article|BlogPosting|NewsArticle|TechArticle/i.test(type)) {
        signals.push('jsonld-article')
        break
      }
    } catch {
      // Ignore parse errors
    }
  }

  return signals
}

/**
 * Check for comment section indicators
 */
function checkCommentSection(): string[] {
  const signals: string[] = []

  const commentSelectors = [
    '#comments',
    '.comments',
    '.comment-section',
    '.post-comments',
    '#disqus_thread',
    '.disqus-comments',
    '[data-comments]',
    '.comment-list',
    '.comments-area',
    '#respond', // WordPress comment form
  ]

  for (const selector of commentSelectors) {
    if (document.querySelector(selector)) {
      signals.push('comment-section')
      break
    }
  }

  return signals
}

/**
 * Check for CMS fingerprints
 */
function checkCMSFingerprints(): string[] {
  const signals: string[] = []

  // WordPress
  const wpIndicators = [
    document.querySelector('meta[name="generator"][content*="WordPress"]'),
    document.querySelector('link[href*="wp-content"]'),
    document.querySelector('link[href*="wp-includes"]'),
    document.body.classList.contains('single-post'),
    document.body.classList.contains('single'),
    document.querySelector('.wp-block-post-content'),
  ]
  if (wpIndicators.some(Boolean)) {
    signals.push('cms:wordpress')
  }

  // Ghost
  const ghostIndicators = [
    document.querySelector('meta[name="generator"][content*="Ghost"]'),
    document.querySelector('.gh-content'),
    document.querySelector('.post-full-content'),
    document.body.classList.contains('post-template'),
  ]
  if (ghostIndicators.some(Boolean)) {
    signals.push('cms:ghost')
  }

  // Jekyll
  const jekyllIndicators = [
    document.querySelector('meta[name="generator"][content*="Jekyll"]'),
    document.body.classList.contains('post'),
    document.querySelector('.post-content'),
  ]
  if (jekyllIndicators.some(Boolean)) {
    signals.push('cms:jekyll')
  }

  // Hugo
  const hugoIndicators = [
    document.querySelector('meta[name="generator"][content*="Hugo"]'),
  ]
  if (hugoIndicators.some(Boolean)) {
    signals.push('cms:hugo')
  }

  // Blogger/Blogspot
  const bloggerIndicators = [
    window.location.hostname.includes('blogspot'),
    document.querySelector('meta[name="generator"][content*="Blogger"]'),
    document.querySelector('.post-body'),
  ]
  if (bloggerIndicators.some(Boolean)) {
    signals.push('cms:blogger')
  }

  // Substack (individual posts)
  const substackIndicators = [
    document.querySelector('meta[property="og:site_name"][content="Substack"]'),
    document.querySelector('.post-content'),
    document.body.classList.contains('post-page'),
  ]
  if (substackIndicators.some(Boolean)) {
    signals.push('cms:substack')
  }

  // Medium (individual articles)
  const mediumIndicators = [
    document.querySelector('meta[property="og:site_name"][content="Medium"]'),
    document.querySelector('article[data-post-id]'),
  ]
  if (mediumIndicators.some(Boolean)) {
    signals.push('cms:medium')
  }

  // 11ty/Eleventy (often uses similar patterns to Jekyll)
  const eleventyIndicators = [
    document.querySelector('meta[name="generator"][content*="Eleventy"]'),
    document.querySelector('meta[name="generator"][content*="11ty"]'),
  ]
  if (eleventyIndicators.some(Boolean)) {
    signals.push('cms:eleventy')
  }

  return signals
}

/**
 * Check URL patterns that indicate an article page
 */
function checkURLPatterns(): string[] {
  const signals: string[] = []
  const path = window.location.pathname.toLowerCase()
  const fullUrl = window.location.href.toLowerCase()

  // Blog/posts directory patterns
  const blogPathPatterns = [
    /\/blog\//,
    /\/posts?\//,
    /\/articles?\//,
    /\/writing\//,
    /\/thoughts\//,
    /\/notes\//,
    /\/journal\//,
    /\/p\//, // Substack, Medium
  ]

  for (const pattern of blogPathPatterns) {
    if (pattern.test(path)) {
      signals.push('url:blog-path')
      break
    }
  }

  // Date-based URL patterns (common for blogs)
  // e.g., /2024/01/article-title or /2024/01/15/article-title
  const datePatterns = [
    /\/20\d{2}\/\d{1,2}\//, // /2024/01/
    /\/20\d{2}-\d{1,2}-\d{1,2}/, // /2024-01-15
  ]

  for (const pattern of datePatterns) {
    if (pattern.test(path)) {
      signals.push('url:date-pattern')
      break
    }
  }

  // Slug-like patterns (single slug after domain, not a list page)
  // This is weaker signal - many sites have /about, /contact, etc.
  const slugPattern = /^\/[a-z0-9][-a-z0-9]*\/?$/
  if (slugPattern.test(path) && path.length > 10) {
    // Only if slug is reasonably long (like an article title)
    signals.push('url:slug-pattern')
  }

  // Check for query params that indicate pagination (negative signal)
  if (/[?&](page|p)=\d/.test(fullUrl)) {
    // This is likely a list page with pagination, not an article
    return []
  }

  return signals
}

/**
 * Check content signals (article length, headings structure)
 */
function checkContentSignals(): string[] {
  const signals: string[] = []

  // Get main content area
  const contentArea = document.querySelector('article, main, .post-content, .entry-content, .article-content')

  if (contentArea) {
    // Check for substantial text content
    const text = contentArea.textContent || ''
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length

    if (wordCount > 300) {
      signals.push('content:substantial-text')
    }

    // Check for heading structure within content
    const headings = contentArea.querySelectorAll('h1, h2, h3, h4')
    if (headings.length >= 2) {
      signals.push('content:multiple-headings')
    }

    // Check for paragraphs
    const paragraphs = contentArea.querySelectorAll('p')
    if (paragraphs.length >= 3) {
      signals.push('content:multiple-paragraphs')
    }
  }

  return signals
}

/**
 * Check for negative signals (things that indicate NOT an article)
 */
function checkNegativeSignals(): string[] {
  const signals: string[] = []
  const path = window.location.pathname.toLowerCase()

  // Common non-article pages
  const nonArticlePatterns = [
    /^\/?$/, // Homepage
    /^\/index\.html?$/,
    /^\/home\/?$/,
    /^\/about\/?$/,
    /^\/contact\/?$/,
    /^\/privacy\/?$/,
    /^\/terms\/?$/,
    /^\/faq\/?$/,
    /^\/search\/?$/,
    /^\/tags?\/?$/,
    /^\/categories?\/?$/,
    /^\/archive\/?$/,
    /^\/archives?\/?$/,
    /^\/blog\/?$/, // Blog index, not a post
    /^\/posts?\/?$/, // Posts index, not a post
  ]

  for (const pattern of nonArticlePatterns) {
    if (pattern.test(path)) {
      signals.push('negative:common-page')
      break
    }
  }

  // Multiple article cards/previews (indicates list page)
  const articleCards = document.querySelectorAll('.post-card, .article-card, .post-preview, .entry-summary, .post-excerpt')
  if (articleCards.length > 2) {
    signals.push('negative:multiple-cards')
  }

  // Pagination elements
  if (document.querySelector('.pagination, .pager, .nav-links, [aria-label="Pagination"]')) {
    // Only negative if on a list-like page
    const articles = document.querySelectorAll('article')
    if (articles.length > 1) {
      signals.push('negative:paginated-list')
    }
  }

  return signals
}

/**
 * Main detection function
 * Returns whether the current page is likely a blog article
 */
export function isLikelyArticlePage(): ArticleDetectionResult {
  const allSignals: string[] = []

  // Collect positive signals
  allSignals.push(...checkPageStructure())
  allSignals.push(...checkBylinePatterns())
  allSignals.push(...checkCommentSection())
  allSignals.push(...checkCMSFingerprints())
  allSignals.push(...checkURLPatterns())
  allSignals.push(...checkContentSignals())

  // Collect negative signals
  const negativeSignals = checkNegativeSignals()
  allSignals.push(...negativeSignals)

  // Calculate confidence score
  const positiveSignals = allSignals.filter(s => !s.startsWith('negative:'))
  const negativeCount = negativeSignals.length

  // Weight different signal categories
  let score = 0

  // Strong positive signals (0.25 each)
  const strongSignals = ['single-article-tag', 'article-role', 'schema-article', 'jsonld-article']
  score += positiveSignals.filter(s => strongSignals.includes(s)).length * 0.25

  // Medium positive signals (0.15 each)
  const mediumSignals = ['time-element', 'content:substantial-text', 'url:blog-path', 'url:date-pattern']
  score += positiveSignals.filter(s => mediumSignals.some(m => s.includes(m))).length * 0.15

  // CMS signals (0.1 each - helpful but not definitive)
  score += positiveSignals.filter(s => s.startsWith('cms:')).length * 0.1

  // Weak positive signals (0.05 each)
  const weakSignals = ['comment-section', 'content:multiple-headings', 'content:multiple-paragraphs']
  score += positiveSignals.filter(s => weakSignals.some(w => s.includes(w))).length * 0.05

  // Byline signals (0.1)
  if (positiveSignals.some(s => s.startsWith('byline:'))) {
    score += 0.1
  }

  // Negative signals reduce score significantly
  score -= negativeCount * 0.3

  // Clamp to 0-1 range
  const confidence = Math.max(0, Math.min(1, score))

  // Consider it an article if confidence >= 0.3 (at least a couple of signals)
  const isArticle = confidence >= 0.3

  return {
    isArticle,
    confidence,
    signals: allSignals,
  }
}

// Cache the result since it won't change during page lifecycle
let cachedResult: ArticleDetectionResult | null = null

/**
 * Get article detection result (cached after first call)
 */
export function getArticleDetection(): ArticleDetectionResult {
  if (cachedResult === null) {
    cachedResult = isLikelyArticlePage()
  }
  return cachedResult
}
