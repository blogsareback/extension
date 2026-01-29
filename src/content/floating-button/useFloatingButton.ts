import { useState, useCallback, useRef, useEffect } from 'react'
import browser from '../../utils/browser'
import type { FeedLink, PopupSubscribeResponse } from '../../utils/types'

interface UseFloatingButtonProps {
  feeds: FeedLink[]
  onDismiss: () => void
  onAutoHide: () => void
}

export function useFloatingButton({ feeds, onDismiss, onAutoHide }: UseFloatingButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [showDismissTooltip, setShowDismissTooltip] = useState(false)
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current)
      }
    }
  }, [])

  const handleFollowClick = useCallback(async () => {
    if (isLoading || feeds.length === 0) return

    const primaryFeed = feeds[0]
    setIsLoading(true)

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'POPUP_SUBSCRIBE',
        feed: primaryFeed,
        pageUrl: window.location.href,
      })) as PopupSubscribeResponse

      if (response.success) {
        setIsLoading(false)
        setIsSuccess(true)
        autoHideTimerRef.current = setTimeout(() => {
          onAutoHide()
        }, 3000)
      } else {
        console.error('[Floating Button] Subscription failed:', response.error)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('[Floating Button] Error subscribing:', error)
      setIsLoading(false)
    }
  }, [isLoading, feeds, onAutoHide])

  const handleDismissClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDismissTooltip(true)
  }, [])

  const handleConfirmDismiss = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  const handleCancelDismiss = useCallback(() => {
    setShowDismissTooltip(false)
  }, [])

  return {
    isLoading,
    isSuccess,
    showDismissTooltip,
    handleFollowClick,
    handleDismissClick,
    handleConfirmDismiss,
    handleCancelDismiss,
  }
}
