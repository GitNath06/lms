// Nepali Bikram Sambat (B.S.) Calendar & Date Conversion Engine
// Accurate converter covering recent & upcoming academic years (2075 - 2090 B.S.)

export interface NepaliDateInfo {
  bsYear: number
  bsMonth: number // 1 - 12
  bsDay: number // 1 - 32
  bsMonthName: string
  bsMonthNameNp: string
  dayName: string
  dayNameNp: string
  formattedDate: string // e.g. "2083 Bhadra 16, Tuesday"
  formattedDateNp: string // e.g. "२०८३ भदौ १६, मंगलबार"
  englishDate: string // e.g. "1 Sep 2026"
}

const NEPALI_MONTHS_EN = [
  'Baishakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
]

const NEPALI_MONTHS_NP = [
  'बैशाख',
  'जेठ',
  'असार',
  'साउन',
  'भदौ',
  'असोज',
  'कात्तिक',
  'मंसिर',
  'पुस',
  'माघ',
  'फागुन',
  'चैत',
]

const DAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const DAYS_NP = [
  'आइतबार',
  'सोमबार',
  'मंगलबार',
  'बुधबार',
  'बिहीबार',
  'शुक्रबार',
  'शनिबार',
]

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

export function toNepaliDigits(num: number | string): string {
  return num
    .toString()
    .split('')
    .map((ch) => {
      const d = parseInt(ch, 10)
      return isNaN(d) ? ch : NEPALI_DIGITS[d]
    })
    .join('')
}

// Days in each month for Nepali years from 2075 to 2090
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2075: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 31],
  2088: [31, 31, 31, 32, 31, 31, 30, 29, 30, 30, 30, 30],
  2089: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
}

// Reference anchor point: 2083-01-01 BS = 2026-04-14 AD (Tuesday) in Nepal Standard Time (UTC+5:45)
const ANCHOR_BS_YEAR = 2083
const ANCHOR_UTC_MS = Date.UTC(2026, 3, 14) // 2026-04-14 00:00:00 UTC

/**
 * Returns the current date formatted as 'YYYY-MM-DD' in Nepal Standard Time (UTC+5:45).
 * Guaranteed to match the local calendar day in Nepal regardless of client/server timezone.
 */
export function getNepalDateStr(date: Date = new Date()): string {
  const nptMs = date.getTime() + 5.75 * 3600000
  const nptDate = new Date(nptMs)
  return nptDate.toISOString().split('T')[0]
}

export function getNepaliDate(adDateInput: Date = new Date()): NepaliDateInfo {
  // Normalize to Nepal Standard Time (UTC+5:45)
  const nptMs = adDateInput.getTime() + 5.75 * 3600000
  const nptDate = new Date(nptMs)

  // UTC components of nptDate represent the exact calendar date in Nepal
  const nptYear = nptDate.getUTCFullYear()
  const nptMonth = nptDate.getUTCMonth() // 0-indexed
  const nptDay = nptDate.getUTCDate()
  const dayOfWeek = nptDate.getUTCDay() // 0 = Sunday, 1 = Monday, ..., 4 = Thursday, 6 = Saturday

  // Difference in calendar days from the anchor (April 14, 2026)
  const currentUtcDay = Date.UTC(nptYear, nptMonth, nptDay)
  let diffDays = Math.round((currentUtcDay - ANCHOR_UTC_MS) / (1000 * 60 * 60 * 24))

  let bsYear = ANCHOR_BS_YEAR
  let bsMonth = 1
  let bsDay = 1

  if (diffDays >= 0) {
    while (diffDays > 0) {
      const yearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
      const daysInCurrentMonth = yearMonths[bsMonth - 1]

      if (diffDays >= daysInCurrentMonth) {
        diffDays -= daysInCurrentMonth
        bsMonth++
        if (bsMonth > 12) {
          bsMonth = 1
          bsYear++
        }
      } else {
        bsDay += diffDays
        diffDays = 0
      }
    }
  } else {
    // Handling past dates prior to 2083 Baishakh 1
    while (diffDays < 0) {
      bsMonth--
      if (bsMonth < 1) {
        bsMonth = 12
        bsYear--
      }
      const yearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
      const daysInMonth = yearMonths[bsMonth - 1]
      diffDays += daysInMonth
    }
    bsDay = 1 + diffDays
  }

  const bsMonthName = NEPALI_MONTHS_EN[bsMonth - 1]
  const bsMonthNameNp = NEPALI_MONTHS_NP[bsMonth - 1]
  const dayName = DAYS_EN[dayOfWeek]
  const dayNameNp = DAYS_NP[dayOfWeek]

  const formattedDate = `${bsYear} ${bsMonthName} ${bsDay}, ${dayName}`
  const formattedDateNp = `${toNepaliDigits(bsYear)} ${bsMonthNameNp} ${toNepaliDigits(bsDay)} गते, ${dayNameNp}`

  const monthNamesEnShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const englishDate = `${nptDay} ${monthNamesEnShort[nptMonth]} ${nptYear}`

  return {
    bsYear,
    bsMonth,
    bsDay,
    bsMonthName,
    bsMonthNameNp,
    dayName,
    dayNameNp,
    formattedDate,
    formattedDateNp,
    englishDate,
  }
}

export function getDaysInBsMonth(bsYear: number, bsMonth: number): number {
  const yearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
  return yearMonths[bsMonth - 1] || 30
}

export function bsToAdDate(bsYear: number, bsMonth: number, bsDay: number): Date {
  let offsetDays = 0
  if (bsYear >= ANCHOR_BS_YEAR) {
    for (let y = ANCHOR_BS_YEAR; y < bsYear; y++) {
      const yearMonths = BS_CALENDAR_DATA[y] || BS_CALENDAR_DATA[2083]
      offsetDays += yearMonths.reduce((a, b) => a + b, 0)
    }
    const currentYearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
    for (let m = 1; m < bsMonth; m++) {
      offsetDays += currentYearMonths[m - 1]
    }
    offsetDays += bsDay - 1
  } else {
    for (let y = ANCHOR_BS_YEAR - 1; y >= bsYear; y--) {
      const yearMonths = BS_CALENDAR_DATA[y] || BS_CALENDAR_DATA[2083]
      offsetDays -= yearMonths.reduce((a, b) => a + b, 0)
    }
    const currentYearMonths = BS_CALENDAR_DATA[bsYear] || BS_CALENDAR_DATA[2083]
    for (let m = 1; m < bsMonth; m++) {
      offsetDays += currentYearMonths[m - 1]
    }
    offsetDays += bsDay - 1
  }

  // Returns a UTC date whose ISO representation matches the exact calendar day
  return new Date(ANCHOR_UTC_MS + offsetDays * 86400000)
}

export interface BsCalendarDay {
  bsYear: number
  bsMonth: number
  bsDay: number
  bsDayNp: string
  adDate: Date
  dateStr: string // YYYY-MM-DD
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName: string
  dayNameNp: string
  monthNameEn: string
  monthNameNp: string
  adDayString: string // e.g. "3 Sep"
}

export function getBsMonthCalendar(bsYear: number = 2083, bsMonth: number = 5): {
  days: BsCalendarDay[]
  startDayOfWeek: number
  daysInMonth: number
  monthNameEn: string
  monthNameNp: string
  yearNp: string
} {
  const daysInMonth = getDaysInBsMonth(bsYear, bsMonth)
  const firstDayAd = bsToAdDate(bsYear, bsMonth, 1)
  const startDayOfWeek = firstDayAd.getUTCDay()

  const monthNamesEnShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const days: BsCalendarDay[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const adDate = bsToAdDate(bsYear, bsMonth, d)
    const dateStr = adDate.toISOString().split('T')[0]
    const dayOfWeek = adDate.getUTCDay()
    const adDay = adDate.getUTCDate()
    const adMonth = monthNamesEnShort[adDate.getUTCMonth()]
    const adDayString = `${adDay} ${adMonth}`

    days.push({
      bsYear,
      bsMonth,
      bsDay: d,
      bsDayNp: toNepaliDigits(d),
      adDate,
      dateStr,
      dayOfWeek,
      dayName: DAYS_EN[dayOfWeek],
      dayNameNp: DAYS_NP[dayOfWeek],
      monthNameEn: NEPALI_MONTHS_EN[bsMonth - 1],
      monthNameNp: NEPALI_MONTHS_NP[bsMonth - 1],
      adDayString,
    })
  }

  return {
    days,
    startDayOfWeek,
    daysInMonth,
    monthNameEn: NEPALI_MONTHS_EN[bsMonth - 1],
    monthNameNp: NEPALI_MONTHS_NP[bsMonth - 1],
    yearNp: toNepaliDigits(bsYear),
  }
}

/**
 * Safely converts a date input string (BS 'YYYY-MM-DD' with year >= 2070 or AD 'YYYY-MM-DD')
 * to an AD date string 'YYYY-MM-DD' suitable for PostgreSQL/PostgREST database queries.
 * Refinement #2: Clamps BS days to valid days in that BS month to prevent month overflow.
 */
export function resolveDateInputToAdStr(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Check for YYYY-MM-DD or YYYY/MM/DD
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (!match) return trimmed

  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = parseInt(match[3], 10)

  if (y >= 2070 && y <= 2100) {
    // Bikram Sambat date detected: clamp month and day
    const validMonth = Math.max(1, Math.min(12, m))
    const maxDays = getDaysInBsMonth(y, validMonth)
    const clampedDay = Math.max(1, Math.min(maxDays, d))
    const adDate = bsToAdDate(y, validMonth, clampedDay)
    return adDate.toISOString().split('T')[0]
  }

  return trimmed
}

export interface NepaliMitiResult {
  bsDateStr: string // e.g. '2083-06-26'
  bsYear: number
  bsMonth: number
  bsDay: number
  bsFormattedNp: string // e.g. '२०८३ असोज २६'
  bsFormattedEn: string // e.g. '2083 Ashwin 26'
  adDateStr: string // e.g. '2026-10-12'
  labelNp: string // e.g. '२०८३ असोज २६'
  labelBilingual: string // e.g. '२०८३-०६-२६ (12 Oct)'
}

/**
 * Formats any Gregorian date (Date instance or YYYY-MM-DD string) into Bikram Sambat (B.S.) Miti.
 */
export function formatToNepaliMiti(dateInput: Date | string | null | undefined): NepaliMitiResult | null {
  if (!dateInput) return null
  let d: Date
  if (dateInput instanceof Date) {
    d = dateInput
  } else if (typeof dateInput === 'string') {
    const cleanStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput.trim()
    const parts = cleanStr.split(/[-/.]/)
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const day = parseInt(parts[2], 10)
      if (year >= 2070 && year <= 2100) {
        // Input is already in BS format
        const validMonth = Math.max(1, Math.min(12, month))
        const maxDays = getDaysInBsMonth(year, validMonth)
        const clampedDay = Math.max(1, Math.min(maxDays, day))
        const ad = bsToAdDate(year, validMonth, clampedDay)
        return formatToNepaliMiti(ad)
      }
      d = new Date(Date.UTC(year, month - 1, day))
    } else {
      d = new Date(cleanStr)
    }
  } else {
    d = new Date(dateInput)
  }

  if (isNaN(d.getTime())) return null

  const info = getNepaliDate(d)
  const bsMm = String(info.bsMonth).padStart(2, '0')
  const bsDd = String(info.bsDay).padStart(2, '0')
  const bsDateStr = `${info.bsYear}-${bsMm}-${bsDd}`
  const adDateStr = d.toISOString().split('T')[0]
  const shortAd = info.englishDate.split(' ').slice(0, 2).join(' ') // e.g. "12 Oct"

  return {
    bsDateStr,
    bsYear: info.bsYear,
    bsMonth: info.bsMonth,
    bsDay: info.bsDay,
    bsFormattedNp: `${toNepaliDigits(info.bsYear)} ${info.bsMonthNameNp} ${toNepaliDigits(info.bsDay)}`,
    bsFormattedEn: `${info.bsYear} ${info.bsMonthName} ${info.bsDay}`,
    adDateStr,
    labelNp: `${toNepaliDigits(info.bsYear)} ${info.bsMonthNameNp} ${toNepaliDigits(info.bsDay)}`,
    labelBilingual: `${toNepaliDigits(info.bsYear)}-${toNepaliDigits(bsMm)}-${toNepaliDigits(bsDd)} (${shortAd})`,
  }
}

/**
 * Generates ISO AD date strings for common Bikram Sambat filtering presets.
 */
export function getBsDatePreset(preset: 'current_month' | 'last_month' | 'current_year'): { date_from: string; date_to: string } {
  const today = getNepaliDate(new Date())
  if (preset === 'current_month') {
    const maxDays = getDaysInBsMonth(today.bsYear, today.bsMonth)
    return {
      date_from: bsToAdDate(today.bsYear, today.bsMonth, 1).toISOString().split('T')[0],
      date_to: bsToAdDate(today.bsYear, today.bsMonth, maxDays).toISOString().split('T')[0],
    }
  }
  if (preset === 'last_month') {
    let y = today.bsYear
    let m = today.bsMonth - 1
    if (m < 1) {
      m = 12
      y--
    }
    const maxDays = getDaysInBsMonth(y, m)
    return {
      date_from: bsToAdDate(y, m, 1).toISOString().split('T')[0],
      date_to: bsToAdDate(y, m, maxDays).toISOString().split('T')[0],
    }
  }
  if (preset === 'current_year') {
    const maxDays12 = getDaysInBsMonth(today.bsYear, 12)
    return {
      date_from: bsToAdDate(today.bsYear, 1, 1).toISOString().split('T')[0],
      date_to: bsToAdDate(today.bsYear, 12, maxDays12).toISOString().split('T')[0],
    }
  }
  return { date_from: '', date_to: '' }
}

export { NEPALI_MONTHS_EN, NEPALI_MONTHS_NP, DAYS_EN, DAYS_NP }

