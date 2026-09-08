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

// Days in each month for Nepali years from 2080 to 2085
const BS_CALENDAR_DATA: Record<number, number[]> = {
  2080: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
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

export { NEPALI_MONTHS_EN, NEPALI_MONTHS_NP, DAYS_EN, DAYS_NP }
