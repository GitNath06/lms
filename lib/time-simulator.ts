'use client'

/**
 * ⏱️ LabSync Time Simulator & Dev Time Travel Engine
 * Enables seamless simulation of academic routine periods, weeks, days,
 * and custom dates without snapping back to current real-world week.
 */

const STORAGE_KEY = 'lmr_simulated_time'
export const TIME_TRAVEL_EVENT = 'lmr-time-travel-change'

interface StoredSimTime {
  baseTime: number // Timestamp in ms
  setAt: number    // Real Date.now() when baseTime was set
}

/**
 * Retrieves the currently effective Date.
 * If time simulation is active, returns the simulated timestamp plus real elapsed milliseconds
 * so clocks and interval countdowns tick naturally.
 */
export function getEffectiveDate(): Date {
  if (typeof window === 'undefined') {
    return new Date()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Date()

    const parsed: StoredSimTime = JSON.parse(raw)
    if (!parsed || !parsed.baseTime || !parsed.setAt) {
      return new Date()
    }

    const elapsed = Date.now() - parsed.setAt
    return new Date(parsed.baseTime + elapsed)
  } catch {
    return new Date()
  }
}

/**
 * Checks if the system is currently in simulated time mode.
 */
export function isSimulatingTime(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Sets a new simulated target Date.
 * Pass `null` to reset back to live real-world system clock.
 */
export function setSimulatedTime(targetDate: Date | null): void {
  if (typeof window === 'undefined') return

  try {
    if (!targetDate) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      const payload: StoredSimTime = {
        baseTime: targetDate.getTime(),
        setAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    }

    window.dispatchEvent(new CustomEvent(TIME_TRAVEL_EVENT))
  } catch (e) {
    console.error('Failed to set simulated time:', e)
  }
}

/**
 * Step simulated time by minutes.
 */
export function stepSimulatedMinutes(minutes: number): void {
  const current = getEffectiveDate()
  const updated = new Date(current.getTime() + minutes * 60 * 1000)
  setSimulatedTime(updated)
}

/**
 * Step simulated time by days (preserving current hour & minute).
 */
export function stepSimulatedDays(days: number): void {
  const current = getEffectiveDate()
  const updated = new Date(current)
  updated.setDate(updated.getDate() + days)
  setSimulatedTime(updated)
}

/**
 * Step simulated time by weeks (preserving day of week, hour & minute).
 */
export function stepSimulatedWeeks(weeks: number): void {
  stepSimulatedDays(weeks * 7)
}

/**
 * Jumps to a specific day of the week (0 = Sun .. 6 = Sat)
 * WITHIN THE CURRENTLY ACTIVE SIMULATED WEEK (does not snap back to real system date).
 */
export function jumpToDayInActiveWeek(dayOfWeek: number, hours?: number, minutes?: number): void {
  const current = getEffectiveDate()
  const currentDay = current.getDay()
  const diff = dayOfWeek - currentDay
  const target = new Date(current)
  target.setDate(target.getDate() + diff)
  if (hours !== undefined) target.setHours(hours)
  if (minutes !== undefined) target.setMinutes(minutes)
  setSimulatedTime(target)
}

/**
 * Sets a specific time of day (hours, minutes) while PRESERVING the currently simulated date & week.
 */
export function jumpToTimeOfDay(hours: number, minutes: number): void {
  const current = getEffectiveDate()
  const target = new Date(current)
  target.setHours(hours, minutes, 0, 0)
  setSimulatedTime(target)
}

/**
 * Sets an exact custom date & time string from inputs (e.g. date: "2026-09-24", time: "14:15").
 */
export function setExactDateTime(dateStr: string, timeStr?: string): void {
  if (!dateStr) return
  const [y, m, d] = dateStr.split('-').map(Number)
  const current = getEffectiveDate()
  let h = current.getHours()
  let min = current.getMinutes()

  if (timeStr) {
    const [hPart, mPart] = timeStr.split(':').map(Number)
    if (!isNaN(hPart)) h = hPart
    if (!isNaN(mPart)) min = mPart
  }

  const target = new Date(y, m - 1, d, h, min, 0, 0)
  setSimulatedTime(target)
}

/**
 * Clears any active simulation and restores the live system clock.
 */
export function resetToLiveTime(): void {
  setSimulatedTime(null)
}

/**
 * Quick Academic Period Presets for jumping to exact daytime periods.
 */
export interface AcademicPeriodTarget {
  id: string
  name: string
  label: string
  timeRange: string
  hours: number
  minutes: number
  isBreak?: boolean
}

export const ACADEMIC_PERIOD_TARGETS: AcademicPeriodTarget[] = [
  { id: 't1', name: 'Pre-Period', label: '09:30 AM', timeRange: '09:15 - 10:00', hours: 9, minutes: 30 },
  { id: 't2', name: 'Period 1', label: '10:20 AM', timeRange: '10:10 - 11:00', hours: 10, minutes: 20 },
  { id: 't3', name: 'Period 2', label: '11:15 AM', timeRange: '11:00 - 11:45', hours: 11, minutes: 15 },
  { id: 't4', name: 'Period 3', label: '12:00 PM', timeRange: '11:45 - 12:30', hours: 12, minutes: 0 },
  { id: 't5', name: 'Period 4', label: '12:45 PM', timeRange: '12:30 - 01:15', hours: 12, minutes: 45 },
  { id: 't6', name: 'Break / Tiffin', label: '01:25 PM', timeRange: '01:15 - 01:45', hours: 13, minutes: 25, isBreak: true },
  { id: 't7', name: 'Period 5', label: '02:00 PM', timeRange: '01:45 - 02:30', hours: 14, minutes: 0 },
  { id: 't8', name: 'Period 6', label: '02:45 PM', timeRange: '02:30 - 03:15', hours: 14, minutes: 45 },
  { id: 't9', name: 'Period 7', label: '03:30 PM', timeRange: '03:15 - 04:05', hours: 15, minutes: 30 },
  { id: 't10', name: 'Period 8', label: '04:15 PM', timeRange: '04:05 - 04:50', hours: 16, minutes: 15 },
  { id: 'end', name: 'School End', label: '05:00 PM', timeRange: 'Post-School Audit', hours: 17, minutes: 0 },
]

export interface TimePreset {
  id: string
  label: string
  periodLabel: string
  description: string
  icon: string
  getDate: () => Date
}

/**
 * Backward-compatible preset generator that operates relative to active week or next occurrence.
 */
export function getNextOrCurrentDay(dayOfWeek: number, hours: number, minutes: number): Date {
  const current = getEffectiveDate()
  const currentDay = current.getDay()
  let diff = dayOfWeek - currentDay
  if (diff < 0) {
    diff += 7
  }
  const target = new Date(current)
  target.setDate(target.getDate() + diff)
  target.setHours(hours, minutes, 0, 0)
  return target
}

export const TIME_PRESETS: TimePreset[] = [
  {
    id: 'mon_period_1',
    label: 'Mon 10:20 AM',
    periodLabel: 'Period 1 (Live Practical)',
    description: 'Active session cockpit • Live countdown • Roll-call ready',
    icon: '🌅',
    getDate: () => getNextOrCurrentDay(1, 10, 20),
  },
  {
    id: 'mon_period_3',
    label: 'Mon 12:00 PM',
    periodLabel: 'Period 3 (Midday)',
    description: 'Period 3 active • Physics & Computer labs occupied',
    icon: '🔬',
    getDate: () => getNextOrCurrentDay(1, 12, 0),
  },
  {
    id: 'mon_lunch',
    label: 'Mon 01:25 PM',
    periodLabel: 'Break / Tiffin',
    description: 'Mid-day intermission • Backlog review state',
    icon: '🥪',
    getDate: () => getNextOrCurrentDay(1, 13, 25),
  },
  {
    id: 'tue_period_5',
    label: 'Tue 02:00 PM',
    periodLabel: 'Period 5 (Afternoon)',
    description: 'Afternoon practicals • Chemistry & Computer labs',
    icon: '🧪',
    getDate: () => getNextOrCurrentDay(2, 14, 0),
  },
  {
    id: 'mon_after_school',
    label: 'Mon 05:00 PM',
    periodLabel: 'School Concluded',
    description: 'Day finished • End-of-day compliance audit summary',
    icon: '🌆',
    getDate: () => getNextOrCurrentDay(1, 17, 0),
  },
  {
    id: 'sun_recess',
    label: 'Sunday 11:00 AM',
    periodLabel: 'Weekend Recess',
    description: 'Zero sessions • Calm off-hours state',
    icon: '🏖️',
    getDate: () => getNextOrCurrentDay(0, 11, 0),
  },
]
