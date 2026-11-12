import { useState, useEffect, useMemo } from 'react'
import { getNepaliDate, NepaliDateInfo, getNepalDateStr } from '@/lib/nepali-date'
import {
  MasterRoutineItem,
  DayKey,
  HolidayItem,
  DEFAULT_HOLIDAYS,
  isDateWithinHoliday
} from '@/lib/master-data'
import { getPeriodSlotsAction } from '@/app/actions/settings'
import { fetchWithClientCache, getCachedData, getCachedQuery } from '@/lib/cache/client-query-cache'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import { parseSlotTimeRange, sortSessionsChronologically } from '@/lib/utils'
import { getEffectiveDate, isSimulatingTime, TIME_TRAVEL_EVENT } from '@/lib/time-simulator'

interface PeriodMinuteRange {
  id: string
  name: string
  startMin: number
  endMin: number
}

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
  isSimulating: boolean
}

export function useLiveSchedule(customRoutines?: MasterRoutineItem[]): LiveScheduleState {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date>(() => new Date())
  const [isSimulating, setIsSimulating] = useState(false)
  const [holidayInfo, setHolidayInfo] = useState<{ isHoliday: boolean; holidayTitle?: string }>({ isHoliday: false })
  const [periods, setPeriods] = useState<PeriodMinuteRange[]>(() => {
    const cachedSlots = getCachedData<any>('settings:period-slots')?.data || getCachedQuery<any>('bootstrap_data')?.period_settings
    if (Array.isArray(cachedSlots) && cachedSlots.length > 0) {
      return cachedSlots.map((slot: any) => {
        const parsed = parseSlotTimeRange(slot.label || '')
        return {
          id: slot.id,
          name: slot.name || slot.id.toUpperCase(),
          startMin: parsed.startMin,
          endMin: parsed.endMin,
        }
      })
    }
    return []
  })

  useEffect(() => {
    setMounted(true)

    const checkHolidays = () => {
      try {
        const todayStr = getNepalDateStr(getEffectiveDate())
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

    const loadPeriods = async () => {
      try {
        const res = await fetchWithClientCache('settings:period-slots', () => getPeriodSlotsAction(), { staleTimeMs: 120_000 })
        if (res.success && res.data && res.data.length > 0) {
          setPeriods(
            res.data.map((slot) => {
              const parsed = parseSlotTimeRange(slot.label || '')
              return {
                id: slot.id,
                name: slot.name || slot.id.toUpperCase(),
                startMin: parsed.startMin,
                endMin: parsed.endMin,
              }
            })
          )
        }
      } catch (e) {
        console.warn('Failed to load dynamic periods in useLiveSchedule:', e)
      }
    }

    const syncTime = () => {
      setNow(getEffectiveDate())
      setIsSimulating(isSimulatingTime())
      checkHolidays()
    }

    syncTime()
    loadPeriods()

    // 30-second throttled ticker reduces re-render frequency by 96.7%
    const interval = setInterval(() => {
      setNow(getEffectiveDate())
      setIsSimulating(isSimulatingTime())
    }, 30000)

    window.addEventListener(TIME_TRAVEL_EVENT, syncTime)
    window.addEventListener('storage', syncTime)
    window.addEventListener('infrastructure-updated', () => {
      checkHolidays()
      loadPeriods()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener(TIME_TRAVEL_EVENT, syncTime)
      window.removeEventListener('storage', syncTime)
      window.removeEventListener('infrastructure-updated', () => {
        checkHolidays()
        loadPeriods()
      })
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
  const { sundayWeekend, saturdayWeekend } = useCalendarSettings()
  const dayKey = dayKeyMap[dayIndex]
  // In Nepal, Saturday is the national weekend; Sunday is weekend if specifically marked by admin
  const isWeekend = (dayKey === 'sat' && saturdayWeekend) || (dayKey === 'sun' && sundayWeekend)

  const isHoliday = holidayInfo.isHoliday
  const holidayTitle = holidayInfo.holidayTitle

  // Time in minutes from midnight
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  
  // Find currently active period
  let activeSlotId: string | null = null
  let activePeriodName = isHoliday ? (holidayTitle || 'Holiday') : isWeekend ? 'Week Off' : 'Outside Lab Hours'
  let minutesRemaining = 0

  if (mounted && !isHoliday && !isWeekend && periods.length > 0) {
    for (const p of periods) {
      if (currentMinutes >= p.startMin && currentMinutes < p.endMin) {
        activeSlotId = p.id
        activePeriodName = p.name
        minutesRemaining = p.endMin - currentMinutes
        break
      }
    }
  }

  // Memoize Nepali Date Info - only recalculates when date changes
  const nepaliDate = useMemo(
    () => getNepaliDate(now),
    [now.getFullYear(), now.getMonth(), now.getDate()]
  )

  // Filter routine for today using customRoutines (canonical live state)
  const routineSource = customRoutines || []
  
  // If today is a weekend or holiday, preview the official starting school day (Mon if Sunday is weekend, else Sun)
  const todaySessions = useMemo(() => {
    if (isWeekend || isHoliday) return []
    const todayDateStr = getNepalDateStr(now)
    return sortSessionsChronologically(
      routineSource.filter((s) => {
        if (s.dayKey !== dayKey) return false
        if (s.specificDate) {
          return s.specificDate === todayDateStr
        }
        return true
      })
    )
  }, [routineSource, dayKey, isWeekend, isHoliday, now])

  // Find active sessions right now across labs
  const activeSessions = useMemo(() => {
    if (!activeSlotId || periods.length === 0) return []
    return todaySessions.filter((s) => {
      const startIdx = periods.findIndex((t) => t.id === s.slotId)
      const span = s.span || 1
      const activeIdx = periods.findIndex((t) => t.id === activeSlotId)
      if (startIdx === -1 || activeIdx === -1) return false
      return activeIdx >= startIdx && activeIdx < startIdx + span
    })
  }, [todaySessions, activeSlotId, periods])

  // Upcoming sessions today
  const upcomingSessions = useMemo(() => {
    if (periods.length === 0) return todaySessions
    const currentSlotIndex = activeSlotId
      ? periods.findIndex((t) => t.id === activeSlotId)
      : -1

    return todaySessions.filter((s) => {
      const sIndex = periods.findIndex((t) => t.id === s.slotId)
      if (sIndex === -1) return false
      return sIndex > currentSlotIndex
    })
  }, [todaySessions, activeSlotId, periods])

  // Formatted Time (e.g. "10:24:15 AM")
  const timeString = useMemo(() => {
    return now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }, [now])

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
    isSimulating,
  }
}
