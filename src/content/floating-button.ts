/**
 * Floating Subscribe Button Content Script
 *
 * Shows a floating "Follow" button when visiting pages with RSS/Atom feeds.
 * Uses Shadow DOM for style isolation from host pages.
 */

import browser from '../utils/browser'
import { shouldExcludeUrl } from './excluded-domains'
import { FLOATING_BUTTON_STYLES } from './floating-button-styles'
import type { FeedLink, ExtensionSettings, PopupSubscribeResponse } from '../utils/types'
import { LOGO_SVG } from '../assets/logo'
import {
  STORAGE_KEY_FLOATING_BUTTON_DISMISSED,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_FOLLOWED_FEED_URLS,
  STORAGE_KEY_SUBSCRIPTION_QUEUE,
} from '../utils/constants'
import type { QueuedSubscription } from '../utils/types'

// const AUTO_HIDE_AFTER_MS = 1500
const AUTO_HIDE_AFTER_MS = 3000

// State
let buttonRoot: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
let currentFeeds: FeedLink[] = []
let isVisible = false
let isLoading = false
let showDismissTooltip = false

/**
 * Check if we're on the BlogsAreBack domain
 */
function isBlogsAreBackDomain(): boolean {
  const hostname = window.location.hostname
  return (
    hostname === 'blogsareback.com' ||
    hostname.endsWith('.blogsareback.com') ||
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
  } catch (error) {
    console.error('[Floating Button] Failed to save dismissed domain:', error)
  }
}

// Default settings (subset needed for floating button)
const DEFAULT_FLOATING_BUTTON_SETTINGS = {
  feedDiscoveryEnabled: true,
  floatingButtonEnabled: true,
  stricterFeedRecognition: false,
}

/**
 * Get extension settings with defaults
 */
async function getSettings(): Promise<{ feedDiscoveryEnabled: boolean; floatingButtonEnabled: boolean; stricterFeedRecognition: boolean }> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SETTINGS)
    const stored = result[STORAGE_KEY_SETTINGS] as Partial<ExtensionSettings> | undefined
    return { ...DEFAULT_FLOATING_BUTTON_SETTINGS, ...stored }
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
    // Remove trailing slash, lowercase
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
 * (since the floating button only adds the first feed, we hide if any are queued)
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
 * Create RSS icon SVG
 */
function createRssIcon(): string {
  return LOGO_SVG
}

/**
 * Create spinner icon SVG
 */
function createSpinnerIcon(): string {
  return `
    <svg class="bab-icon bab-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  `
}

/**
 * Create close icon SVG
 */
function createCloseIcon(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  `
}

const ANIMATED_CHECKMARK: string = `
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    class="checkmark-svg"
  >
    <polyline class="checkmark-path" points="4 12 9 17 20 6"></polyline>
  </svg>
  `;

/**
 * Render the button content
 */
function renderButton(): void {
  if (!shadowRoot) return

  const container = shadowRoot.querySelector('.bab-floating-container')
  if (!container) return

  const primaryFeed = currentFeeds[0]
  const feedTitle = primaryFeed?.title || 'this blog'

  let buttonContent: string
  let buttonClass = 'bab-floating-button'

  if (isLoading) {
    buttonContent = `${createSpinnerIcon()}<span>Following...</span>`
    buttonClass += ' bab-loading'
  } else {
    buttonContent = `${createRssIcon()}<span>Follow</span>`
  }

  container.innerHTML = `
    <div style="position: relative;">
      <button
        class="${buttonClass}"
        title="Follow ${feedTitle}"
        aria-label="Subscribe to ${feedTitle} RSS feed"
      >
        ${buttonContent}
      </button>
      <button
        class="bab-dismiss-button"
        title="Don't show on this site"
        aria-label="Dismiss floating button for this site"
      >
        ${createCloseIcon()}
      </button>
      <div class="bab-dismiss-tooltip ${showDismissTooltip ? 'bab-visible' : ''}">
        <div>Don't show on this site?</div>
        <div class="bab-dismiss-tooltip-buttons">
          <button class="bab-dismiss-tooltip-button bab-dismiss-confirm">Yes, hide</button>
          <button class="bab-dismiss-tooltip-button bab-dismiss-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `

  // Attach event listeners
  const followButton = container.querySelector('.bab-floating-button')
  const dismissButton = container.querySelector('.bab-dismiss-button')
  const confirmButton = container.querySelector('.bab-dismiss-confirm')
  const cancelButton = container.querySelector('.bab-dismiss-cancel')

  followButton?.addEventListener('click', handleFollowClick)
  dismissButton?.addEventListener('click', handleDismissClick)
  confirmButton?.addEventListener('click', handleConfirmDismiss)
  cancelButton?.addEventListener('click', handleCancelDismiss)
}

/**
 * Show success state and hide button
 */
function showSuccess(): void {
  if (!shadowRoot) return

  const container = shadowRoot.querySelector('.bab-floating-container')
  if (!container) return

  container.innerHTML = `
    <div style="position: relative;">
      <button class="bab-floating-button bab-success">
        ${ANIMATED_CHECKMARK}<span>Following!</span>
      </button>
    </div>
  `

  // Auto-hide after success
  setTimeout(() => {
    hideButton()
  }, AUTO_HIDE_AFTER_MS)
}

/**
 * Handle follow button click
 */
async function handleFollowClick(): Promise<void> {
  if (isLoading || currentFeeds.length === 0) return

  const primaryFeed = currentFeeds[0]
  isLoading = true
  renderButton()

  try {
    const response = await browser.runtime.sendMessage({
      type: 'POPUP_SUBSCRIBE',
      feed: primaryFeed,
      pageUrl: window.location.href,
    }) as PopupSubscribeResponse

    if (response.success) {
      isLoading = false
      showSuccess()
    } else {
      console.error('[Floating Button] Subscription failed:', response.error)
      isLoading = false
      renderButton()
    }
  } catch (error) {
    console.error('[Floating Button] Error subscribing:', error)
    isLoading = false
    renderButton()
  }
}

/**
 * Handle dismiss button click
 */
function handleDismissClick(e: Event): void {
  e.stopPropagation()
  showDismissTooltip = true
  renderButton()
}

/**
 * Handle confirm dismiss
 */
async function handleConfirmDismiss(): Promise<void> {
  await dismissForDomain()
  hideButton()
}

/**
 * Handle cancel dismiss
 */
function handleCancelDismiss(): void {
  showDismissTooltip = false
  renderButton()
}

/**
 * Create and show the floating button
 */
function showButton(): void {
  if (isVisible || currentFeeds.length === 0) return

  // Create root element if needed
  if (!buttonRoot) {
    buttonRoot = document.createElement('div')
    buttonRoot.id = 'bab-floating-button-root'
    shadowRoot = buttonRoot.attachShadow({ mode: 'closed' })

    // Inject styles
    const styleSheet = document.createElement('style')
    styleSheet.textContent = FLOATING_BUTTON_STYLES
    shadowRoot.appendChild(styleSheet)

    // Create container
    const container = document.createElement('div')
    container.className = 'bab-floating-container bab-entering'
    shadowRoot.appendChild(container)

    document.body.appendChild(buttonRoot)
  }

  isVisible = true
  showDismissTooltip = false
  renderButton()

  // Remove entering animation class after animation completes
  setTimeout(() => {
    const container = shadowRoot?.querySelector('.bab-floating-container')
    if (container) {
      container.classList.remove('bab-entering')
    }
  }, 300)
}

/**
 * Hide and remove the floating button
 */
function hideButton(): void {
  if (!isVisible || !shadowRoot) return

  const container = shadowRoot.querySelector('.bab-floating-container')
  if (container) {
    container.classList.add('bab-exiting')

    // Remove after animation
    setTimeout(() => {
      buttonRoot?.remove()
      buttonRoot = null
      shadowRoot = null
      isVisible = false
    }, 200)
  } else {
    buttonRoot?.remove()
    buttonRoot = null
    shadowRoot = null
    isVisible = false
  }
}

/**
 * Handle feeds update from service worker
 */
async function handleFeedsUpdate(feeds: FeedLink[]): Promise<void> {
  // Skip if disabled or excluded
  if (isBlogsAreBackDomain()) return
  if (shouldExcludeUrl(window.location)) return

  // Check settings
  const settings = await getSettings()
  if (!settings.feedDiscoveryEnabled || !settings.floatingButtonEnabled) {
    hideButton()
    return
  }

  // Check if domain is dismissed
  if (await isDomainDismissed()) {
    return
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
    showButton()
  } else {
    hideButton()
  }
}

/**
 * Request current feeds from service worker
 * Uses GET_FLOATING_BUTTON_FEEDS which gets the tab ID from the sender
 */
async function requestCurrentFeeds(): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_FLOATING_BUTTON_FEEDS',
    }) as { feeds?: FeedLink[] } | undefined

    if (response?.feeds && response.feeds.length > 0) {
      await handleFeedsUpdate(response.feeds)
    }
  } catch (error) {
    // Silently fail - we'll rely on the FLOATING_BUTTON_UPDATE message instead
    console.log('[Floating Button] Failed to request feeds:', error)
  }
}

/**
 * Listen for messages from service worker
 */
browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message
  ) {
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
