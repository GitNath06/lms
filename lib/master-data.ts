export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'

export interface MergedSessionPart {
  subjectCode: string
  subjectTitle: string
  grade: string
  teacher: string
  students?: number
}

export interface MasterRoutineItem {
  id: string
  day: DayName
  dayKey: DayKey
  timeSlot: string
  slotId: string
  span?: number
  subjectCode: string
  subjectTitle: string
  grade: string
  gradeKey: 'class-6' | 'class-7' | 'class-8' | 'class-9' | 'class-10' | 'class-11' | 'class-12'
  teacher: string
  teacherId?: string | null
  lab: 'Computer Lab' | 'Physics Lab' | 'Chemistry Lab' | 'Biology Lab' | 'Electronics Lab' | (string & {})
  labKey: 'comp' | 'phys' | 'chem' | 'bio' | 'elec' | (string & {})
  labCode?: string
  defaultStudents: number
  category: 'Computer' | 'Physics' | 'Chemistry' | 'Biology' | 'Electronics' | 'General' | (string & {})
  dotColor: string
  accentColor: string
  badgeColor: string
  mergedParts?: [MergedSessionPart, MergedSessionPart]
  secondaryLab?: string
  secondaryLabKey?: 'comp' | 'phys' | 'chem' | 'bio' | 'elec' | (string & {})
  isDualLab?: boolean
  coTeacher?: string
  classSubjectId?: string | null
  academicYearId?: string | null
  status?: 'confirmed' | 'requested' | 'skipped'
  isSkipped?: boolean
  skippedReason?: string
  skippedBy?: string
  requestedBy?: string
  declineReason?: string
  date?: string
  specificDate?: string | null
  isAdHoc?: boolean
}

export function isLabBusyInSlot(
  routines: MasterRoutineItem[],
  dayKey: DayKey,
  slotId: string,
  labKey: string,
  excludeSessionId?: string,
  targetDate?: string | null
): boolean {
  if (!routines || !dayKey || !slotId || !labKey) return false
  const normKey = labKey.toLowerCase().trim()
  const cleanTargetDate = targetDate ? targetDate.split('T')[0] : null
  return routines.some((s) => {
    if (excludeSessionId && s.id === excludeSessionId) return false
    if (s.dayKey !== dayKey || s.slotId !== slotId) return false
    if (s.isSkipped || s.status === 'skipped') return false
    const sDate = s.specificDate ? s.specificDate.split('T')[0] : (s.date ? s.date.split('T')[0] : null)
    if (cleanTargetDate && sDate && cleanTargetDate !== sDate) {
      return false
    }
    const primaryMatch = (s.labKey || '').toLowerCase().trim() === normKey
    const secondaryMatch = Boolean(s.isDualLab && (s.secondaryLabKey || '').toLowerCase().trim() === normKey)
    return primaryMatch || secondaryMatch
  })
}

export function isTeacherBusyInSlot(
  routines: MasterRoutineItem[],
  dayKey: DayKey,
  slotId: string,
  teacherName: string,
  excludeSessionId?: string,
  targetDate?: string | null
): boolean {
  if (!routines || !dayKey || !slotId || !teacherName) return false
  const normTeacher = teacherName.toLowerCase().trim()
  const cleanTargetDate = targetDate ? targetDate.split('T')[0] : null
  return routines.some((s) => {
    if (excludeSessionId && s.id === excludeSessionId) return false
    if (s.dayKey !== dayKey || s.slotId !== slotId) return false
    if (s.isSkipped || s.status === 'skipped') return false
    const sDate = s.specificDate ? s.specificDate.split('T')[0] : (s.date ? s.date.split('T')[0] : null)
    if (cleanTargetDate && sDate && cleanTargetDate !== sDate) {
      return false
    }
    const sTeacher = (s.teacher || '').toLowerCase().trim()
    const sCoTeacher = s.isDualLab ? (s.coTeacher || '').toLowerCase().trim() : ''
    return sTeacher === normTeacher || (sCoTeacher !== '' && sCoTeacher === normTeacher)
  })
}

export function getOccupiedLabsInSlot(
  routines: MasterRoutineItem[],
  dayKey: DayKey,
  slotId: string,
  excludeSessionId?: string,
  periodSlots?: Array<{ id: string }>,
  targetDate?: string | null
): Set<string> {
  const occupied = new Set<string>()
  if (!routines || !dayKey || !slotId) return occupied

  const parseSlotOrder = (id: string) => {
    if (periodSlots && periodSlots.length > 0) {
      const idx = periodSlots.findIndex((t) => t.id === id)
      if (idx !== -1) return idx
    }
    const match = id.match(/\d+/)
    return match ? parseInt(match[0], 10) : -1
  }

  const targetSlotIdx = parseSlotOrder(slotId)
  if (targetSlotIdx === -1) return occupied

  const cleanTargetDate = targetDate ? targetDate.split('T')[0] : null

  routines.forEach((s) => {
    if (excludeSessionId && s.id === excludeSessionId) return
    if (s.dayKey !== dayKey) return
    if (s.isSkipped || s.status === 'skipped') return

    const sDate = s.specificDate ? s.specificDate.split('T')[0] : (s.date ? s.date.split('T')[0] : null)
    if (cleanTargetDate && sDate && cleanTargetDate !== sDate) {
      return
    }

    const sSlotIdx = parseSlotOrder(s.slotId)
    if (sSlotIdx === -1) return
    const sSpan = s.span || 1

    if (targetSlotIdx >= sSlotIdx && targetSlotIdx < sSlotIdx + sSpan) {
      if (s.labKey) occupied.add(s.labKey.toLowerCase().trim())
      if (s.isDualLab && s.secondaryLabKey) occupied.add(s.secondaryLabKey.toLowerCase().trim())
    }
  })
  return occupied
}

export interface HolidayItem {
  id: string
  title: string
  name?: string
  titleNp?: string
  dateStr: string // YYYY-MM-DD (Start Date)
  startDateNp?: string
  endDateStr?: string // YYYY-MM-DD (End Date for multi-day vacations)
  endDateNp?: string
  bsDateStr?: string // e.g. "२०८३ असोज २४ - कात्तिक ५"
  type: 'state' | 'cultural' | 'department' | 'weekend' | 'vacation'
  description?: string
}

export function isDateWithinHoliday(dateInput: string | Date, holiday: HolidayItem): boolean {
  if (!holiday || !holiday.dateStr) return false
  const dStr = typeof dateInput === 'string' ? dateInput.split('T')[0].trim() : getNepalDateStr(dateInput)
  const start = (holiday.dateStr || '').trim()
  const end = (holiday.endDateStr || start).trim()
  const [minDate, maxDate] = start <= end ? [start, end] : [end, start]
  return dStr >= minDate && dStr <= maxDate
}

export const DAYS: {
  id: DayKey
  label: DayName
  short: string
  nepaliName: string
  isWeekend: boolean
}[] = [
  { id: 'sun', label: 'Sunday', short: 'Sun', nepaliName: 'आइतवार', isWeekend: false },
  { id: 'mon', label: 'Monday', short: 'Mon', nepaliName: 'सोमबार', isWeekend: false },
  { id: 'tue', label: 'Tuesday', short: 'Tue', nepaliName: 'मंगलबार', isWeekend: false },
  { id: 'wed', label: 'Wednesday', short: 'Wed', nepaliName: 'बुधबार', isWeekend: false },
  { id: 'thu', label: 'Thursday', short: 'Thu', nepaliName: 'बिहीबार', isWeekend: false },
  { id: 'fri', label: 'Friday', short: 'Fri', nepaliName: 'शुक्रबार', isWeekend: false },
  { id: 'sat', label: 'Saturday', short: 'Sat', nepaliName: 'शनिबार', isWeekend: true },
]

export const DEFAULT_HOLIDAYS: HolidayItem[] = [
  // =========================================================================
  // 🇳🇵 YEAR 2081 B.S. (OFFICIAL NEPAL GOVERNMENT GAZETTE / गृह मन्त्रालय राजपत्र)
  // =========================================================================
  {
    id: '2081-hol-naya-barsha',
    title: 'Nepali New Year 2081 (नयाँ वर्ष २०८१)',
    titleNp: 'नयाँ वर्ष २०८१ राष्ट्रिय बिदा',
    name: 'Nepali New Year 2081',
    dateStr: '2024-04-13',
    bsDateStr: '२०८१ बैशाख ०१',
    type: 'state',
    description: 'Bikram Sambat 2081 New Year National Public Holiday',
  },
  {
    id: '2081-hol-majdoor',
    title: 'International Labor Day (मजदुर दिवस)',
    titleNp: 'अन्तर्राष्ट्रिय मजदुर दिवस',
    name: 'May Day / Labor Day',
    dateStr: '2024-05-01',
    bsDateStr: '२०८१ बैशाख १९',
    type: 'state',
    description: 'International Workers Day Public Holiday',
  },
  {
    id: '2081-hol-buddha',
    title: 'Buddha Jayanti / Ubhauli (बुद्ध जयन्ती तथा उभौली)',
    titleNp: 'बुद्ध जयन्ती तथा उभौली पर्व',
    name: 'Buddha Jayanti',
    dateStr: '2024-05-23',
    bsDateStr: '२०८१ जेठ १०',
    type: 'cultural',
    description: '2568th Buddha Jayanti & Kirat Ubhauli Festival',
  },
  {
    id: '2081-hol-republic',
    title: 'Republic Day (गणतन्त्र दिवस)',
    titleNp: 'राष्ट्रिय गणतन्त्र दिवस',
    name: 'Ganatantra Diwas',
    dateStr: '2024-05-28',
    bsDateStr: '२०८१ जेठ १५',
    type: 'state',
    description: 'National Republic Day Public Holiday',
  },
  {
    id: '2081-hol-raksha',
    title: 'Janai Purnima / Raksha Bandhan (जनै पूर्णिमा, रक्षा बन्धन)',
    titleNp: 'जनै पूर्णिमा तथा रक्षा बन्धन',
    name: 'Raksha Bandhan / Janai Purnima',
    dateStr: '2024-08-19',
    bsDateStr: '२०८१ भदौ ०३',
    type: 'cultural',
    description: 'Sacred Thread Festival & Raksha Bandhan Public Holiday',
  },
  {
    id: '2081-hol-krishna',
    title: 'Shree Krishna Janmashtami (श्रीकृष्ण जन्माष्टमी)',
    titleNp: 'श्रीकृष्ण जन्माष्टमी बिदा',
    name: 'Krishna Janmashtami',
    dateStr: '2024-08-26',
    bsDateStr: '२०८१ भदौ १०',
    type: 'cultural',
    description: 'Lord Krishna Appearance Day National Holiday',
  },
  {
    id: '2081-hol-gaura',
    title: 'Gaura Parba (गौरा पर्व)',
    titleNp: 'गौरा पर्व राष्ट्रिय बिदा',
    name: 'Gaura Parba',
    dateStr: '2024-08-27',
    bsDateStr: '२०८१ भदौ ११',
    type: 'cultural',
    description: 'Traditional Western Nepal Cultural Festival',
  },
  {
    id: '2081-hol-teej',
    title: 'Haritalika Teej (हरितालिका तीज)',
    titleNp: 'हरितालिका तीज व्रत बिदा',
    name: 'Haritalika Teej',
    dateStr: '2024-09-06',
    bsDateStr: '२०८१ भदौ २१',
    type: 'cultural',
    description: 'Haritalika Teej Fasting & Cultural Celebration',
  },
  {
    id: '2081-hol-indra',
    title: 'Indra Jatra (इन्द्रजात्रा)',
    titleNp: 'इन्द्रजात्रा बिदा (काठमाडौं उपत्यका)',
    name: 'Indra Jatra',
    dateStr: '2024-09-17',
    bsDateStr: '२०८१ भदौ ३१',
    type: 'cultural',
    description: 'Traditional Kumari & Indra Jatra Festival',
  },
  {
    id: '2081-hol-const',
    title: 'Constitution Day (संविधान दिवस)',
    titleNp: 'राष्ट्रिय संविधान दिवस',
    name: 'Constitution Day',
    dateStr: '2024-09-19',
    bsDateStr: '२०८१ असोज ०३',
    type: 'state',
    description: 'National Day / Constitution Day of Nepal',
  },
  {
    id: '2081-hol-ghatasthapana',
    title: 'Ghatasthapana (घटस्थापना - दसैं प्रारम्भ)',
    titleNp: 'घटस्थापना बिदा',
    name: 'Ghatasthapana',
    dateStr: '2024-10-03',
    bsDateStr: '२०८१ असोज १७',
    type: 'cultural',
    description: 'Commencement of Navaratri & Bada Dashain',
  },
  {
    id: '2081-hol-dashain',
    title: 'Bada Dashain Vacation (बडा दसैं बिदा)',
    titleNp: 'बडा दसैं बिदा (फूलपातीदेखि एकादशीसम्म)',
    name: 'Bada Dashain Vacation',
    dateStr: '2024-10-10',
    endDateStr: '2024-10-15',
    bsDateStr: '२०८१ असोज २४ - २९',
    type: 'vacation',
    description: 'Annual National Autumn Festival Recess (Fulpati, Ashtami, Navami, Vijaya Dashami)',
  },
  {
    id: '2081-hol-kojagrat',
    title: 'Kojagrat Purnima (कोजाग्रत पूर्णिमा)',
    titleNp: 'कोजाग्रत पूर्णिमा बिदा',
    name: 'Kojagrat Purnima',
    dateStr: '2024-10-16',
    bsDateStr: '२०८१ असोज ३०',
    type: 'cultural',
    description: 'Conclusion of Bada Dashain Fortnight',
  },
  {
    id: '2081-hol-tihar',
    title: 'Tihar & Bhai Tika Recess (तिहार तथा भाइटीका)',
    titleNp: 'यमपञ्चक तथा तिहार बिदा (लक्ष्मी पूजा, गोवर्धन पूजा, भाइटीका)',
    name: 'Tihar & Bhai Tika Recess',
    dateStr: '2024-10-31',
    endDateStr: '2024-11-04',
    bsDateStr: '२०८१ कात्तिक १५ - १९',
    type: 'vacation',
    description: 'Festival of Lights Yamapanchak Recess (Laxmi Puja, Gobardhan Puja, Bhai Tika)',
  },
  {
    id: '2081-hol-chhath',
    title: 'Chhath Parba (छठ पर्व)',
    titleNp: 'छठ पर्व राष्ट्रिय बिदा',
    name: 'Chhath Parba',
    dateStr: '2024-11-07',
    bsDateStr: '२०८१ कात्तिक २२',
    type: 'cultural',
    description: 'Sun God Worship Mahaparba Public Holiday',
  },
  {
    id: '2081-hol-udhauli',
    title: 'Udhauli Parba / Yomari Punhi (उधौली पर्व / योमरी पुन्ही)',
    titleNp: 'उधौली पर्व तथा योमरी पुन्ही',
    name: 'Udhauli / Yomari Punhi',
    dateStr: '2024-12-15',
    bsDateStr: '२०८१ मंसिर ३०',
    type: 'cultural',
    description: 'Harvest Festival & Newari Yomari Punhi Holiday',
  },
  {
    id: '2081-hol-xmas',
    title: 'Christmas Day (क्रिसमस डे)',
    titleNp: 'क्रिसमस डे सार्वजनिक बिदा',
    name: 'Christmas Day',
    dateStr: '2024-12-25',
    bsDateStr: '२०८१ पुस १०',
    type: 'cultural',
    description: 'Christmas Celebration National Holiday',
  },
  {
    id: '2081-hol-tamu',
    title: 'Tamu Lhosar (तमु ल्होसार)',
    titleNp: 'तमु ल्होसार राष्ट्रिय बिदा',
    name: 'Tamu Lhosar',
    dateStr: '2024-12-30',
    bsDateStr: '२०८१ पुस १५',
    type: 'cultural',
    description: 'Gurung Community New Year Public Holiday',
  },
  {
    id: '2081-hol-winter',
    title: 'Institutional Winter Vacation (हिउँदे बिदा)',
    titleNp: 'शैक्षिक हिउँदे बिदा',
    name: 'Winter Vacation',
    dateStr: '2025-01-02',
    endDateStr: '2025-01-14',
    bsDateStr: '२०८१ पुस १८ - ३०',
    type: 'vacation',
    description: 'Annual Mid-Term Winter Recess for Practical Laboratories',
  },
  {
    id: '2081-hol-maghe',
    title: 'Maghe Sankranti (माघे संक्रान्ति)',
    titleNp: 'माघे संक्रान्ति / मकर संक्रान्ति बिदा',
    name: 'Maghe Sankranti',
    dateStr: '2025-01-14',
    bsDateStr: '२०८१ माघ ०१',
    type: 'cultural',
    description: 'Makar Sankranti & Maghi Festival Holiday',
  },
  {
    id: '2081-hol-sonam',
    title: 'Sonam Lhosar / Shahid Diwas (सोनाम ल्होसार तथा शहीद दिवस)',
    titleNp: 'सोनाम ल्होसार तथा शहीद दिवस',
    name: 'Sonam Lhosar / Martyrs Day',
    dateStr: '2025-01-29',
    bsDateStr: '२०८१ माघ १६',
    type: 'cultural',
    description: 'Tamang Community New Year & Martyrs Memorial Holiday',
  },
  {
    id: '2081-hol-prajatantra',
    title: 'National Democracy Day (राष्ट्रिय प्रजातन्त्र दिवस)',
    titleNp: 'राष्ट्रिय प्रजातन्त्र दिवस',
    name: 'Prajatantra Diwas',
    dateStr: '2025-02-19',
    bsDateStr: '२०८१ फागुन ०७',
    type: 'state',
    description: 'Commemoration of 1951 Democratic Revolution',
  },
  {
    id: '2081-hol-shivaratri',
    title: 'Maha Shivaratri (महाशिवरात्री)',
    titleNp: 'महाशिवरात्री राष्ट्रिय बिदा',
    name: 'Maha Shivaratri',
    dateStr: '2025-02-26',
    bsDateStr: '२०८१ फागुन १४',
    type: 'cultural',
    description: 'Great Night of Shiva National Public Holiday',
  },
  {
    id: '2081-hol-gyalpo',
    title: 'Gyalpo Lhosar (ग्याल्पो ल्होसार)',
    titleNp: 'ग्याल्पो ल्होसार बिदा',
    name: 'Gyalpo Lhosar',
    dateStr: '2025-02-28',
    bsDateStr: '२०८१ फागुन १६',
    type: 'cultural',
    description: 'Tibetan / Sherpa Community New Year',
  },
  {
    id: '2081-hol-women',
    title: 'International Women\'s Day (अन्तर्राष्ट्रिय महिला दिवस)',
    titleNp: 'अन्तर्राष्ट्रिय महिला दिवस',
    name: 'Nari Diwas',
    dateStr: '2025-03-08',
    bsDateStr: '२०८१ फागुन २४',
    type: 'state',
    description: 'Global Women Rights & Empowerment Holiday',
  },
  {
    id: '2081-hol-holi-pahad',
    title: 'Fagu Purnima / Holi (होली पर्व)',
    titleNp: 'फागु पूर्णिमा (होली बिदा)',
    name: 'Fagu Purnima / Holi',
    dateStr: '2025-03-13',
    bsDateStr: '२०८१ फागुन २९',
    type: 'cultural',
    description: 'Festival of Colors Spring Celebration',
  },
  {
    id: '2081-hol-ghode',
    title: 'Ghode Jatra (घोडेजात्रा)',
    titleNp: 'घोडेजात्रा बिदा (काठमाडौं उपत्यका)',
    name: 'Ghode Jatra',
    dateStr: '2025-03-29',
    bsDateStr: '२०८१ चैत १५',
    type: 'cultural',
    description: 'Traditional Horse Racing Festival in Tundikhel',
  },
  {
    id: '2081-hol-ramnavami',
    title: 'Ram Navami (रामनवमी)',
    titleNp: 'रामनवमी पर्व बिदा',
    name: 'Ram Navami',
    dateStr: '2025-04-06',
    bsDateStr: '२०८१ चैत २४',
    type: 'cultural',
    description: 'Lord Ram Birth Anniversary Public Holiday',
  },

  // =========================================================================
  // 🇳🇵 YEAR 2082 B.S. (OFFICIAL NEPAL GOVERNMENT GAZETTE / गृह मन्त्रालय राजपत्र)
  // =========================================================================
  {
    id: '2082-hol-naya-barsha',
    title: 'Nepali New Year 2082 (नयाँ वर्ष २०८२)',
    titleNp: 'नयाँ वर्ष २०८२ राष्ट्रिय बिदा',
    name: 'Nepali New Year 2082',
    dateStr: '2025-04-14',
    bsDateStr: '२०८२ बैशाख ०१',
    type: 'state',
    description: 'Bikram Sambat 2082 New Year Public Holiday',
  },
  {
    id: '2082-hol-majdoor',
    title: 'International Labor Day (मजदुर दिवस)',
    titleNp: 'अन्तर्राष्ट्रिय मजदुर दिवस',
    name: 'May Day',
    dateStr: '2025-05-01',
    bsDateStr: '२०८२ बैशाख १८',
    type: 'state',
    description: 'International Workers Day',
  },
  {
    id: '2082-hol-republic',
    title: 'Republic Day (गणतन्त्र दिवस)',
    titleNp: 'राष्ट्रिय गणतन्त्र दिवस',
    name: 'Republic Day',
    dateStr: '2025-05-29',
    bsDateStr: '२०८२ जेठ १५',
    type: 'state',
    description: 'National Republic Day',
  },
  {
    id: '2082-hol-buddha',
    title: 'Buddha Jayanti / Ubhauli (बुद्ध जयन्ती तथा उभौली)',
    titleNp: 'बुद्ध जयन्ती तथा उभौली पर्व',
    name: 'Buddha Jayanti 2082',
    dateStr: '2025-06-11',
    bsDateStr: '२०८२ जेठ २८',
    type: 'cultural',
    description: 'Buddha Jayanti & Kirat Ubhauli Festival',
  },
  {
    id: '2082-hol-raksha',
    title: 'Janai Purnima / Raksha Bandhan (जनै पूर्णिमा, रक्षा बन्धन)',
    titleNp: 'जनै पूर्णिमा तथा रक्षा बन्धन',
    name: 'Raksha Bandhan',
    dateStr: '2025-08-09',
    bsDateStr: '२०८२ साउन २४',
    type: 'cultural',
    description: 'Sacred Thread Festival & Raksha Bandhan',
  },
  {
    id: '2082-hol-krishna',
    title: 'Shree Krishna Janmashtami (श्रीकृष्ण जन्माष्टमी)',
    titleNp: 'श्रीकृष्ण जन्माष्टमी बिदा',
    name: 'Krishna Janmashtami',
    dateStr: '2025-08-17',
    bsDateStr: '२०८२ भदौ ०१',
    type: 'cultural',
    description: 'Lord Krishna Janmashtami Public Holiday',
  },
  {
    id: '2082-hol-gaura',
    title: 'Gaura Parba (गौरा पर्व)',
    titleNp: 'गौरा पर्व बिदा',
    name: 'Gaura Parba',
    dateStr: '2025-08-26',
    bsDateStr: '२०८२ भदौ १०',
    type: 'cultural',
    description: 'Traditional Cultural Festival Public Holiday',
  },
  {
    id: '2082-hol-teej',
    title: 'Haritalika Teej (हरितालिका तीज)',
    titleNp: 'हरितालिका तीज व्रत बिदा',
    name: 'Teej',
    dateStr: '2025-08-26',
    bsDateStr: '२०८२ भदौ १०',
    type: 'cultural',
    description: 'Haritalika Teej Celebration',
  },
  {
    id: '2082-hol-indra',
    title: 'Indra Jatra (इन्द्रजात्रा)',
    titleNp: 'इन्द्रजात्रा बिदा (काठमाडौं)',
    name: 'Indra Jatra',
    dateStr: '2025-09-06',
    bsDateStr: '२०८२ भदौ २१',
    type: 'cultural',
    description: 'Kathmandu Valley Traditional Indra Jatra',
  },
  {
    id: '2082-hol-const',
    title: 'Constitution Day (संविधान दिवस)',
    titleNp: 'राष्ट्रिय संविधान दिवस',
    name: 'Constitution Day',
    dateStr: '2025-09-19',
    bsDateStr: '२०८२ असोज ०३',
    type: 'state',
    description: 'National Constitution Day Public Holiday',
  },
  {
    id: '2082-hol-ghatasthapana',
    title: 'Ghatasthapana (घटस्थापना - दसैं प्रारम्भ)',
    titleNp: 'घटस्थापना बिदा',
    name: 'Ghatasthapana',
    dateStr: '2025-09-22',
    bsDateStr: '२०८२ असोज ०६',
    type: 'cultural',
    description: 'Commencement of Navaratri & Bada Dashain',
  },
  {
    id: '2082-hol-dashain',
    title: 'Bada Dashain Vacation (बडा दसैं बिदा)',
    titleNp: 'बडा दसैं बिदा (फूलपातीदेखि द्वादशीसम्म)',
    name: 'Bada Dashain Vacation',
    dateStr: '2025-09-29',
    endDateStr: '2025-10-04',
    bsDateStr: '२०८२ असोज १३ - १८',
    type: 'vacation',
    description: 'Annual National Autumn Festival Recess',
  },
  {
    id: '2082-hol-tihar',
    title: 'Tihar & Bhai Tika Recess (तिहार तथा भाइटीका)',
    titleNp: 'यमपञ्चक तथा तिहार बिदा',
    name: 'Tihar & Bhai Tika Recess',
    dateStr: '2025-10-21',
    endDateStr: '2025-10-25',
    bsDateStr: '२०८२ कात्तिक ०४ - ०८',
    type: 'vacation',
    description: 'Festival of Lights Yamapanchak Recess',
  },
  {
    id: '2082-hol-chhath',
    title: 'Chhath Parba (छठ पर्व)',
    titleNp: 'छठ पर्व राष्ट्रिय बिदा',
    name: 'Chhath Parba',
    dateStr: '2025-10-28',
    bsDateStr: '२०८२ कात्तिक ११',
    type: 'cultural',
    description: 'Sun God Worship Mahaparba Public Holiday',
  },
  {
    id: '2082-hol-xmas',
    title: 'Christmas Day (क्रिसमस डे)',
    titleNp: 'क्रिसमस डे सार्वजनिक बिदा',
    name: 'Christmas Day',
    dateStr: '2025-12-25',
    bsDateStr: '२०८२ पुस १०',
    type: 'cultural',
    description: 'Christmas Celebration',
  },
  {
    id: '2082-hol-tamu',
    title: 'Tamu Lhosar (तमु ल्होसार)',
    titleNp: 'तमु ल्होसार राष्ट्रिय बिदा',
    name: 'Tamu Lhosar',
    dateStr: '2025-12-30',
    bsDateStr: '२०८२ पुस १५',
    type: 'cultural',
    description: 'Gurung Community New Year',
  },
  {
    id: '2082-hol-maghe',
    title: 'Maghe Sankranti (माघे संक्रान्ति)',
    titleNp: 'माघे संक्रान्ति बिदा',
    name: 'Maghe Sankranti',
    dateStr: '2026-01-15',
    bsDateStr: '२०८२ माघ ०१',
    type: 'cultural',
    description: 'Makar Sankranti & Maghi Holiday',
  },
  {
    id: '2082-hol-sonam',
    title: 'Sonam Lhosar / Shahid Diwas (सोनाम ल्होसार तथा शहीद दिवस)',
    titleNp: 'सोनाम ल्होसार तथा शहीद दिवस',
    name: 'Sonam Lhosar',
    dateStr: '2026-01-30',
    bsDateStr: '२०८२ माघ १६',
    type: 'cultural',
    description: 'Tamang Community New Year & Martyrs Day',
  },
  {
    id: '2082-hol-shivaratri',
    title: 'Maha Shivaratri (महाशिवरात्री)',
    titleNp: 'महाशिवरात्री राष्ट्रिय बिदा',
    name: 'Maha Shivaratri',
    dateStr: '2026-02-16',
    bsDateStr: '२०८२ फागुन ०४',
    type: 'cultural',
    description: 'Great Night of Shiva Public Holiday',
  },
  {
    id: '2082-hol-prajatantra',
    title: 'National Democracy Day (राष्ट्रिय प्रजातन्त्र दिवस)',
    titleNp: 'राष्ट्रिय प्रजातन्त्र दिवस',
    name: 'Democracy Day',
    dateStr: '2026-02-19',
    bsDateStr: '२०८२ फागुन ०७',
    type: 'state',
    description: 'Commemoration of Democratic Revolution',
  },
  {
    id: '2082-hol-gyalpo',
    title: 'Gyalpo Lhosar (ग्याल्पो ल्होसार)',
    titleNp: 'ग्याल्पो ल्होसार बिदा',
    name: 'Gyalpo Lhosar',
    dateStr: '2026-03-02',
    bsDateStr: '२०८२ फागुन १८',
    type: 'cultural',
    description: 'Sherpa Community New Year',
  },
  {
    id: '2082-hol-women',
    title: 'International Women\'s Day (अन्तर्राष्ट्रिय महिला दिवस)',
    titleNp: 'अन्तर्राष्ट्रिय महिला दिवस',
    name: 'Womens Day',
    dateStr: '2026-03-08',
    bsDateStr: '२०८२ फागुन २४',
    type: 'state',
    description: 'International Women Rights Day',
  },
  {
    id: '2082-hol-holi',
    title: 'Fagu Purnima / Holi (होली पर्व)',
    titleNp: 'फागु पूर्णिमा (होली बिदा)',
    name: 'Holi',
    dateStr: '2026-03-03',
    bsDateStr: '२०८२ फागुन १९',
    type: 'cultural',
    description: 'Festival of Colors Holiday',
  },
  {
    id: '2082-hol-ghode',
    title: 'Ghode Jatra (घोडेजात्रा)',
    titleNp: 'घोडेजात्रा बिदा (काठमाडौं)',
    name: 'Ghode Jatra',
    dateStr: '2026-03-18',
    bsDateStr: '२०८२ चैत ०४',
    type: 'cultural',
    description: 'Traditional Horse Racing Festival',
  },
  {
    id: '2082-hol-ramnavami',
    title: 'Ram Navami (रामनवमी)',
    titleNp: 'रामनवमी बिदा',
    name: 'Ram Navami',
    dateStr: '2026-03-27',
    bsDateStr: '२०८२ चैत १३',
    type: 'cultural',
    description: 'Lord Ram Appearance Day',
  },

  // =========================================================================
  // 🇳🇵 YEAR 2083 B.S.
  // =========================================================================
  {
    id: '2083-hol-newyear',
    title: 'Nepali New Year 2083 (नयाँ वर्ष २०८३)',
    titleNp: 'नयाँ वर्ष २०८३ बिदा',
    name: 'Nepali New Year 2083',
    dateStr: '2026-04-14',
    bsDateStr: '२०८३ बैशाख ०१',
    type: 'state',
    description: 'National New Year Public Holiday',
  },
  {
    id: '2083-hol-majdoor',
    title: 'International Labor Day (मजदुर दिवस)',
    titleNp: 'अन्तर्राष्ट्रिय मजदुर दिवस',
    name: 'May Day',
    dateStr: '2026-05-01',
    bsDateStr: '२०८३ बैशाख १८',
    type: 'state',
    description: 'International Workers Day',
  },
  {
    id: '2083-hol-republic',
    title: 'Republic Day (गणतन्त्र दिवस)',
    titleNp: 'राष्ट्रिय गणतन्त्र दिवस',
    name: 'Ganatantra Diwas',
    dateStr: '2026-05-29',
    bsDateStr: '२०८३ जेठ १५',
    type: 'state',
    description: 'National Republic Day',
  },
  {
    id: '2083-hol-gaura',
    title: 'Gaura Parba (गौरा पर्व)',
    titleNp: 'गौरा पर्व बिदा',
    name: 'Gaura Parba',
    dateStr: '2026-09-04',
    bsDateStr: '२०८३ भदौ १९',
    type: 'cultural',
    description: 'Traditional Cultural Festival Public Holiday (Practicals Suspended)',
  },
  {
    id: '2083-hol-const',
    title: 'Constitution Day (संविधान दिवस)',
    titleNp: 'राष्ट्रिय संविधान दिवस',
    name: 'Constitution Day',
    dateStr: '2026-09-19',
    bsDateStr: '२०८३ असोज ०३',
    type: 'state',
    description: 'National Constitution Day Public Holiday',
  },
  {
    id: '2083-hol-dashain',
    title: 'Bada Dashain Vacation (बडा दसैं बिदा)',
    titleNp: 'बडा दसैं बिदा',
    name: 'Bada Dashain Vacation',
    dateStr: '2026-10-10',
    endDateStr: '2026-10-22',
    bsDateStr: '२०८३ असोज २४ - कात्तिक ०५',
    type: 'cultural',
    description: 'Annual National Autumn Festival Recess (13 Days)',
  },
  {
    id: '2083-hol-tihar',
    title: 'Tihar & Chhath Recess (तिहार तथा छठ बिदा)',
    titleNp: 'तिहार तथा छठ पर्व बिदा',
    name: 'Tihar & Chhath Recess',
    dateStr: '2026-11-08',
    endDateStr: '2026-11-13',
    bsDateStr: '२०८३ कात्तिक २३ - २८',
    type: 'cultural',
    description: 'Festival of Lights & Chhath Pooja Recess (6 Days)',
  },
  {
    id: '2083-hol-winter',
    title: 'Winter Vacation (हिउँदे बिदा)',
    titleNp: 'हिउँदे बिदा',
    name: 'Winter Vacation',
    dateStr: '2027-01-01',
    endDateStr: '2027-01-14',
    bsDateStr: '२०८३ पुस १७ - ३०',
    type: 'vacation',
    description: 'Mid-term Winter Vacation (14 Days)',
  },
  {
    id: '2083-hol-maghe',
    title: 'Maghe Sankranti (माघे संक्रान्ति)',
    titleNp: 'माघे संक्रान्ति बिदा',
    name: 'Maghe Sankranti',
    dateStr: '2027-01-15',
    bsDateStr: '२०८३ माघ ०१',
    type: 'cultural',
    description: 'Makar Sankranti National Public Holiday',
  },
  {
    id: '2083-hol-shivaratri',
    title: 'Maha Shivaratri (महाशिवरात्री)',
    titleNp: 'महाशिवरात्री बिदा',
    name: 'Maha Shivaratri',
    dateStr: '2027-03-06',
    bsDateStr: '२०८३ फागुन २२',
    type: 'cultural',
    description: 'Maha Shivaratri National Public Holiday',
  },
  {
    id: '2083-hol-holi',
    title: 'Holi / Fagu Purnima (होली पर्व)',
    titleNp: 'फागु पूर्णिमा बिदा',
    name: 'Fagu Purnima (Holi)',
    dateStr: '2027-03-22',
    bsDateStr: '२०८३ चैत ०८',
    type: 'cultural',
    description: 'Festival of Colors Public Holiday',
  },
  {
    id: '2083-hol-newyear-2084',
    title: 'Nepali New Year 2084 (नयाँ वर्ष २०८४)',
    titleNp: 'नयाँ वर्ष बिदा',
    name: 'Nepali New Year 2084',
    dateStr: '2027-04-14',
    bsDateStr: '२०८४ बैशाख ०१',
    type: 'state',
    description: 'National New Year Public Holiday',
  },
]

import { parseSlotTimeRange } from '@/lib/utils'

export const CANONICAL_PERIOD_SLOTS = [
  { id: 't1', label: '09:15 - 10:00', name: 'Pre-Period' },
  { id: 't2', label: '10:10 - 11:00', name: 'Period 1' },
  { id: 't3', label: '11:00 - 11:45', name: 'Period 2' },
  { id: 't4', label: '11:45 - 12:30', name: 'Period 3' },
  { id: 't5', label: '12:30 - 01:15', name: 'Period 4' },
  { id: 't6', label: '01:15 - 01:45', name: 'Break / Tiffin' },
  { id: 't7', label: '01:45 - 02:30', name: 'Period 5' },
  { id: 't8', label: '02:30 - 03:15', name: 'Period 6' },
  { id: 't9', label: '03:15 - 04:05', name: 'Period 7' },
  { id: 't10', label: '04:05 - 04:50', name: 'Period 8' },
]

export function computeCombinedTimeRange(
  slotId: string,
  span: number = 1,
  slotList?: Array<{ id: string; label: string; name?: string }>
): string {
  const effectiveSlots = slotList && slotList.length > 0 ? slotList : CANONICAL_PERIOD_SLOTS

  const startIdx = effectiveSlots.findIndex((t) => t.id === slotId)
  if (startIdx === -1) return '10:10 - 11:00'
  const startSlot = effectiveSlots[startIdx]
  const startTime = parseSlotTimeRange(startSlot.label).startTime

  const endIdx = Math.min(startIdx + span - 1, effectiveSlots.length - 1)
  const endSlot = effectiveSlots[endIdx]
  const endTime = parseSlotTimeRange(endSlot.label).endTime

  return `${startTime} - ${endTime}`
}

import { getNepaliDate, toNepaliDigits, getNepalDateStr } from '@/lib/nepali-date'

export function getOrderedDays(startDay: 'sun' | 'mon' = 'sun') {
  if (startDay === 'mon') {
    return [
      DAYS.find((d) => d.id === 'mon')!,
      DAYS.find((d) => d.id === 'tue')!,
      DAYS.find((d) => d.id === 'wed')!,
      DAYS.find((d) => d.id === 'thu')!,
      DAYS.find((d) => d.id === 'fri')!,
      DAYS.find((d) => d.id === 'sat')!,
      DAYS.find((d) => d.id === 'sun')!,
    ]
  }
  return [...DAYS]
}

export function getWeekDates(baseDate: Date = new Date(), startDay: 'sun' | 'mon' = 'sun') {
  const currentDay = baseDate.getDay() // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const startDayOffset = startDay === 'mon' ? (currentDay === 0 ? 6 : currentDay - 1) : currentDay
  const startDate = new Date(baseDate)
  startDate.setDate(baseDate.getDate() - startDayOffset)

  const orderedDays = getOrderedDays(startDay)

  return orderedDays.map((d, index) => {
    const dayDate = new Date(startDate)
    dayDate.setDate(startDate.getDate() + index)
    const dateStr = getNepalDateStr(dayDate)
    const dayNum = dayDate.getDate()
    const monthName = dayDate.toLocaleDateString('en-US', { month: 'short' })
    const nepaliInfo = getNepaliDate(dayDate)

    return {
      dayKey: d.id,
      dateStr,
      formattedEng: `${dayNum} ${monthName}`,
      formattedNp: `${toNepaliDigits(nepaliInfo.bsDay)} ${nepaliInfo.bsMonthNameNp}`, // e.g. "१७ भदौ"
      nepaliFull: nepaliInfo.formattedDateNp,
      isWeekend: d.isWeekend,
    }
  })
}

export function formatGradeBadge(grade: string, subjectCode?: string): string {
  if (!grade) return '12C'
  let clean = grade.replace(/Class\s*/i, '').trim()
  if (clean === '12') {
    if (subjectCode?.includes('COMP')) return '12C'
    if (subjectCode?.includes('CHEM') || subjectCode?.includes('PHY')) return '12 Sc'
    if (subjectCode?.includes('MGT')) return '12 Mgt'
    return '12C'
  }
  if (clean === '11') {
    if (subjectCode?.includes('COMP')) return '11C'
    if (subjectCode?.includes('MGT')) return '11 Mgt'
    return '11 Sc'
  }
  if (clean === '10') return '10A'
  if (clean === '9') return '9B'
  if (clean === '8') return '8A'
  if (clean === '7') return '7B'
  if (clean === '6') return '6A'
  return clean
}

export function formatCleanSubjectCode(subjectCode: string, grade?: string): string {
  if (!subjectCode) return 'PRAC'
  // If already contains sub-class suffix like -12C, -11SC, -10A, -7C, -6A, return uppercase
  if (/-[0-9]+[A-Za-z]+$/i.test(subjectCode)) {
    return subjectCode.toUpperCase()
  }
  if (grade) {
    const cleanBadge = formatGradeBadge(grade, subjectCode)
    const normalizedBadge = cleanBadge.replace(/\s+/g, '').toUpperCase()
    const match = subjectCode.match(/^([A-Za-z]+)[-\s]?([0-9]+)?/i)
    if (match) {
      const prefix = match[1].toUpperCase()
      return `${prefix}-${normalizedBadge}`
    }
  }
  return subjectCode.toUpperCase()
}

/**
 * Strips any redundant subject code or prefix from the subject title.
 * e.g. "BIO-12 – Cell Biology & Genetics Lab" -> "Cell Biology & Genetics Lab"
 */
export function cleanSubjectTitle(subjectCode?: string, subjectTitle?: string): string {
  if (!subjectTitle) return ''
  const trimmed = subjectTitle.trim()
  if (!subjectCode) return trimmed

  const cleanCode = formatCleanSubjectCode(subjectCode)
  const escapedRaw = subjectCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const escapedClean = cleanCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const pattern = new RegExp(`^(${escapedRaw}|${escapedClean})\\s*[-–—:]\\s*`, 'i')

  const stripped = trimmed.replace(pattern, '').trim()
  return stripped || trimmed
}

/**
 * Generates an elegant, non-repeating display heading for a subject session card.
 * e.g. "BIO-12 — Cell Biology & Genetics Lab".
 * Never duplicates like "BIO-12 — BIO-12 – Cell Biology".
 */
export function formatSubjectHeading(subjectCode?: string, subjectTitle?: string): string {
  const code = formatCleanSubjectCode(subjectCode || '')
  if (!subjectTitle) return code || 'Practical Session'
  const cleanTitle = cleanSubjectTitle(subjectCode, subjectTitle)
  if (!code) return cleanTitle
  if (cleanTitle.toLowerCase() === code.toLowerCase()) return code
  return `${code} — ${cleanTitle}`
}

/**
 * Formats a clean, canonical label for a class batch dropdown option.
 * Strictly presents the grade and section without misleading room capacity numbers,
 * stream names, or the literal word 'section'.
 * E.g. { name: "12 Eng", section: "Eng" } -> "12 Eng"
 * E.g. { name: "12", section: "Eng" } -> "12 Eng"
 * E.g. { name: "8A", section: "A" } -> "8A"
 */
export function formatClassBatchLabel(cls?: { name?: string; section?: string | null } | null): string {
  if (!cls) return ''
  const name = (cls.name || '').trim()
  const rawSection = (cls.section || '').trim()
  const cleanSection = rawSection.replace(/^(?:section|sec)[\s.:_-]*/i, '').trim()

  if (!name) return cleanSection
  if (!cleanSection) return name

  // If name already contains the clean section (e.g. "12 Eng" contains "Eng", or "8A" contains "A")
  const regex = new RegExp(`\\b${cleanSection.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
  if (regex.test(name) || name.toLowerCase().endsWith(cleanSection.toLowerCase())) {
    return name
  }

  return `${name} ${cleanSection}`
}

export interface ClassBatchItem {
  id: string
  name: string // e.g. "12C"
  fullName: string // e.g. "12C - Tech Stream Sec A"
  stream: string
  strength: number
}

export interface SubjectItem {
  code: string
  title: string
  fullName: string
  grade: string
  lab: string
  labId: string
  teacherId: string
  defaultTopic?: string
  quota: number
}

export function computeMultiPeriodLabel(
  periodIds: string[],
  slotList?: Array<{ id: string; label: string; name?: string }>
): { label: string; timeRange: string } {
  if (!periodIds || periodIds.length === 0) {
    return { label: 'Period 1 (10:10 - 11:00)', timeRange: '10:10 - 11:00' }
  }

  const effectiveSlots = slotList && slotList.length > 0 ? slotList : CANONICAL_PERIOD_SLOTS

  const sorted = [...periodIds].sort((a, b) => {
    if (effectiveSlots && effectiveSlots.length > 0) {
      const aIdx = effectiveSlots.findIndex((p) => p.id === a)
      const bIdx = effectiveSlots.findIndex((p) => p.id === b)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
    }
    const aNum = parseInt(a.replace(/\D/g, ''), 10) || 0
    const bNum = parseInt(b.replace(/\D/g, ''), 10) || 0
    return aNum - bNum
  })

  const firstSlot = effectiveSlots?.find((p) => p.id === sorted[0])
  const lastSlot = effectiveSlots?.find((p) => p.id === sorted[sorted.length - 1]) || firstSlot

  const startTime = firstSlot ? parseSlotTimeRange(firstSlot.label).startTime : '10:10'
  const endTime = lastSlot ? parseSlotTimeRange(lastSlot.label).endTime : '11:00'

  const names = sorted
    .map((id) => {
      const slot = effectiveSlots?.find((p) => p.id === id)
      return slot ? slot.name : id
    })
    .join(' & ')

  return {
    label: `${names} (${startTime} - ${endTime})`,
    timeRange: `${startTime} - ${endTime}`,
  }
}

export const GRADE_STRENGTH: Record<string, number> = {
  '12C': 38,
  '12 Sc': 40,
  '12 Mgt': 36,
  '11C': 42,
  '11 Sc': 38,
  '10A': 35,
  '9B': 36,
  '8A': 32,
  '7B': 30,
  '6A': 28,
  'Class 12': 38,
  'Class 11': 42,
  'Class 10': 35,
  'Class 9': 36,
  'Class 8': 32,
  'Class 7': 30,
  'Class 6': 28,
}

/**
 * Fuzzy check if two class/grade identifiers belong to the same level / cohort
 * e.g. "12 Eng" matches "12", "Class 12", "12 Eng", "12C", "12 Sc"
 */
export function matchesGrade(classOrGradeA?: string | null, classOrGradeB?: string | null): boolean {
  if (!classOrGradeA || !classOrGradeB) return true
  const normA = classOrGradeA.trim().toLowerCase().replace(/^class\s+/i, '')
  const normB = classOrGradeB.trim().toLowerCase().replace(/^class\s+/i, '')
  
  if (normA === normB) return true

  const cleanA = normA.replace(/[^a-z0-9]/g, '')
  const cleanB = normB.replace(/[^a-z0-9]/g, '')
  if (cleanA === cleanB) return true

  const numA = normA.match(/\d+/)?.[0]
  const numB = normB.match(/\d+/)?.[0]

  if (numA && numB && numA !== numB) return false

  const suffixA = cleanA.replace(/^\d+/, '')
  const suffixB = cleanB.replace(/^\d+/, '')

  // If both have explicit section/stream suffixes, they must match
  if (suffixA && suffixB) {
    if (suffixA === suffixB) return true
    if (suffixA.length === 1 && suffixB.length === 1 && suffixA !== suffixB) {
      return false
    }
    const isMgtA = suffixA.startsWith('mg') || suffixA === 'm'
    const isMgtB = suffixB.startsWith('mg') || suffixB === 'm'
    const isSciA = suffixA.startsWith('sc') || suffixA === 's' || suffixA === 'c'
    const isSciB = suffixB.startsWith('sc') || suffixB === 's' || suffixB === 'c'
    if ((isMgtA && isSciB) || (isMgtB && isSciA)) return false
    return suffixA.startsWith(suffixB) || suffixB.startsWith(suffixA)
  }

  if (numA && numB && numA === numB) {
    return true
  }

  return false
}

