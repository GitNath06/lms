'use client'

import { useState, useEffect } from 'react'
import { getNepaliDate, NepaliDateInfo } from '@/lib/nepali-date'
import { MASTER_TIME_SLOTS, MASTER_ROUTINE, MasterRoutineItem, DayKey } from '@/lib/master-data'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'

interface PeriodMinuteRange {
  id: string
  name: string
  startMin: number
  endMin: number
}

const PERIOD_RANGES: PeriodMinuteRange[] = [
  { id: 't1', name: 'Pre-Period', startMin: 9 * 60 + 15, endMin: 10 * 60 + 0 }, // 09:15 - 10:00
  { id: 't2', name: 'Period 1', startMin: 10 * 60 + 10, endMin: 11 * 60 + 0 }, // 10:10 - 11:00
  { id: 't3', name: 'Period 2', startMin: 11 * 60 + 0, endMin: 11 * 60 + 45 }, // 11:00 - 11:45
  { id: 't4', name: 'Period 3', startMin: 11 * 60 + 45, endMin: 12 * 60 + 30 }, // 11:45 - 12:30
  { id: 't5', name: 'Period 4', startMin: 12 * 60 + 30, endMin: 13 * 60 + 15 }, // 12:30 - 13:15
  { id: 't6', name: 'Break / Tiffin', startMin: 13 * 60 + 15, endMin: 13 * 60 + 45 }, // 13:15 - 13:45
  { id: 't7', name: 'Period 5', startMin: 13 * 60 + 45, endMin: 14 * 60 + 30 }, // 13:45 - 14:30
  { id: 't8', name: 'Period 6', startMin: 14 * 60 + 30, endMin: 15 * 60 + 15 }, // 14:30 - 15:15
  { id: 't9', name: 'Period 7', startMin: 15 * 60 + 15, endMin: 16 * 60 + 5 }, // 15:15 - 16:05
  { id: 't10', name: 'Period 8', startMin: 16 * 60 + 5, endMin: 16 * 60 + 50 }, // 16:05 - 16:50
]

export interface LiveScheduleState {
  mounted: boolean
  now: Date
  timeString: string
  nepaliDate: NepaliDateInfo
  dayKey: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  isWeekend: boolean // Saturday in Nepal
  activeSlotId: string | null
  activePeriodName: string
  minutesRemaining: number
  activeSessions: MasterRoutineItem[]
  todaySessions: MasterRoutineItem[]
  upcomingSessions: MasterRoutineItem[]
}

export function useLiveSchedule(customRoutines?: MasterRoutineItem[]): LiveScheduleState {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Calculate day mapping
  const dayIndex = now.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayKeyMap: Record<number, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  }
  const { sundayWeekend, saturdayWeekend, startDay } = useCalendarSettings()
  const dayKey = dayKeyMap[dayIndex]
  // In Nepal, Saturday is the national weekend; Sunday is weekend if specifically marked by admin
  const isWeekend = (dayKey === 'sat' && saturdayWeekend) || (dayKey === 'sun' && sundayWeekend)

  // Time in minutes from midnight
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  
  // Find currently active period
  let activeSlotId: string | null = null
  let activePeriodName = 'Outside Lab Hours'
  let minutesRemaining = 0

  for (const p of PERIOD_RANGES) {
    if (currentMinutes >= p.startMin && currentMinutes < p.endMin) {
      activeSlotId = p.id
      activePeriodName = p.name
      minutesRemaining = p.endMin - currentMinutes
      break
    }
  }

  // Nepali Date Info
  const nepaliDate = getNepaliDate(now)

  // Filter routine for today using customRoutines (live state) or MASTER_ROUTINE
  const routineSource = (customRoutines && customRoutines.length > 0) ? customRoutines : MASTER_ROUTINE
  
  // If today is a weekend, preview the official starting school day (Mon if Sunday is weekend, else Sun)
  const queryDayKey: DayKey = isWeekend ? (sundayWeekend ? 'mon' : 'sun') : dayKey
  const todaySessions = routineSource.filter((s) => s.dayKey === queryDayKey)

  // Find active sessions right now across labs
  const activeSessions = activeSlotId
    ? todaySessions.filter((s) => {
        const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === s.slotId)
        const span = s.span || 1
        const activeIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === activeSlotId)
        return activeIdx >= startIdx && activeIdx < startIdx + span
      })
    : []

  // Upcoming sessions today
  const currentSlotIndex = activeSlotId
    ? MASTER_TIME_SLOTS.findIndex((t) => t.id === activeSlotId)
    : -1

  const upcomingSessions = todaySessions.filter((s) => {
    const sIndex = MASTER_TIME_SLOTS.findIndex((t) => t.id === s.slotId)
    return sIndex > currentSlotIndex
  })

  // Formatted Time (e.g. "10:24:15 AM")
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return {
    mounted,
    now,
    timeString,
    nepaliDate,
    dayKey,
    isWeekend,
    activeSlotId,
    activePeriodName,
    minutesRemaining,
    activeSessions,
    todaySessions,
    upcomingSessions,
  }
}
