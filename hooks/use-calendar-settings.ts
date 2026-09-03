'use client'

import { useState, useEffect } from 'react'

export interface CalendarSettings {
  startDay: 'sun' | 'mon'
  sundayWeekend: boolean
  saturdayWeekend: boolean
}

const STORAGE_KEY = 'lmr_calendar_settings'

const DEFAULT_SETTINGS: CalendarSettings = {
  startDay: 'sun',
  sundayWeekend: false, // Default in Nepal: Sunday is active working day
  saturdayWeekend: true, // Saturday is official weekly off
}

export function useCalendarSettings() {
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSettings(JSON.parse(stored))
      }
    } catch (e) {
      console.warn('Failed to load calendar settings from localStorage', e)
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setSettings(JSON.parse(e.newValue))
        } catch (err) {}
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('lmr_settings_updated', (() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) setSettings(JSON.parse(stored))
      } catch (err) {}
    }) as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const updateSettings = (newSettings: Partial<CalendarSettings>) => {
    // When sundayWeekend is updated, auto-align startDay:
    // If Sunday is marked as holiday -> start week from Monday
    // If Sunday is marked as working day -> start week from Sunday
    let computedStartDay = newSettings.startDay || settings.startDay
    if (newSettings.sundayWeekend !== undefined && newSettings.startDay === undefined) {
      computedStartDay = newSettings.sundayWeekend ? 'mon' : 'sun'
    }

    const updated: CalendarSettings = {
      ...settings,
      ...newSettings,
      startDay: computedStartDay,
    }

    setSettings(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new Event('lmr_settings_updated'))
    } catch (e) {
      console.warn('Failed to save calendar settings to localStorage', e)
    }
  }

  return {
    settings,
    mounted,
    updateSettings,
    startDay: settings.startDay,
    sundayWeekend: settings.sundayWeekend,
    saturdayWeekend: settings.saturdayWeekend,
  }
}
