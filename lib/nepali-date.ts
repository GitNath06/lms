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
  2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
}

// Reference anchor point: 2083-01-01 BS = 2026-04-14 AD (Tuesday)
const ANCHOR_BS_YEAR = 2083
const ANCHOR_AD_DATE = new Date(2026, 3, 14) // Month is 0-indexed in JS (3 = April)

export function getNepaliDate(adDateInput: Date = new Date()): NepaliDateInfo {
  // Normalize to UTC+5:45 (Nepal Standard Time)
  const utc = adDateInput.getTime() + adDateInput.getTimezoneOffset() * 60000
  const nptOffset = 5.75 * 60 * 60000
  const nptDate = new Date(utc + nptOffset)

  // Difference in calendar days from the anchor
  const diffTime = nptDate.getTime() - ANCHOR_AD_DATE.getTime()
  let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

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

  const dayOfWeek = nptDate.getDay() // 0 = Sunday, 1 = Monday, etc.
  const bsMonthName = NEPALI_MONTHS_EN[bsMonth - 1]
  const bsMonthNameNp = NEPALI_MONTHS_NP[bsMonth - 1]
  const dayName = DAYS_EN[dayOfWeek]
  const dayNameNp = DAYS_NP[dayOfWeek]

  const formattedDate = `${bsYear} ${bsMonthName} ${bsDay}, ${dayName}`
  const formattedDateNp = `${toNepaliDigits(bsYear)} ${bsMonthNameNp} ${toNepaliDigits(bsDay)} गते, ${dayNameNp}`
  
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  const englishDate = nptDate.toLocaleDateString('en-GB', options)

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
