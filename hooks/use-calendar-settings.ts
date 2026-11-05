'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { broadcastSync, subscribeToSync } from '@/lib/sync-bus'
import {
  getInstitutionSetting,
  updateInstitutionSetting,
} from '@/app/actions/settings'
import {
  getCachedData,
  setCachedData,
  fetchWithClientCache,
} from '@/lib/cache/client-query-cache'

export interface CalendarSettings {
  startDay: 'sun' | 'mon'
  sundayWeekend: boolean
  saturdayWeekend: boolean
}

const STORAGE_KEY = 'lmr_calendar_settings'

// Statutory baseline in Nepal: Saturday is statutory weekly off, Sunday is open
const DEFAULT_SETTINGS: CalendarSettings = {
  startDay: 'sun',
  sundayWeekend: false,
  saturdayWeekend: true,
}

function getInitialCalendarSettings(initialSettings?: CalendarSettings | null): CalendarSettings {
  if (initialSettings && typeof initialSettings === 'object') {
    return {
      startDay: initialSettings.startDay || DEFAULT_SETTINGS.startDay,
      sundayWeekend: typeof initialSettings.sundayWeekend === 'boolean' ? initialSettings.sundayWeekend : DEFAULT_SETTINGS.sundayWeekend,
      saturdayWeekend: typeof initialSettings.saturdayWeekend === 'boolean' ? initialSettings.saturdayWeekend : DEFAULT_SETTINGS.saturdayWeekend,
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') {
          return {
            startDay: parsed.startDay || DEFAULT_SETTINGS.startDay,
            sundayWeekend: typeof parsed.sundayWeekend === 'boolean' ? parsed.sundayWeekend : DEFAULT_SETTINGS.sundayWeekend,
            saturdayWeekend: typeof parsed.saturdayWeekend === 'boolean' ? parsed.saturdayWeekend : DEFAULT_SETTINGS.saturdayWeekend,
          }
        }
      }
    } catch (e) {}
  }
  return DEFAULT_SETTINGS
}

// Module-level deduplication cache
let cachedSettingsPromise: Promise<CalendarSettings> | null = null
let lastFetchTime = 0
const CACHE_TTL = 30000 // 30 seconds

export function useCalendarSettings(initialSettings?: CalendarSettings | null) {
  const [settings, setSettings] = useState<CalendarSettings>(() => {
    const cached = getCachedData<CalendarSettings>('settings:calendar')
    return cached || getInitialCalendarSettings(initialSettings)
  })
  const [mounted, setMounted] = useState(false)

  // Reconcile if server-passed initialSettings changes
  useEffect(() => {
    if (initialSettings && typeof initialSettings === 'object') {
      setSettings((prev) => {
        if (
          prev.startDay !== initialSettings.startDay ||
          prev.sundayWeekend !== initialSettings.sundayWeekend ||
          prev.saturdayWeekend !== initialSettings.saturdayWeekend
        ) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSettings))
            setCachedData('settings:calendar', initialSettings)
          } catch (e) {}
          return initialSettings
        }
        return prev
      })
    }
  }, [initialSettings])

  // 1. Initial hydration + Authoritative DB Reconcile + Supabase Realtime Subscription
  useEffect(() => {
    let isMounted = true
    setMounted(true)

    // A. Reconcile with PostgreSQL Single Source of Truth via Client Query Cache
    fetchWithClientCache<CalendarSettings>(
      'settings:calendar',
      () => getInstitutionSetting<CalendarSettings>('calendar_settings', settings),
      { staleTimeMs: 300_000 }
    ).then((dbSettings) => {
      if (isMounted && dbSettings) {
        setSettings((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(dbSettings)) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(dbSettings))
              setCachedData('settings:calendar', dbSettings)
            } catch (e) {}
            return dbSettings
          }
          return prev
        })
      }
    }).catch(() => {})

    // B. Supabase Realtime Subscription (Instant Multi-Device Sync)
    let channel: any = null
    if (isSupabaseConfigured()) {
      const supabase = createClient()
      try {
        const existing = supabase.getChannels().find((c: any) => c.topic === 'realtime:realtime-calendar-settings')
        if (existing) {
          supabase.removeChannel(existing)
        }
      } catch (e) {}
      channel = supabase
        .channel('realtime-calendar-settings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'institution_settings',
            filter: 'key=eq.calendar_settings',
          },
          (payload: any) => {
            if (payload.new && payload.new.value && isMounted) {
              const remote = payload.new.value as CalendarSettings
              setSettings(remote)
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(remote))
                setCachedData('settings:calendar', remote)
              } catch (e) {}
            }
          }
        )
        .subscribe()
    }

    // C. Cross-tab sync listeners
    const handleSync = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored && isMounted) {
          setSettings(JSON.parse(stored))
        }
      } catch (err) {}
    }

    window.addEventListener('storage', handleSync)
    window.addEventListener('lmr_settings_updated', handleSync)
    const unsubBus = subscribeToSync('settings', (msg) => {
      if (msg && msg.payload && isMounted) setSettings(msg.payload)
    })

    return () => {
      isMounted = false
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('lmr_settings_updated', handleSync)
      unsubBus()
      if (channel && isSupabaseConfigured()) {
        const supabase = createClient()
        supabase.removeChannel(channel)
      }
    }
  }, [])

  // 2. Authoritative Settings Mutation
  const updateSettings = useCallback(
    async (newSettings: Partial<CalendarSettings>) => {
      // Auto-align startDay with sundayWeekend
      let computedStartDay = newSettings.startDay || settings.startDay
      if (newSettings.sundayWeekend !== undefined && newSettings.startDay === undefined) {
        computedStartDay = newSettings.sundayWeekend ? 'mon' : 'sun'
      }

      const updated: CalendarSettings = {
        ...settings,
        ...newSettings,
        startDay: computedStartDay,
      }

      // Optimistic local update
      setSettings(updated)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        setCachedData('settings:calendar', updated)
        window.dispatchEvent(new Event('lmr_settings_updated'))
        broadcastSync('settings', updated)
      } catch (e) {
        console.warn('Failed to save calendar settings locally', e)
      }

      // Invalidate module cache
      cachedSettingsPromise = Promise.resolve(updated)
      lastFetchTime = Date.now()

      // Authoritative remote persistence in PostgreSQL
      try {
        const res = await updateInstitutionSetting('calendar_settings', updated)
        if (!res.success) {
          console.warn('[LMR] Remote settings update warning:', res.error)
        }
      } catch (err) {
        console.error('[LMR] Remote updateInstitutionSetting failed:', err)
      }
    },
    [settings]
  )

  return {
    settings,
    mounted,
    updateSettings,
    startDay: settings.startDay,
    sundayWeekend: settings.sundayWeekend,
    saturdayWeekend: settings.saturdayWeekend,
  }
}
