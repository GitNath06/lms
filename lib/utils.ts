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
    const [h, m] = t.split(':').map((num) => parseInt(num, 10))
    if (isNaN(h)) return 0
    return h * 60 + (isNaN(m) ? 0 : m)
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
