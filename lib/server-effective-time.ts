import { cookies } from 'next/headers'

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export interface ServerEffectiveTime {
  effectiveDate: Date
  effectiveDateStr: string // YYYY-MM-DD in Nepal Standard Time
  dayKey: DayKey
  dayIndex: number // 0 = Sun .. 6 = Sat
  currentMinutes: number // minutes from midnight in Nepal Standard Time
  isSimulated: boolean
}

/**
 * Parses time string like "10:10" or "01:15" into minutes from midnight.
 * Treats afternoon periods 1-6 as PM (13:00 - 18:00).
 */
export function parseScheduleTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.trim().split(':')
  let hours = parseInt(parts[0], 10) || 0
  const mins = parseInt(parts[1], 10) || 0
  if (hours >= 1 && hours <= 6) {
    hours += 12
  }
  return hours * 60 + mins
}

/**
 * Derives the active system date/time on the server.
 * Reads the `lmr_simulated_time` cookie if present (set by TimeTravelController),
 * otherwise defaults to live real-world time in Nepal Standard Time (UTC+5:45).
 */
export async function getServerEffectiveTime(
  overrideTimestampMs?: number
): Promise<ServerEffectiveTime> {
  let date = new Date()
  let isSimulated = false

  // Strict Production Gate: Only honor simulated time / cookie overrides during local development
  if (process.env.NODE_ENV === 'development') {
    if (typeof overrideTimestampMs === 'number' && !isNaN(overrideTimestampMs) && overrideTimestampMs > 0) {
      date = new Date(overrideTimestampMs)
      isSimulated = true
    } else {
      try {
        const cookieStore = await cookies()
        const simCookie = cookieStore.get('lmr_simulated_time')?.value
        if (simCookie) {
          const parsed = JSON.parse(decodeURIComponent(simCookie))
          if (parsed && parsed.baseTime && parsed.setAt) {
            const elapsed = Date.now() - parsed.setAt
            date = new Date(parsed.baseTime + elapsed)
            isSimulated = true
          }
        }
      } catch {
        // Fallback to real wall-clock date
      }
    }
  }

  // Nepal Standard Time (UTC +5 hours 45 mins)
  const nptMs = date.getTime() + 5.75 * 3600000
  const nptDate = new Date(nptMs)
  const dayIndex = nptDate.getUTCDay()
  const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const dayKey = DAY_KEYS[dayIndex]
  const currentMinutes = nptDate.getUTCHours() * 60 + nptDate.getUTCMinutes()
  const year = nptDate.getUTCFullYear()
  const month = String(nptDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nptDate.getUTCDate()).padStart(2, '0')
  const effectiveDateStr = `${year}-${month}-${day}`

  return {
    effectiveDate: date,
    effectiveDateStr,
    dayKey,
    dayIndex,
    currentMinutes,
    isSimulated,
  }
}
