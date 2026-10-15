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

/**
 * Parses any time string into 24-hour minutes from midnight using academic timetable semantics.
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const parsed = parseSlotTimeRange(timeStr)
  return parsed.startMin
}

/**
 * Universal Chronological Session Sorter
 * Correctly orders academic timetable slots by slot sequence and 24-hour start time,
 * eliminating 12-hour string sorting bugs where afternoon slots (e.g. 01:45 PM) appear before morning slots (10:10 AM).
 */
export function sortSessionsChronologically<T>(items: T[]): T[] {
  const slotOrder: Record<string, number> = {
    t1: 1, // Pre-Period (09:15 - 10:00)
    t2: 2, // Period 1 (10:10 - 11:00)
    t3: 3, // Period 2 (11:00 - 11:45)
    t4: 4, // Period 3 (11:45 - 12:30)
    t5: 5, // Period 4 (12:30 - 01:15)
    t6: 6, // Break / Tiffin (01:15 - 01:45)
    t7: 7, // Period 5 (01:45 - 02:30)
    t8: 8, // Period 6 (02:30 - 03:15)
    t9: 9, // Period 7 (03:15 - 04:05)
    t10: 10, // Period 8 (04:05 - 04:50)
  }

  return [...items].sort((a: any, b: any) => {
    const slotA = a.slot_id || a.slotId || ''
    const slotB = b.slot_id || b.slotId || ''
    const orderA = slotOrder[slotA] || 0
    const orderB = slotOrder[slotB] || 0

    if (orderA && orderB && orderA !== orderB) {
      return orderA - orderB
    }

    const timeA = parseTimeToMinutes(a.start_time || a.startTime || a.timeSlot || '')
    const timeB = parseTimeToMinutes(b.start_time || b.startTime || b.timeSlot || '')

    if (timeA !== timeB) {
      return timeA - timeB
    }

    // Tie-breaker: lab name / code (stable natural ordering)
    const labA = a.lab || a.lab_id || ''
    const labB = b.lab || b.lab_id || ''
    if (labA !== labB) {
      return labA.localeCompare(labB)
    }

    const subA = a.subject_name || a.subjectCode || ''
    const subB = b.subject_name || b.subjectCode || ''
    return subA.localeCompare(subB)
  })
}

