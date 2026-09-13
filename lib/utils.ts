import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ParsedTimeRange {
  startTime: string
  endTime: string
  startMin: number
  endMin: number
  durationMin: number
  isBreak: boolean
}

/**
 * Parses any time slot string (e.g. "10:10 - 11:00", "Period 1 (10:10 - 11:00)", "10:10")
 * into normalized start time, end time, and 24h minute numbers.
 */
export function parseSlotTimeRange(labelOrSlot: string): ParsedTimeRange {
  if (!labelOrSlot) {
    return {
      startTime: '10:10',
      endTime: '11:00',
      startMin: 610,
      endMin: 660,
      durationMin: 50,
      isBreak: false,
    }
  }

  let timeSegment = labelOrSlot
  const parenMatch = labelOrSlot.match(/\(([^)]+)\)/)
  if (parenMatch) {
    timeSegment = parenMatch[1]
  }

  const isBreak = /break|tiffin|lunch|recess/i.test(labelOrSlot)

  const parts = timeSegment.split('-').map((s) => s.trim())
  const startTime = parts[0] || '10:10'
  const endTime = parts[1] || parts[0] || '11:00'

  const toMinutes = (t: string): number => {
    const raw = t.trim()
    const isExplicitPm = /pm/i.test(raw)
    const isExplicitAm = /am/i.test(raw)

    const cleaned = raw.replace(/[^\d:]/g, '')
    const [hStr, mStr] = cleaned.split(':')
    let h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10) || 0

    if (isNaN(h)) return 0

    if (isExplicitPm) {
      if (h < 12) h += 12
    } else if (isExplicitAm) {
      if (h === 12) h = 0
    } else {
      // In academic day-school schedules (starts ~09:00 AM, concludes ~05:00 PM):
      // Afternoon hours 1..7 (e.g. 01:15, 01:45, 02:30, 03:15, 04:05, 04:50) are PM (13:00 to 17:00).
      // Morning hours 8..11 (e.g. 09:15, 10:10, 11:00, 11:45) are AM.
      // Hour 12 (12:30) is Midday (12:00 PM).
      if (h >= 1 && h <= 7) {
        h += 12
      }
    }

    return h * 60 + m
  }

  const startMin = toMinutes(startTime)
  const endMin = toMinutes(endTime)
  const durationMin = Math.max(0, endMin - startMin)

  return {
    startTime,
    endTime,
    startMin,
    endMin,
    durationMin,
    isBreak,
  }
}

/**
 * Validates whether a given string is a standard RFC4122 v1-v5 UUID.
 */
export function isValidUuid(id?: string | null): boolean {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}
