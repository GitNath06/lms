'use client'

import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export type SyncDomain =
  | 'holidays'
  | 'schedule'
  | 'schedules'
  | 'incidents'
  | 'users'
  | 'infrastructure'
  | 'logs'
  | 'settings'

const BROADCAST_CHANNEL_NAME = 'labsync-realtime-bus'

// Broadcast a sync event across all tabs and connected clients
export function broadcastSync(domain: SyncDomain, payload?: any) {
  if (typeof window === 'undefined') return

  const timestamp = Date.now()
  const eventKey = `labsync_event_${domain}`

  // 1. Local storage event (triggers 'storage' in all other browser tabs of this domain)
  try {
    localStorage.setItem(
      eventKey,
      JSON.stringify({ domain, payload, timestamp, rand: Math.random() })
    )
  } catch (e) {}

  // 2. Local window event (triggers listeners in the current tab immediately)
  window.dispatchEvent(
    new CustomEvent(`labsync:${domain}`, {
      detail: { domain, payload, timestamp },
    })
  )

  // 3. Supabase Realtime Broadcast (syncs to other active browsers/devices over the web)
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      const channel = supabase.channel(BROADCAST_CHANNEL_NAME)
      if (typeof (channel as any).httpSend === 'function') {
        ;(channel as any)
          .httpSend(domain, { domain, payload, timestamp })
          .catch(() => {})
      } else {
        channel
          .send({
            type: 'broadcast',
            event: domain,
            payload: { domain, payload, timestamp },
          })
          .catch(() => {})
      }
    } catch (err) {
      console.warn('Realtime broadcast warning:', err)
    }
  }
}

// React hook / listener for auto-updating components when changes occur anywhere
export function subscribeToSync(
  domain: SyncDomain | 'all',
  callback: (data: { domain: string; payload?: any; timestamp: number }) => void
) {
  if (typeof window === 'undefined') return () => {}

  // Handle local window events
  const handleLocal = (e: Event) => {
    const custom = e as CustomEvent
    callback(custom.detail)
  }

  // Handle cross-tab storage events
  const handleStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith('labsync_event_')) {
      try {
        const parsed = JSON.parse(e.newValue || '{}')
        if (domain === 'all' || parsed.domain === domain) {
          callback(parsed)
        }
      } catch (err) {}
    }
  }

  const eventName = domain === 'all' ? 'labsync:all' : `labsync:${domain}`
  window.addEventListener(eventName, handleLocal)
  window.addEventListener('storage', handleStorage)

  // Supabase Realtime subscription
  let supabaseChannel: any = null
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      supabaseChannel = supabase
        .channel(BROADCAST_CHANNEL_NAME)
        .on('broadcast', { event: domain === 'all' ? '*' : domain }, (payload) => {
          if (payload?.payload) {
            callback(payload.payload)
          }
        })
        .subscribe()
    } catch (err) {
      console.warn('Realtime subscribe warning:', err)
    }
  }

  return () => {
    window.removeEventListener(eventName, handleLocal)
    window.removeEventListener('storage', handleStorage)
    if (supabaseChannel) {
      try {
        const supabase = createClient()
        supabase.removeChannel(supabaseChannel)
      } catch (e) {}
    }
  }
}
