import { useState, useEffect, useCallback } from 'react'
import browser from '@/utils/browser'
import type { Storage } from 'webextension-polyfill'
import type {
  CustomBlogUpdatesState,
  GetCustomBlogUpdatesResponse,
  ForceCheckCustomBlogUpdatesResponse,
} from '@/utils/types'
import { STORAGE_KEY_CUSTOM_BLOG_UPDATES } from '@/utils/constants'

interface UseCustomBlogUpdatesResult {
  state: CustomBlogUpdatesState | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  forceCheck: () => Promise<void>
  isRefreshing: boolean
}

export function useCustomBlogUpdates(): UseCustomBlogUpdatesResult {
  const [state, setState] = useState<CustomBlogUpdatesState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_CUSTOM_BLOG_UPDATES',
      })) as GetCustomBlogUpdatesResponse

      if (response.type === 'CUSTOM_BLOG_UPDATES_RESPONSE') {
        setState(response.state)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load custom blog updates'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const forceCheck = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'FORCE_CHECK_CUSTOM_BLOG_UPDATES',
      })) as ForceCheckCustomBlogUpdatesResponse

      if (!response.success) {
        setError(response.error || 'Failed to check for updates')
      }
      // State will be updated via storage listener
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check for updates'
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Listen for storage changes to auto-refresh
  useEffect(() => {
    const listener = (changes: Record<string, Storage.StorageChange>) => {
      if (changes[STORAGE_KEY_CUSTOM_BLOG_UPDATES]) {
        const newValue = changes[STORAGE_KEY_CUSTOM_BLOG_UPDATES]
          .newValue as CustomBlogUpdatesState | undefined
        setState(newValue || null)
      }
    }

    browser.storage.onChanged.addListener(listener)
    return () => browser.storage.onChanged.removeListener(listener)
  }, [])

  return {
    state,
    loading,
    error,
    refresh: fetchState,
    forceCheck,
    isRefreshing,
  }
}
