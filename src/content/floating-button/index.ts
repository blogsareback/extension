/**
 * Floating Subscribe Button Content Script
 *
 * Shows a floating "Follow" button when visiting pages with RSS/Atom feeds.
 * Uses Shadow DOM for style isolation from host pages.
 * React + Tailwind v4 implementation.
 */

import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import browser from '../../utils/browser'
import { shouldExcludeUrl } from '../excluded-domains'
import type {
  FeedLink,
  ExtensionSettings,
  QueuedSubscription,
  ButtonStyle,
  ButtonPosition,
  ButtonBehavior,
} from '../../utils/types'
import {
  STORAGE_KEY_FLOATING_BUTTON_DISMISSED,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_FOLLOWED_FEED_URLS,
  STORAGE_KEY_SUBSCRIPTION_QUEUE,
} from '../../utils/constants'
import { FloatingButton } from './FloatingButton'
import { getArticleDetection } from './article-detection'
import styles from './styles.css?inline'

// State
let buttonRoot: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
let reactRoot: Root | null = null
let currentFeeds: FeedLink[] = []
let isVisible = false
let isFaded = false
let showDelayTimeout: ReturnType<typeof setTimeout> | null = null
let fadeTimeout: ReturnType<typeof setTimeout> | null = null
let lastScrollY = 0
let behaviorVisible = true // For scroll-up/article-end modes
let scrollHandler: (() => void) | null = null

// Constants for behavior modes
const AUTO_FADE_DELAY = 5000 // 5 seconds before fading
const SCROLL_THRESHOLD = 50 // Pixels to scroll before triggering show/hide
const ARTICLE_END_THRESHOLD = 0.8 // Show when 80% scrolled

type ColorMode = 'light' | 'dark'

/**
 * Parse an rgb/rgba color string and return its relative luminance (WCAG formula).
 * Returns null if the color string can't be parsed.
 */
function getColorLuminance(color: string): number | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return null

  const r = parseInt(match[1]) / 255
  const g = parseInt(match[2]) / 255
  const b = parseInt(match[3]) / 255

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Detect whether the host page is using a light or dark color scheme
 * by inspecting DOM attributes, computed styles, and OS preference.
 */
function detectPageColorMode(): ColorMode {
  const html = document.documentElement
  const body = document.body

  // 1. Check for explicit dark mode classes/attributes (common patterns)
  const darkIndicators = [
    html.classList.contains('dark'),
    body.classList.contains('dark'),
    html.getAttribute('data-theme') === 'dark',
    body.getAttribute('data-theme') === 'dark',
    html.getAttribute('data-mode') === 'dark',
    html.getAttribute('data-color-scheme') === 'dark',
    document
      .querySelector('meta[name="color-scheme"]')
      ?.getAttribute('content')
      ?.includes('dark'),
  ]

  if (darkIndicators.some(Boolean)) {
    return 'dark'
  }

  // 2. Check for explicit light mode indicators
  const lightIndicators = [
    html.classList.contains('light'),
    body.classList.contains('light'),
    html.getAttribute('data-theme') === 'light',
    body.getAttribute('data-theme') === 'light',
  ]

  if (lightIndicators.some(Boolean)) {
    return 'light'
  }

  // 3. Analyze computed background color of the page
  const bgColor = getComputedStyle(body).backgroundColor
  const luminance = getColorLuminance(bgColor)

  if (luminance !== null) {
    return luminance < 0.5 ? 'dark' : 'light'
  }

  // 4. Fall back to OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Check if we're on the BlogsAreBack domain
 */
function isBlogsAreBackDomain(): boolean {
  const hostname = window.location.hostname
  return (
    hostname === 'blogsareback.com' ||
    hostname.endsWith('.blogsareback.com') ||

    // Dev mode
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  )
}

/**
 * Get the current domain (hostname without www prefix)
 */
function getCurrentDomain(): string {
  return window.location.hostname.replace(/^www\./, '')
}

/**
 * Check if current domain is dismissed
 */
async function isDomainDismissed(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_FLOATING_BUTTON_DISMISSED)
    const dismissedDomains = (result[STORAGE_KEY_FLOATING_BUTTON_DISMISSED] as string[] | undefined) || []
    const currentDomain = getCurrentDomain()
    return dismissedDomains.includes(currentDomain)
  } catch {
    return false
  }
}

/**
 * Dismiss the button for the current domain
 */
async function dismissForDomain(): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_FLOATING_BUTTON_DISMISSED)
    const dismissedDomains = (result[STORAGE_KEY_FLOATING_BUTTON_DISMISSED] as string[] | undefined) || []
    const currentDomain = getCurrentDomain()

    if (!dismissedDomains.includes(currentDomain)) {
      dismissedDomains.push(currentDomain)
      await browser.storage.local.set({
        [STORAGE_KEY_FLOATING_BUTTON_DISMISSED]: dismissedDomains,
      })
    }

    // Notify service worker to track this for session frequency limiting
    try {
      await browser.runtime.sendMessage({ type: 'FLOATING_BUTTON_DISMISSED' })
    } catch {
      // Ignore errors - service worker may not be available
    }
  } catch (error) {
    console.error('[Floating Button] Failed to save dismissed domain:', error)
  }
}

// Floating button settings interface (subset needed for floating button)
interface FloatingButtonSettings {
  extensionMode: 'basic' | 'featured'
  feedDiscoveryEnabled: boolean
  floatingButtonEnabled: boolean
  stricterFeedRecognition: boolean
  floatingButtonStyle: ButtonStyle
  floatingButtonPosition: ButtonPosition
  floatingButtonBehavior: ButtonBehavior
  floatingButtonShowDelay: number
  floatingButtonOnlyArticles: boolean
}

// Default settings (subset needed for floating button)
const DEFAULT_FLOATING_BUTTON_SETTINGS: FloatingButtonSettings = {
  extensionMode: 'basic',
  feedDiscoveryEnabled: true,
  floatingButtonEnabled: false, // Disabled by default - users can enable in popup or settings
  stricterFeedRecognition: false,
  floatingButtonStyle: 'solid',
  floatingButtonPosition: 'bottom-right',
  floatingButtonBehavior: 'always',
  floatingButtonShowDelay: 0,
  floatingButtonOnlyArticles: false,
}

// Current settings cache
let currentSettings: FloatingButtonSettings = { ...DEFAULT_FLOATING_BUTTON_SETTINGS }

/**
 * Get extension settings with defaults
 */
async function getSettings(): Promise<FloatingButtonSettings> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SETTINGS)
    const stored = result[STORAGE_KEY_SETTINGS] as Partial<ExtensionSettings> | undefined
    currentSettings = { ...DEFAULT_FLOATING_BUTTON_SETTINGS, ...stored }
    return currentSettings
  } catch {
    return DEFAULT_FLOATING_BUTTON_SETTINGS
  }
}

/**
 * Normalize URL for comparison (remove trailing slash, lowercase)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return (parsed.origin + parsed.pathname.replace(/\/$/, '')).toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Check if all feeds are already followed
 */
async function areAllFeedsFollowed(feeds: FeedLink[]): Promise<boolean> {
  if (feeds.length === 0) return true

  try {
    const result = await browser.storage.local.get(STORAGE_KEY_FOLLOWED_FEED_URLS)
    const followedUrls = (result[STORAGE_KEY_FOLLOWED_FEED_URLS] as string[] | undefined) || []

    const normalizedFollowed = new Set(followedUrls.map(normalizeUrl))
    return feeds.every((feed) => normalizedFollowed.has(normalizeUrl(feed.href)))
  } catch {
    return false
  }
}

/**
 * Check if any feeds are already in the subscription queue
 */
async function areAnyFeedsInQueue(feeds: FeedLink[]): Promise<boolean> {
  if (feeds.length === 0) return false

  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SUBSCRIPTION_QUEUE)
    const queue = (result[STORAGE_KEY_SUBSCRIPTION_QUEUE] as QueuedSubscription[] | undefined) || []

    const normalizedQueuedUrls = new Set(queue.map((item) => normalizeUrl(item.feedUrl)))
    return feeds.some((feed) => normalizedQueuedUrls.has(normalizeUrl(feed.href)))
  } catch {
    return false
  }
}

/**
 * Render the React component into the shadow DOM
 */
function renderButton(hiding: boolean): void {
  if (!reactRoot) return

  reactRoot.render(
    createElement(FloatingButton, {
      feeds: currentFeeds,
      hiding,
      onDismiss: handleDismiss,
      onAutoHide: () => hideButton(),
      style: currentSettings.floatingButtonStyle,
      position: currentSettings.floatingButtonPosition,
      isFaded,
    })
  )
}

/**
 * Handle dismiss: save domain, then hide button
 */
async function handleDismiss(): Promise<void> {
  await dismissForDomain()
  hideButton()
}

/**
 * Clear fade timeout
 */
function clearFadeTimeout(): void {
  if (fadeTimeout) {
    clearTimeout(fadeTimeout)
    fadeTimeout = null
  }
}

/**
 * Start auto-fade timer
 */
function startFadeTimer(): void {
  clearFadeTimeout()
  fadeTimeout = setTimeout(() => {
    isFaded = true
    renderButton(false)
  }, AUTO_FADE_DELAY)
}

/**
 * Handle mouse enter on button (for auto-fade)
 */
function handleButtonMouseEnter(): void {
  if (currentSettings.floatingButtonBehavior === 'auto-fade') {
    isFaded = false
    clearFadeTimeout()
    renderButton(false)
  }
}

/**
 * Handle mouse leave on button (for auto-fade)
 */
function handleButtonMouseLeave(): void {
  if (currentSettings.floatingButtonBehavior === 'auto-fade') {
    startFadeTimer()
  }
}

/**
 * Remove scroll event listener
 */
function removeScrollHandler(): void {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler)
    scrollHandler = null
  }
}

/**
 * Setup scroll-up behavior
 */
function setupScrollUpBehavior(): void {
  removeScrollHandler()
  lastScrollY = window.scrollY
  behaviorVisible = false

  scrollHandler = () => {
    const currentScrollY = window.scrollY
    const scrollDelta = currentScrollY - lastScrollY

    if (scrollDelta < -SCROLL_THRESHOLD) {
      // Scrolling up - show button
      if (!behaviorVisible) {
        behaviorVisible = true
        showButtonNow()
      }
    } else if (scrollDelta > SCROLL_THRESHOLD) {
      // Scrolling down - hide button
      if (behaviorVisible) {
        behaviorVisible = false
        hideButton()
      }
    }

    lastScrollY = currentScrollY
  }

  window.addEventListener('scroll', scrollHandler, { passive: true })
}

/**
 * Setup article-end behavior
 */
function setupArticleEndBehavior(): void {
  removeScrollHandler()
  behaviorVisible = false

  const checkScrollPosition = () => {
    // Once shown, stay shown
    if (behaviorVisible) return

    const scrollHeight = document.documentElement.scrollHeight
    const clientHeight = document.documentElement.clientHeight
    const scrollTop = window.scrollY

    // Calculate scroll progress (0 to 1)
    const scrollProgress = (scrollTop + clientHeight) / scrollHeight

    if (scrollProgress >= ARTICLE_END_THRESHOLD) {
      behaviorVisible = true
      showButtonNow()
    }
  }

  scrollHandler = checkScrollPosition

  window.addEventListener('scroll', scrollHandler, { passive: true })

  // Check immediately in case page is short or already scrolled
  checkScrollPosition()
}

/**
 * Show button immediately (for behavior modes)
 */
function showButtonNow(): void {
  if (isVisible || currentFeeds.length === 0) return

  // Create root element if needed
  if (!buttonRoot) {
    buttonRoot = document.createElement('div')
    buttonRoot.id = 'bab-floating-button-root'
    shadowRoot = buttonRoot.attachShadow({ mode: 'closed' })

    // Apply page color mode as a class on the shadow host
    const colorMode = detectPageColorMode()
    if (colorMode === 'dark') {
      buttonRoot.classList.add('dark')
    }

    // Inject Tailwind CSS
    const styleSheet = document.createElement('style')
    styleSheet.textContent = styles
    shadowRoot.appendChild(styleSheet)

    // Create React mount point
    const mountPoint = document.createElement('div')

    // Add mouse event listeners for auto-fade behavior
    mountPoint.addEventListener('mouseenter', handleButtonMouseEnter)
    mountPoint.addEventListener('mouseleave', handleButtonMouseLeave)

    shadowRoot.appendChild(mountPoint)
    reactRoot = createRoot(mountPoint)

    document.body.appendChild(buttonRoot)
  }

  isVisible = true
  isFaded = false
  renderButton(false)

  // Start fade timer if in auto-fade mode
  if (currentSettings.floatingButtonBehavior === 'auto-fade') {
    startFadeTimer()
  }
}

/**
 * Create and show the floating button (respects behavior mode)
 */
function showButton(): void {
  if (currentFeeds.length === 0) return

  const behavior = currentSettings.floatingButtonBehavior

  // For behavior modes that control visibility differently
  switch (behavior) {
    case 'scroll-up':
      // Don't show immediately, wait for scroll up
      setupScrollUpBehavior()
      break

    case 'article-end':
      // Don't show immediately, wait for scroll to bottom
      setupArticleEndBehavior()
      break

    case 'auto-fade':
    case 'always':
    default:
      // Show immediately
      showButtonNow()
      break
  }
}

/**
 * Hide and remove the floating button with exit animation
 */
function hideButton(): void {
  // Clear any pending timeouts
  clearFadeTimeout()

  if (!isVisible || !reactRoot) return

  // Re-render with hiding=true to trigger slide-down animation
  renderButton(true)

  // Remove after animation completes
  setTimeout(() => {
    reactRoot?.unmount()
    reactRoot = null
    buttonRoot?.remove()
    buttonRoot = null
    shadowRoot = null
    isVisible = false
    isFaded = false
  }, 200)
}

/**
 * Fully cleanup the button and behavior handlers
 */
function cleanup(): void {
  clearShowDelayTimeout()
  clearFadeTimeout()
  removeScrollHandler()
  hideButton()
}

/**
 * Clear any pending show delay timeout
 */
function clearShowDelayTimeout(): void {
  if (showDelayTimeout) {
    clearTimeout(showDelayTimeout)
    showDelayTimeout = null
  }
}

/**
 * Handle feeds update from service worker
 */
async function handleFeedsUpdate(feeds: FeedLink[]): Promise<void> {
  // Clear any pending show delay and behavior handlers
  clearShowDelayTimeout()
  clearFadeTimeout()
  removeScrollHandler()

  // Skip if disabled or excluded
  if (isBlogsAreBackDomain()) return
  if (shouldExcludeUrl(window.location)) return

  // Check settings
  const settings = await getSettings()

  // Floating button is only available in featured mode
  if (settings.extensionMode !== 'featured') {
    hideButton()
    return
  }

  if (!settings.feedDiscoveryEnabled || !settings.floatingButtonEnabled) {
    hideButton()
    return
  }

  // Check if domain is dismissed
  if (await isDomainDismissed()) {
    return
  }

  // Check "only on article pages" setting
  if (settings.floatingButtonOnlyArticles) {
    const detection = getArticleDetection()
    if (!detection.isArticle) {
      console.log('[Floating Button] Skipping: not detected as article page', detection.signals)
      hideButton()
      return
    }
    console.log('[Floating Button] Article detected with confidence', detection.confidence, detection.signals)
  }

  // Check if all feeds are already followed or in subscription queue
  if (await areAllFeedsFollowed(feeds)) {
    hideButton()
    return
  }

  if (await areAnyFeedsInQueue(feeds)) {
    hideButton()
    return
  }

  currentFeeds = feeds

  if (feeds.length > 0) {
    // Apply show delay if configured
    const delay = settings.floatingButtonShowDelay * 1000
    if (delay > 0) {
      console.log(`[Floating Button] Delaying show by ${settings.floatingButtonShowDelay}s`)
      showDelayTimeout = setTimeout(() => {
        showDelayTimeout = null
        showButton()
      }, delay)
    } else {
      showButton()
    }
  } else {
    hideButton()
  }
}

/**
 * Request current feeds from service worker
 */
async function requestCurrentFeeds(): Promise<void> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'GET_FLOATING_BUTTON_FEEDS',
    })) as { feeds?: FeedLink[] } | undefined

    if (response?.feeds && response.feeds.length > 0) {
      await handleFeedsUpdate(response.feeds)
    }
  } catch (error) {
    console.log('[Floating Button] Failed to request feeds:', error)
  }
}

/**
 * Listen for messages from service worker
 */
browser.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message === 'object' && message !== null && 'type' in message) {
    const msg = message as { type: string; feeds?: FeedLink[] }

    if (msg.type === 'FLOATING_BUTTON_UPDATE' && msg.feeds) {
      handleFeedsUpdate(msg.feeds)
    }
  }
})

/**
 * Initialize the floating button
 */
async function init(): Promise<void> {
  // Skip on BlogsAreBack domain
  if (isBlogsAreBackDomain()) return

  // Skip on excluded domains
  if (shouldExcludeUrl(window.location)) return

  // Request current feeds (in case feed-discovery already ran)
  // Add a small delay to ensure feed-discovery has time to detect feeds
  setTimeout(() => {
    requestCurrentFeeds()
  }, 500)
}

// Initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

console.log('[Floating Button] Content script loaded')
