/**
 * Behavior Hook for Floating Button
 *
 * Handles different behavior modes for how the button appears and stays visible.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ButtonBehavior } from '../../utils/types'

interface UseBehaviorProps {
  behavior: ButtonBehavior
  isActive: boolean // Whether the button is currently shown
}

interface UseBehaviorResult {
  isVisible: boolean
  isFaded: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

// Auto-fade delay in milliseconds
const AUTO_FADE_DELAY = 5000

// Scroll threshold for scroll-up behavior (in pixels)
const SCROLL_THRESHOLD = 50

// How far from bottom to trigger article-end (percentage)
const ARTICLE_END_THRESHOLD = 0.8

export function useBehavior({ behavior, isActive }: UseBehaviorProps): UseBehaviorResult {
  // State
  const [isVisible, setIsVisible] = useState(behavior === 'always' || behavior === 'auto-fade')
  const [isFaded, setIsFaded] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  // Refs
  const lastScrollY = useRef(0)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasShownRef = useRef(false)

  // Clear fade timeout
  const clearFadeTimeout = useCallback(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }
  }, [])

  // Mouse event handlers
  const onMouseEnter = useCallback(() => {
    setIsHovering(true)
    if (behavior === 'auto-fade') {
      setIsFaded(false)
      clearFadeTimeout()
    }
  }, [behavior, clearFadeTimeout])

  const onMouseLeave = useCallback(() => {
    setIsHovering(false)
    if (behavior === 'auto-fade') {
      // Start fade timer again
      fadeTimeoutRef.current = setTimeout(() => {
        setIsFaded(true)
      }, AUTO_FADE_DELAY)
    }
  }, [behavior])

  // Handle 'always' behavior - always visible
  useEffect(() => {
    if (behavior === 'always' && isActive) {
      setIsVisible(true)
      setIsFaded(false)
    }
  }, [behavior, isActive])

  // Handle 'auto-fade' behavior
  useEffect(() => {
    if (behavior !== 'auto-fade' || !isActive) return

    setIsVisible(true)
    setIsFaded(false)

    // Start fade timer
    fadeTimeoutRef.current = setTimeout(() => {
      if (!isHovering) {
        setIsFaded(true)
      }
    }, AUTO_FADE_DELAY)

    return () => clearFadeTimeout()
  }, [behavior, isActive, isHovering, clearFadeTimeout])

  // Handle 'scroll-up' behavior - show when scrolling up
  useEffect(() => {
    if (behavior !== 'scroll-up' || !isActive) return

    // Initially hidden
    setIsVisible(false)

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDelta = currentScrollY - lastScrollY.current

      if (scrollDelta < -SCROLL_THRESHOLD) {
        // Scrolling up - show button
        setIsVisible(true)
      } else if (scrollDelta > SCROLL_THRESHOLD) {
        // Scrolling down - hide button
        setIsVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    // Initialize
    lastScrollY.current = window.scrollY

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [behavior, isActive])

  // Handle 'article-end' behavior - show when near bottom
  useEffect(() => {
    if (behavior !== 'article-end' || !isActive) return

    // Initially hidden
    setIsVisible(false)
    hasShownRef.current = false

    const handleScroll = () => {
      // Once shown, stay shown
      if (hasShownRef.current) return

      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = document.documentElement.clientHeight
      const scrollTop = window.scrollY

      // Calculate scroll progress (0 to 1)
      const scrollProgress = (scrollTop + clientHeight) / scrollHeight

      if (scrollProgress >= ARTICLE_END_THRESHOLD) {
        setIsVisible(true)
        hasShownRef.current = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Check immediately in case page is short or already scrolled
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [behavior, isActive])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearFadeTimeout()
  }, [clearFadeTimeout])

  return {
    isVisible,
    isFaded: behavior === 'auto-fade' ? isFaded : false,
    onMouseEnter,
    onMouseLeave,
  }
}
