/**
 * Institutional Calendar & Operational Recess Policy
 * Single authoritative rule engine for holiday suspensions, Saturday Statutory Off,
 * and Sunday Week Off Policy.
 */

import { DEFAULT_HOLIDAYS, type HolidayItem, isDateWithinHoliday } from '@/lib/master-data'
import { getInstitutionSetting } from '@/app/actions/settings'

export interface CalendarSettings {
  startDay?: 'sun' | 'mon'
  sundayWeekend?: boolean
  saturdayWeekend?: boolean
}

export interface DateSuspensionStatus {
  isSuspended: boolean
  type?: 'holiday' | 'recess'
  title?: string
  badge?: string
  description?: string
  holiday?: HolidayItem
}

/**
 * Synchronous client & server evaluator for date operational status.
 */
export function evaluateDateSuspension(
  dateStrInput: string | Date,
  customHolidays?: HolidayItem[],
  settings?: CalendarSettings
): DateSuspensionStatus {
  const dateStr = typeof dateStrInput === 'string'
    ? dateStrInput.split('T')[0].trim()
    : dateStrInput.toISOString().split('T')[0]

  const holidaysList = customHolidays && customHolidays.length > 0 ? customHolidays : DEFAULT_HOLIDAYS

  // 1. Check Official Institutional & Cultural Holidays
  const matchingHoliday = holidaysList.find((h) => isDateWithinHoliday(dateStr, h))
  if (matchingHoliday) {
    const title = matchingHoliday.title || matchingHoliday.name || 'Institutional Holiday'
    return {
      isSuspended: true,
      type: 'holiday',
      title,
      badge: 'Gazetted Public Holiday',
      description: `All laboratory practicals, student attendance tallies, and instructor session logs are suspended for ${title}. Routine timetable resumes on the next scheduled academic day.`,
      holiday: matchingHoliday,
    }
  }

  // 2. Check Weekly Off & Recess Policies
  // Parse day of week in Nepal context
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dayIndex = d.getUTCDay() // 0 = Sunday, 6 = Saturday

  const saturdayWeekend = settings?.saturdayWeekend !== false // default: true
  const sundayWeekend = Boolean(settings?.sundayWeekend) // default: false (Nepal standard work day unless toggled ON)

  if (dayIndex === 6 && saturdayWeekend) {
    return {
      isSuspended: true,
      type: 'recess',
      title: 'Saturday Statutory Weekend',
      badge: 'Official Weekly Off',
      description: 'Saturday is the official statutory weekly holiday in Nepal. Laboratory practical sessions are suspended.',
    }
  }

  if (dayIndex === 0 && sundayWeekend) {
    return {
      isSuspended: true,
      type: 'recess',
      title: 'Sunday Institutional Week Off',
      badge: 'Week Off Active',
      description: 'Sunday is declared as an institutional week off under institutional policy. Practical sessions and timetables are suspended on Sundays.',
    }
  }

  return {
    isSuspended: false,
  }
}

/**
 * Server-Side Authoritative Date Suspension Check
 * Queries PostgreSQL single source of truth for calendar_settings and holidays.
 */
export async function checkServerDateSuspension(
  dateStrInput: string | Date
): Promise<DateSuspensionStatus> {
  try {
    const [calSettings, dynamicHolidays] = await Promise.all([
      getInstitutionSetting<CalendarSettings>('calendar_settings', {
        startDay: 'sun',
        sundayWeekend: false,
        saturdayWeekend: true,
      }),
      getInstitutionSetting<HolidayItem[]>('academic_holidays', DEFAULT_HOLIDAYS),
    ])

    return evaluateDateSuspension(dateStrInput, dynamicHolidays, calSettings)
  } catch (err) {
    console.warn('[LMR] Fallback evaluating date suspension without DB settings:', err)
    return evaluateDateSuspension(dateStrInput, DEFAULT_HOLIDAYS, {
      sundayWeekend: false,
      saturdayWeekend: true,
    })
  }
}
