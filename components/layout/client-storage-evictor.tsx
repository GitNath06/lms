'use client'

import { useEffect } from 'react'
import { getCachedData, hydrateCacheFromIndexedDB } from '@/lib/cache/client-query-cache'

const PROTOTYPE_STORAGE_KEYS = [
  'lmr_admin_labs_v2',
  'lmr_admin_faculty_v2',
  'lmr_admin_classes_v2',
  'lmr_admin_subjects_v2',
  'lab_master_routine_2083_v6',
  'lmr_admin_periods_v2',
  'lmr_admin_incident_categories_v2',
  'lmr_admin_incident_settings_v2',
]

/**
 * Runs on mount to unconditionally purge stale prototype mock states from the user's browser localStorage.
 * Prevents phantom hardcoded entities from overriding canonical PostgreSQL data even if legacy hooks temporarily re-write them.
 */
export default function ClientStorageEvictor() {
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      let evictedAny = false
      PROTOTYPE_STORAGE_KEYS.forEach((key) => {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key)
          evictedAny = true
        }
      })
      if (evictedAny) {
        window.dispatchEvent(new Event('infrastructure-updated'))
      }

      // Cold-start hydration: restore cached snapshots from IndexedDB (<25ms)
      const user = getCachedData<any>('auth:current-user-profile')
      const uid = user?.id || 'anonymous'
      hydrateCacheFromIndexedDB(uid).catch(() => {})
    } catch (e) {
      // Ignore private browsing or storage quota errors
    }
  }, [])

  return null
}
