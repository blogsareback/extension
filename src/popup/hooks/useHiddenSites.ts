import { useState, useEffect, useCallback } from 'react'
import browser from '@/utils/browser'
import type { Storage } from 'webextension-polyfill'
import { STORAGE_KEY_FLOATING_BUTTON_DISMISSED } from '@/utils/constants'

interface UseHiddenSitesResult {
  sites: string[]
  loading: boolean
  error: string | null
  updateSites: (sites: string[]) => Promise<void>
  removeSite: (site: string) => Promise<void>
  clearAllSites: () => Promise<void>
}

export function useHiddenSites(): UseHiddenSitesResult {
  const [sites, setSites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSites = useCallback(async () => {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY_FLOATING_BUTTON_DISMISSED)
      const storedSites = (result[STORAGE_KEY_FLOATING_BUTTON_DISMISSED] as string[] | undefined) || []
      setSites(storedSites.sort())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hidden sites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  // Listen for storage changes to auto-refresh
  useEffect(() => {
    const listener = (changes: Record<string, Storage.StorageChange>) => {
      if (changes[STORAGE_KEY_FLOATING_BUTTON_DISMISSED]) {
        const newSites = (changes[STORAGE_KEY_FLOATING_BUTTON_DISMISSED].newValue as string[] | undefined) || []
        setSites(newSites.sort())
      }
    }

    browser.storage.onChanged.addListener(listener)
    return () => browser.storage.onChanged.removeListener(listener)
  }, [])

  const updateSites = useCallback(async (newSites: string[]) => {
    try {
      // Normalize: trim whitespace, lowercase, remove empty strings, dedupe
      const normalized = [...new Set(
        newSites
          .map(s => s.trim().toLowerCase())
          .filter(s => s.length > 0)
      )].sort()

      await browser.storage.local.set({
        [STORAGE_KEY_FLOATING_BUTTON_DISMISSED]: normalized,
      })
      setSites(normalized)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hidden sites')
    }
  }, [])

  const removeSite = useCallback(async (site: string) => {
    const newSites = sites.filter(s => s !== site)
    await updateSites(newSites)
  }, [sites, updateSites])

  const clearAllSites = useCallback(async () => {
    await updateSites([])
  }, [updateSites])

  return {
    sites,
    loading,
    error,
    updateSites,
    removeSite,
    clearAllSites,
  }
}
