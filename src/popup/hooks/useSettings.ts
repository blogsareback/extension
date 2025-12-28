import { useState, useEffect, useCallback } from 'react'
import browser from '@/utils/browser'
import type { Storage } from 'webextension-polyfill'
import type {
  ExtensionSettings,
  GetSettingsResponse,
  UpdateSettingsResponse,
  ClearDataResponse,
} from '@/utils/types'
import { DEFAULT_SETTINGS } from '@/utils/types'
import { STORAGE_KEY_SETTINGS } from '@/utils/constants'

interface UseSettingsResult {
  settings: ExtensionSettings
  loading: boolean
  error: string | null
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>
  clearData: (dataType: 'queue' | 'stats' | 'all') => Promise<boolean>
  resetSettings: () => Promise<void>
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'GET_SETTINGS',
      })) as GetSettingsResponse

      if (response.type === 'SETTINGS_RESPONSE') {
        setSettings(response.settings)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Listen for storage changes to auto-refresh
  useEffect(() => {
    const listener = (changes: Record<string, Storage.StorageChange>) => {
      if (changes[STORAGE_KEY_SETTINGS]) {
        const newSettings = changes[STORAGE_KEY_SETTINGS].newValue
        if (newSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...newSettings })
        }
      }
    }

    browser.storage.onChanged.addListener(listener)
    return () => browser.storage.onChanged.removeListener(listener)
  }, [])

  const updateSettings = useCallback(
    async (updates: Partial<ExtensionSettings>) => {
      try {
        const response = (await browser.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: updates,
        })) as UpdateSettingsResponse

        if (response.type === 'UPDATE_SETTINGS_RESPONSE' && response.success) {
          setSettings(response.settings)
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update settings'
        )
      }
    },
    []
  )

  const clearData = useCallback(
    async (dataType: 'queue' | 'stats' | 'all'): Promise<boolean> => {
      try {
        const response = (await browser.runtime.sendMessage({
          type: 'CLEAR_DATA',
          dataType,
        })) as ClearDataResponse

        return response.success
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear data')
        return false
      }
    },
    []
  )

  const resetSettings = useCallback(async () => {
    await updateSettings(DEFAULT_SETTINGS)
  }, [updateSettings])

  return {
    settings,
    loading,
    error,
    updateSettings,
    clearData,
    resetSettings,
  }
}
