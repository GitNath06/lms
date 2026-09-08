'use client'

import { useState, useEffect } from 'react'
import { getNepaliDate, NepaliDateInfo, getNepalDateStr } from '@/lib/nepali-date'
import {
  MASTER_TIME_SLOTS,
  MASTER_ROUTINE,
  MasterRoutineItem,
  DayKey,
  HolidayItem,
  DEFAULT_HOLIDAYS,
  isDateWithinHoliday
} from '@/lib/master-data'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import { parseSlotTimeRange } from '@/lib/utils'

interface PeriodMinuteRange {
  id: string
  name: string
  startMin: number
  endMin: number
}

const PERIOD_RANGES: PeriodMinuteRange[] = MASTER_TIME_SLOTS.map((slot) => {
  const parsed = parseSlotTimeRange(slot.label)
  return {
    id: slot.id,
    name: slot.name,
    startMin: parsed.startMin,
    endMin: parsed.endMin,
  }
})

export interface LiveScheduleState {
  mounted: boolean
  now: Date
  timeString: string
  nepaliDate: NepaliDateInfo
  dayKey: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  isWeekend: boolean // Saturday in Nepal (or Sunday if toggled)
  isHoliday: boolean // Any scheduled single or multi-day recess
  holidayTitle?: string
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
  const [holidayInfo, setHolidayInfo] = useState<{ isHoliday: boolean; holidayTitle?: string }>({ isHoliday: false })

  useEffect(() => {
    setMounted(true)

    const checkHolidays = () => {
      try {
        const todayStr = getNepalDateStr(new Date())
        const saved = localStorage.getItem('lmr_admin_holidays_v2')
        const holidayList: HolidayItem[] = saved ? JSON.parse(saved) : DEFAULT_HOLIDAYS
        const match = holidayList.find((h) => isDateWithinHoliday(todayStr, h))
        if (match) {
          setHolidayInfo({ isHoliday: true, holidayTitle: match.title })
        } else {
          setHolidayInfo({ isHoliday: false, holidayTitle: undefined })
        }
      } catch (e) {}
    }

    checkHolidays()

    const interval = setInterval(() => {
      setNow(new Date())
      checkHolidays()
    }, 1000)

    window.addEventListener('infrastructure-updated', checkHolidays)

    return () => {
      clearInterval(interval)
      window.removeEventListener('infrastructure-updated', checkHolidays)
    }
  }, [])

  // Calculate day mapping in Nepal Standard Time (UTC+5:45)
  const nptMs = now.getTime() + 5.75 * 3600000
  const nptDate = new Date(nptMs)
  const dayIndex = nptDate.getUTCDay() // 0 = Sun, 1 = Mon, ..., 4 = Thu, 6 = Sat
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

  const isHoliday = holidayInfo.isHoliday
  const holidayTitle = holidayInfo.holidayTitle

  // Time in minutes from midnight
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  
  // Find currently active period
  let activeSlotId: string | null = null
  let activePeriodName = isHoliday ? (holidayTitle || 'Holiday Recess') : isWeekend ? 'Weekend Recess' : 'Outside Lab Hours'
  let minutesRemaining = 0

  if (mounted && !isHoliday && !isWeekend) {
    for (const p of PERIOD_RANGES) {
      if (currentMinutes >= p.startMin && currentMinutes < p.endMin) {
        activeSlotId = p.id
        activePeriodName = p.name
        minutesRemaining = p.endMin - currentMinutes
        break
      }
    }
  }

  // Nepali Date Info
  const nepaliDate = getNepaliDate(now)

  // Filter routine for today using customRoutines (live state) or MASTER_ROUTINE
  const routineSource = (customRoutines && customRoutines.length > 0) ? customRoutines : MASTER_ROUTINE
  
  // If today is a weekend or holiday, preview the official starting school day (Mon if Sunday is weekend, else Sun)
  const queryDayKey: DayKey = (isWeekend || isHoliday) ? (sundayWeekend ? 'mon' : 'sun') : dayKey
  const todaySessions = (isWeekend || isHoliday) ? [] : routineSource.filter((s) => s.dayKey === queryDayKey)

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
    isHoliday,
    holidayTitle,
    activeSlotId,
    activePeriodName,
    minutesRemaining,
    activeSessions,
    todaySessions,
    upcomingSessions,
  }
}
