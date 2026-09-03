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
  lab: 'Computer Lab' | 'Physics Lab' | 'Chemistry Lab' | 'Biology Lab' | 'Electronics Lab'
  labKey: 'comp' | 'phys' | 'chem' | 'bio' | 'elec'
  defaultStudents: number
  category: 'Computer' | 'Physics' | 'Chemistry' | 'Biology' | 'Electronics' | 'General'
  dotColor: string
  accentColor: string
  badgeColor: string
  mergedParts?: [MergedSessionPart, MergedSessionPart]
}

export interface HolidayItem {
  id: string
  title: string
  titleNp?: string
  dateStr: string // YYYY-MM-DD (Start Date)
  endDateStr?: string // YYYY-MM-DD (End Date for multi-day vacations)
  bsDateStr?: string // e.g. "२०८३ असोज २४ - कात्तिक ५"
  type: 'state' | 'cultural' | 'department' | 'weekend' | 'vacation'
  description?: string
}

export function isDateWithinHoliday(dateInput: string | Date, holiday: HolidayItem): boolean {
  const dStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : getNepalDateStr(dateInput)
  if (!holiday.endDateStr || holiday.endDateStr === holiday.dateStr) {
    return dStr === holiday.dateStr
  }
  return dStr >= holiday.dateStr && dStr <= holiday.endDateStr
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
  {
    id: 'hol-const',
    title: 'Constitution Day (संविधान दिवस)',
    titleNp: 'राष्ट्रिय संविधान दिवस',
    dateStr: '2026-09-19',
    bsDateStr: '२०८३ असोज ०३',
    type: 'state',
    description: 'National Constitution Day Public Holiday',
  },
  {
    id: 'hol-dashain',
    title: 'Bada Dashain Vacation (बडा दसैं बिदा)',
    titleNp: 'बडा दसैं बिदा',
    dateStr: '2026-10-10',
    endDateStr: '2026-10-22',
    bsDateStr: '२०८३ असोज २४ - कात्तिक ०५',
    type: 'cultural',
    description: 'Annual National Autumn Festival Recess (13 Days)',
  },
  {
    id: 'hol-tihar',
    title: 'Tihar & Chhath Recess (तिहार तथा छठ बिदा)',
    titleNp: 'तिहार तथा छठ पर्व बिदा',
    dateStr: '2026-11-08',
    endDateStr: '2026-11-13',
    bsDateStr: '२०८३ कात्तिक २३ - २८',
    type: 'cultural',
    description: 'Festival of Lights & Chhath Pooja Recess (6 Days)',
  },
  {
    id: 'hol-winter',
    title: 'Winter Vacation (हिउँदे बिदा)',
    titleNp: 'हिउँदे बिदा',
    dateStr: '2027-01-01',
    endDateStr: '2027-01-14',
    bsDateStr: '२०८३ पुस १७ - ३०',
    type: 'vacation',
    description: 'Mid-term Winter Vacation (14 Days)',
  },
]

export function computeCombinedTimeRange(slotId: string, span: number = 1): string {
  const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === slotId)
  if (startIdx === -1) return '10:10 - 11:00'
  const startSlot = MASTER_TIME_SLOTS[startIdx]
  const startTime = startSlot.label.split(' - ')[0]

  const endIdx = Math.min(startIdx + span - 1, MASTER_TIME_SLOTS.length - 1)
  const endSlot = MASTER_TIME_SLOTS[endIdx]
  const endTime = endSlot.label.includes(' - ') ? endSlot.label.split(' - ')[1] : endSlot.label

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

export interface ClassBatchItem {
  id: string
  name: string // e.g. "12C"
  fullName: string // e.g. "12C - Tech Stream Sec A"
  stream: string
  strength: number
}

export const DEFAULT_CLASSES: ClassBatchItem[] = [
  { id: '12c', name: '12C', fullName: '12C - Tech Stream Sec A (Computer)', stream: 'Computer Engineering', strength: 38 },
  { id: '12sc', name: '12 Sc', fullName: '12 Sc - Science Stream Sec B', stream: 'General Science', strength: 40 },
  { id: '12mgt', name: '12 Mgt', fullName: '12 Mgt - Management Stream', stream: 'Management', strength: 36 },
  { id: '11c', name: '11C', fullName: '11C - Tech Stream Sec A (Computer)', stream: 'Computer Engineering', strength: 42 },
  { id: '11sc', name: '11 Sc', fullName: '11 Sc - Science Stream Sec B', stream: 'General Science', strength: 38 },
  { id: '10a', name: '10A', fullName: '10A - Vocational Technical', stream: 'Secondary Technical', strength: 35 },
  { id: '9b', name: '9B', fullName: '9B - Pre-Engineering', stream: 'Secondary Technical', strength: 36 },
  { id: '8a', name: '8A', fullName: '8A - General Science', stream: 'Basic Level', strength: 32 },
  { id: '7b', name: '7B', fullName: '7B - General Science', stream: 'Basic Level', strength: 30 },
  { id: '6a', name: '6A', fullName: '6A - Basic Science & Computing', stream: 'Basic Level', strength: 28 },
]

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

export const DEFAULT_SUBJECTS: SubjectItem[] = [
  // Class 12C (Computer Engineering)
  {
    code: 'COMP-12',
    title: 'Data Structures & Algorithms',
    fullName: 'COMP-12 — Data Structures & Algorithms Lab',
    grade: '12C',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Verification of Binary Search Tree Operations & Node Insertion',
    quota: 12
  },
  {
    code: 'ELEC-12',
    title: 'Digital Electronics & Logic Gates',
    fullName: 'ELEC-12 — Digital Electronics & Logic Gates',
    grade: '12C',
    lab: 'Electronics & Hardware Lab',
    labId: 'elec',
    teacherId: 't4',
    defaultTopic: 'Design and Implementation of Combinational Half & Full Adders',
    quota: 10
  },

  // Class 12 Sc (General Science)
  {
    code: 'CHEM-12',
    title: 'Analytical Chemistry Practicals',
    fullName: 'CHEM-12 — Analytical Chemistry Practicals',
    grade: '12 Sc',
    lab: 'Chemistry Laboratory',
    labId: 'chem',
    teacherId: 't3',
    defaultTopic: 'Volumetric Titration of Sodium Carbonate against Standard Oxalic Acid',
    quota: 10
  },
  {
    code: 'PHY-12',
    title: 'Modern Physics & Wave Optics',
    fullName: 'PHY-12 — Modern Physics & Wave Optics Lab',
    grade: '12 Sc',
    lab: 'Physics Laboratory',
    labId: 'phys',
    teacherId: 't2',
    defaultTopic: 'Determination of Wavelength of Sodium Light by Diffraction Grating',
    quota: 10
  },
  {
    code: 'BIO-12',
    title: 'Plant Physiology & Genetics',
    fullName: 'BIO-12 — Plant Physiology & Genetics Lab',
    grade: '12 Sc',
    lab: 'Biology & Life Sciences Lab',
    labId: 'bio',
    teacherId: 't5',
    defaultTopic: 'Observation of Stages of Mitosis in Onion Root Tip Cells',
    quota: 8
  },

  // Class 12 Mgt (Management)
  {
    code: 'COMP-12M',
    title: 'Computer Applications & Spreadsheets',
    fullName: 'COMP-12M — Business Computing & Spreadsheets Lab',
    grade: '12 Mgt',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Financial Modeling, Pivot Tables & Macro Automation in Excel',
    quota: 8
  },

  // Class 11C (Computer Engineering)
  {
    code: 'COMP-11',
    title: 'C Programming & Logic Development',
    fullName: 'COMP-11 — C Programming & Logic Development Lab',
    grade: '11C',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Implementation of Multi-Dimensional Arrays and Pointer Arithmetic',
    quota: 12
  },
  {
    code: 'ELEC-11',
    title: 'Basic Electrical & Circuit Simulation',
    fullName: 'ELEC-11 — Basic Electrical & Circuit Simulation',
    grade: '11C',
    lab: 'Electronics & Hardware Lab',
    labId: 'elec',
    teacherId: 't4',
    defaultTopic: "Verification of Kirchhoff's Current & Voltage Laws (KCL / KVL)",
    quota: 10
  },

  // Class 11 Sc (General Science)
  {
    code: 'PHY-11',
    title: 'Optics & Wave Mechanics',
    fullName: 'PHY-11 — Optics & Wave Mechanics Lab',
    grade: '11 Sc',
    lab: 'Physics Laboratory',
    labId: 'phys',
    teacherId: 't2',
    defaultTopic: 'Determination of Focal Length of Convex Lens using u-v Method',
    quota: 10
  },
  {
    code: 'CHEM-11',
    title: 'Inorganic & General Chemistry Lab',
    fullName: 'CHEM-11 — Inorganic & General Chemistry Lab',
    grade: '11 Sc',
    lab: 'Chemistry Laboratory',
    labId: 'chem',
    teacherId: 't3',
    defaultTopic: 'Preparation of Standard M/10 Solution of Mohr Salt',
    quota: 10
  },
  {
    code: 'BIO-11',
    title: 'Cell Biology & Microbiology',
    fullName: 'BIO-11 — Cell Biology & Microbiology Lab',
    grade: '11 Sc',
    lab: 'Biology & Life Sciences Lab',
    labId: 'bio',
    teacherId: 't5',
    defaultTopic: 'Study of Bacteria and Fungi using Compound Light Microscope',
    quota: 8
  },

  // Class 10A (Technical)
  {
    code: 'DBMS-10',
    title: 'Database Management Systems',
    fullName: 'DBMS-10 — Database Management Systems Lab',
    grade: '10A',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'DDL and DML Queries with Relational Constraints in PostgreSQL',
    quota: 10
  },
  {
    code: 'SCI-10',
    title: 'Secondary Applied Science Lab',
    fullName: 'SCI-10 — Secondary Applied Science Lab',
    grade: '10A',
    lab: 'Physics Laboratory',
    labId: 'phys',
    teacherId: 't2',
    defaultTopic: "Verification of Ohm's Law and Series/Parallel Resistors",
    quota: 8
  },

  // Class 9B (Pre-Engineering)
  {
    code: 'WPD-9',
    title: 'Web Page Design & Development',
    fullName: 'WPD-9 — Web Page Design & Development Lab',
    grade: '9B',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Responsive CSS Grid and Flexbox UI Layouts with Semantic HTML5',
    quota: 8
  },
  {
    code: 'SCI-9',
    title: 'Integrated Science Practicals',
    fullName: 'SCI-9 — Integrated Science Practicals',
    grade: '9B',
    lab: 'Chemistry Laboratory',
    labId: 'chem',
    teacherId: 't3',
    defaultTopic: 'Identification of Acidic and Basic Radicals in Inorganic Salts',
    quota: 8
  },

  // Class 8A (Basic Level)
  {
    code: 'ICT-8',
    title: 'Information Technology Basics',
    fullName: 'ICT-8 — Information Technology Basics',
    grade: '8A',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Spreadsheets Formatting and Basic Presentation Animations',
    quota: 6
  },
  {
    code: 'SCI-8',
    title: 'General Science Practicals',
    fullName: 'SCI-8 — General Science Practicals',
    grade: '8A',
    lab: 'Physics Laboratory',
    labId: 'phys',
    teacherId: 't2',
    defaultTopic: 'Measurement of Density of Irregular Solids using Archimedes Principle',
    quota: 6
  },

  // Class 7B (Basic Level)
  {
    code: 'ICT-7',
    title: 'Computer Applications Lab',
    fullName: 'ICT-7 — Computer Applications Lab',
    grade: '7B',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Word Processing Formatting and Typographic Styles',
    quota: 6
  },
  {
    code: 'SCI-7',
    title: 'General Science Observations',
    fullName: 'SCI-7 — General Science Observations',
    grade: '7B',
    lab: 'Biology & Life Sciences Lab',
    labId: 'bio',
    teacherId: 't5',
    defaultTopic: 'Parts of Flowering Plants and Leaf Venation Classification',
    quota: 6
  },

  // Class 6A (Basic Level)
  {
    code: 'SCI-6',
    title: 'Basic Science & Computing Lab',
    fullName: 'SCI-6 — Basic Science & Computing Lab',
    grade: '6A',
    lab: 'Computer Engineering Lab 01',
    labId: 'comp',
    teacherId: 't1',
    defaultTopic: 'Introduction to Computer Peripherals and Paint Drawing Utilities',
    quota: 6
  },
]

export function computeMultiPeriodLabel(periodIds: string[]): { label: string; timeRange: string } {
  if (!periodIds || periodIds.length === 0) {
    return { label: 'Period 1 (10:10 - 11:00)', timeRange: '10:10 - 11:00' }
  }

  const sorted = [...periodIds].sort((a, b) => {
    const aIdx = MASTER_TIME_SLOTS.findIndex((p) => p.id === a)
    const bIdx = MASTER_TIME_SLOTS.findIndex((p) => p.id === b)
    return aIdx - bIdx
  })

  const firstSlot = MASTER_TIME_SLOTS.find((p) => p.id === sorted[0]) || MASTER_TIME_SLOTS[1]
  const lastSlot = MASTER_TIME_SLOTS.find((p) => p.id === sorted[sorted.length - 1]) || firstSlot

  const startTime = firstSlot.label.split(' - ')[0]
  const endTime = lastSlot.label.includes(' - ') ? lastSlot.label.split(' - ')[1] : lastSlot.label

  const names = sorted
    .map((id) => {
      const slot = MASTER_TIME_SLOTS.find((p) => p.id === id)
      return slot ? slot.name : id
    })
    .join(' & ')

  return {
    label: `${names} (${startTime} - ${endTime})`,
    timeRange: `${startTime} - ${endTime}`,
  }
}

export const LAB_ROOMS = [
  { id: 'comp', name: 'Computer Engineering Lab 01', code: 'LAB-COMP-01', capacity: 40, color: 'indigo', type: 'computer_lab' },
  { id: 'phys', name: 'Physics Laboratory', code: 'LAB-PHYS-01', capacity: 38, color: 'cyan', type: 'physics_lab' },
  { id: 'chem', name: 'Chemistry Laboratory', code: 'LAB-CHEM-01', capacity: 40, color: 'rose', type: 'chemistry_lab' },
  { id: 'bio', name: 'Biology & Life Sciences Lab', code: 'LAB-BIO-01', capacity: 35, color: 'emerald', type: 'biology_lab' },
  { id: 'elec', name: 'Electronics & Hardware Lab', code: 'LAB-ELEC-01', capacity: 30, color: 'amber', type: 'electronics_lab' },
]

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

export const MASTER_TIME_SLOTS = [
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

// Master 2083 Routine dataset with COMP, PHY, CHEM, DBMS short codes
export const MASTER_ROUTINE: MasterRoutineItem[] = [
  // ==================== SUNDAY ====================
  {
    id: 'sun-1',
    day: 'Sunday',
    dayKey: 'sun',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'COMP-12',
    subjectTitle: 'Data Structures Lab',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'Dr. Rajesh Sharma',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'sun-2',
    day: 'Sunday',
    dayKey: 'sun',
    timeSlot: '11:00 - 12:30',
    slotId: 't3',
    span: 2,
    subjectCode: 'CHEM-12',
    subjectTitle: 'Titration & Organic Analysis',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'Ms. Sunita Thapa',
    lab: 'Chemistry Lab',
    labKey: 'chem',
    defaultStudents: 40,
    category: 'Chemistry',
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/60',
    accentColor: 'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-zinc-950 dark:text-white border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'sun-3',
    day: 'Sunday',
    dayKey: 'sun',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'PHY-11',
    subjectTitle: 'Optics & Mechanics',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'Dr. Prakash Adhikari',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 38,
    category: 'Physics',
    dotColor: 'bg-cyan-500',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/60',
    accentColor: 'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-zinc-950 dark:text-white border-cyan-200 dark:border-cyan-500/30',
  },
  {
    id: 'sun-4',
    day: 'Sunday',
    dayKey: 'sun',
    timeSlot: '01:45 - 03:15',
    slotId: 't7',
    span: 2,
    subjectCode: 'DBMS-10',
    subjectTitle: 'SQL Database Management',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'Er. Anish Karki',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'sun-5',
    day: 'Sunday',
    dayKey: 'sun',
    timeSlot: '03:15 - 04:50',
    slotId: 't9',
    span: 2,
    subjectCode: 'BIO-11',
    subjectTitle: 'Microbiology & Cell Biology',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'Dr. Nirmala Poudel',
    lab: 'Biology Lab',
    labKey: 'bio',
    defaultStudents: 35,
    category: 'Biology',
    dotColor: 'bg-emerald-500',
    badgeColor: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700/60',
    accentColor: 'border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-zinc-950 dark:text-white border-emerald-200 dark:border-emerald-500/30',
  },

  // ==================== MONDAY ====================
  {
    id: 'mon-1',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'COMP-12',
    subjectTitle: 'Computer Science',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'COMP12-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'mon-2',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '11:45 - 12:30',
    slotId: 't4',
    span: 1,
    subjectCode: 'PHY-12',
    subjectTitle: 'Physics Lab',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'PHY12-Teacher',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 38,
    category: 'Physics',
    dotColor: 'bg-cyan-500',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/60',
    accentColor: 'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-zinc-950 dark:text-white border-cyan-200 dark:border-cyan-500/30',
  },
  // Monday Period 4 (12:30-1:15) - Parallel Session 1: PHY-12
  {
    id: 'mon-3a',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'PHY-12',
    subjectTitle: 'Physics Lab',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'PHY12-Teacher',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 38,
    category: 'Physics',
    dotColor: 'bg-cyan-500',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/60',
    accentColor: 'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-zinc-950 dark:text-white border-cyan-200 dark:border-cyan-500/30',
  },
  // Monday Period 4 (12:30-1:15) - Parallel Session 2: COMP-7C
  {
    id: 'mon-3b',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'COMP-7C',
    subjectTitle: 'Comp (Sec C)',
    grade: 'Class 7',
    gradeKey: 'class-7',
    teacher: 'COMP7-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 30,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'mon-4',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '01:15 - 01:45',
    slotId: 't6',
    span: 1,
    subjectCode: 'JAVA-12',
    subjectTitle: 'Java Programming',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'JAVA12-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'mon-5',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '01:45 - 02:30',
    slotId: 't7',
    span: 1,
    subjectCode: 'DBMS-10',
    subjectTitle: 'Database Mgmt',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'DBMS10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'mon-6',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '02:30 - 04:05',
    slotId: 't8',
    span: 2,
    subjectCode: 'WMAD/OS-11',
    subjectTitle: 'Web & Mobile / OS',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'WMADOS11-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 42,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'mon-7',
    day: 'Monday',
    dayKey: 'mon',
    timeSlot: '04:05 - 04:50',
    slotId: 't10',
    span: 1,
    subjectCode: 'CP-9',
    subjectTitle: 'Computer Prog',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'CP9-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 36,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },

  // ==================== TUESDAY ====================
  // Tuesday Period 1 (10:10-11:00) - Parallel Session 1: DDMP-10 (Computer Lab)
  {
    id: 'tue-1a',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'DDMP-10',
    subjectTitle: 'Digital Design & MP',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'DDMP10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Electronics',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/60',
    accentColor: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-zinc-950 dark:text-white border-amber-200 dark:border-amber-500/30',
  },
  // Tuesday Period 1 (10:10-11:00) - Parallel Session 2: CHEM-12 (Chemistry Lab)
  {
    id: 'tue-1b',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'CHEM-12',
    subjectTitle: 'Chemistry Lab',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'CHEM12-Teacher',
    lab: 'Chemistry Lab',
    labKey: 'chem',
    defaultStudents: 38,
    category: 'Chemistry',
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/60',
    accentColor: 'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-zinc-950 dark:text-white border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'tue-2',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '11:00 - 11:45',
    slotId: 't3',
    span: 1,
    subjectCode: 'CHEM-12',
    subjectTitle: 'Chemistry Lab',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'CHEM12-Teacher',
    lab: 'Chemistry Lab',
    labKey: 'chem',
    defaultStudents: 38,
    category: 'Chemistry',
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/60',
    accentColor: 'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-zinc-950 dark:text-white border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'tue-3',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'COMP-7AB',
    subjectTitle: 'Comp (Sec A/B)',
    grade: 'Class 7',
    gradeKey: 'class-7',
    teacher: 'COMP7-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 30,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'tue-4',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '01:45 - 02:30',
    slotId: 't7',
    span: 1,
    subjectCode: 'DBMS-10',
    subjectTitle: 'Database Mgmt',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'DBMS10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'tue-5',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '02:30 - 03:15',
    slotId: 't8',
    span: 1,
    subjectCode: 'COA-11',
    subjectTitle: 'Comp Org & Arch',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'COA11-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 42,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'tue-6',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '03:15 - 04:05',
    slotId: 't9',
    span: 1,
    subjectCode: 'VP-12',
    subjectTitle: 'Visual Prog',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'VP12-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'tue-7',
    day: 'Tuesday',
    dayKey: 'tue',
    timeSlot: '04:05 - 04:50',
    slotId: 't10',
    span: 1,
    subjectCode: 'CP-9',
    subjectTitle: 'Computer Prog',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'CP9-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 36,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },

  // ==================== WEDNESDAY ====================
  {
    id: 'wed-1',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'DDMP-10',
    subjectTitle: 'Digital Design & MP',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'DDMP10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Electronics',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/60',
    accentColor: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-zinc-950 dark:text-white border-amber-200 dark:border-amber-500/30',
  },
  // Wednesday Period 2 (11:00-11:45) - Parallel Session 1: OS-11 (Computer Lab)
  {
    id: 'wed-2a',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '11:00 - 11:45',
    slotId: 't3',
    span: 1,
    subjectCode: 'OS-11',
    subjectTitle: 'Operating System',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'OS11-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 42,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  // Wednesday Period 2 (11:00-11:45) - Parallel Session 2: CHEM-11 (Chemistry Lab)
  {
    id: 'wed-2b',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '11:00 - 11:45',
    slotId: 't3',
    span: 1,
    subjectCode: 'CHEM-11',
    subjectTitle: 'Chemistry Lab',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'CHEM11-Teacher',
    lab: 'Chemistry Lab',
    labKey: 'chem',
    defaultStudents: 42,
    category: 'Chemistry',
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/60',
    accentColor: 'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-zinc-950 dark:text-white border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'wed-3',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'FES-9',
    subjectTitle: 'Fund. Electrical Sys',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'FES9-Teacher',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 36,
    category: 'Electronics',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/60',
    accentColor: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-zinc-950 dark:text-white border-amber-200 dark:border-amber-500/30',
  },
  {
    id: 'wed-4',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '01:45 - 02:30',
    slotId: 't7',
    span: 1,
    subjectCode: 'COMP-6AB',
    subjectTitle: 'Comp (Sec A/B)',
    grade: 'Class 6',
    gradeKey: 'class-6',
    teacher: 'COMP6-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 28,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'wed-5',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '02:30 - 03:15',
    slotId: 't8',
    span: 1,
    subjectCode: 'COA-11',
    subjectTitle: 'Comp Org & Arch',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'COA11-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 42,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'wed-6',
    day: 'Wednesday',
    dayKey: 'wed',
    timeSlot: '03:15 - 04:05',
    slotId: 't9',
    span: 1,
    subjectCode: 'COMP-8AB',
    subjectTitle: 'Comp (Sec A/B)',
    grade: 'Class 8',
    gradeKey: 'class-8',
    teacher: 'COMP8-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 32,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },

  // ==================== THURSDAY ====================
  {
    id: 'thu-1',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '09:15 - 10:00',
    slotId: 't1',
    span: 1,
    subjectCode: 'WPD-9',
    subjectTitle: 'Web Page Design',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'WPD9-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 36,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  // Thursday Period 1 (10:10-11:00) - Parallel Session 1: FCA-9 (Computer Lab)
  {
    id: 'thu-2a',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'FCA-9',
    subjectTitle: 'Fund. Computer App',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'FCA9-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 36,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  // Thursday Period 1 (10:10-11:00) - Parallel Session 2: CHEM-11 (Chemistry Lab)
  {
    id: 'thu-2b',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'CHEM-11',
    subjectTitle: 'Chemistry Lab',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'CHEM11-Teacher',
    lab: 'Chemistry Lab',
    labKey: 'chem',
    defaultStudents: 42,
    category: 'Chemistry',
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/60',
    accentColor: 'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-zinc-950 dark:text-white border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'thu-3',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '11:00 - 11:45',
    slotId: 't3',
    span: 1,
    subjectCode: 'CHEM-11',
    subjectTitle: 'Chemistry Lab',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'CHEM11-Teacher',
    lab: 'Chemistry Lab',
    labKey: 'chem',
    defaultStudents: 42,
    category: 'Chemistry',
    dotColor: 'bg-rose-500',
    badgeColor: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700/60',
    accentColor: 'border-l-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-zinc-950 dark:text-white border-rose-200 dark:border-rose-500/30',
  },
  {
    id: 'thu-4',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'FES-9',
    subjectTitle: 'Fund. Electrical Sys',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'FES9-Teacher',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 36,
    category: 'Electronics',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/60',
    accentColor: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-zinc-950 dark:text-white border-amber-200 dark:border-amber-500/30',
  },
  {
    id: 'thu-5',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '02:30 - 03:15',
    slotId: 't8',
    span: 1,
    subjectCode: 'SEP-12',
    subjectTitle: 'Software Eng & Proj',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'SEP12-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'thu-6',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '03:15 - 04:05',
    slotId: 't9',
    span: 1,
    subjectCode: 'CRM-10',
    subjectTitle: 'Computer Repair',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'CRM10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Electronics',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/60',
    accentColor: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-zinc-950 dark:text-white border-amber-200 dark:border-amber-500/30',
  },
  {
    id: 'thu-7',
    day: 'Thursday',
    dayKey: 'thu',
    timeSlot: '04:05 - 04:50',
    slotId: 't10',
    span: 1,
    subjectCode: 'OOP-10',
    subjectTitle: 'OOP (C++)',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'OOP10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },

  // ==================== FRIDAY ====================
  {
    id: 'fri-1',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '09:15 - 10:00',
    slotId: 't1',
    span: 1,
    subjectCode: 'WPD-9',
    subjectTitle: 'Web Page Design',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'WPD9-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 36,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'fri-2',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '10:10 - 11:00',
    slotId: 't2',
    span: 1,
    subjectCode: 'FCA-9',
    subjectTitle: 'Fund. Computer App',
    grade: 'Class 9',
    gradeKey: 'class-9',
    teacher: 'FCA9-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 36,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'fri-3',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '11:00 - 11:45',
    slotId: 't3',
    span: 1,
    subjectCode: 'CN-12',
    subjectTitle: 'Computer Networks',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'CN12-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  // Friday Period 4 (12:30-1:15) - Parallel Session 1: PHY-11 (Physics Lab)
  {
    id: 'fri-4a',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'PHY-11',
    subjectTitle: 'Physics Lab',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'PHY11-Teacher',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 42,
    category: 'Physics',
    dotColor: 'bg-cyan-500',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/60',
    accentColor: 'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-zinc-950 dark:text-white border-cyan-200 dark:border-cyan-500/30',
  },
  // Friday Period 4 (12:30-1:15) - Parallel Session 2: CT-12 (Computer Lab)
  {
    id: 'fri-4b',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '12:30 - 01:15',
    slotId: 't5',
    span: 1,
    subjectCode: 'CT-12',
    subjectTitle: 'Comp Technology',
    grade: 'Class 12',
    gradeKey: 'class-12',
    teacher: 'CT12-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 38,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
  {
    id: 'fri-5',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '01:15 - 01:45',
    slotId: 't6',
    span: 1,
    subjectCode: 'PHY-11',
    subjectTitle: 'Physics Lab',
    grade: 'Class 11',
    gradeKey: 'class-11',
    teacher: 'PHY11-Teacher',
    lab: 'Physics Lab',
    labKey: 'phys',
    defaultStudents: 42,
    category: 'Physics',
    dotColor: 'bg-cyan-500',
    badgeColor: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/60',
    accentColor: 'border-l-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-zinc-950 dark:text-white border-cyan-200 dark:border-cyan-500/30',
  },
  {
    id: 'fri-6',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '03:15 - 04:05',
    slotId: 't9',
    span: 1,
    subjectCode: 'CRM-10',
    subjectTitle: 'Computer Repair',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'CRM10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Electronics',
    dotColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700/60',
    accentColor: 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-zinc-950 dark:text-white border-amber-200 dark:border-amber-500/30',
  },
  {
    id: 'fri-7',
    day: 'Friday',
    dayKey: 'fri',
    timeSlot: '04:05 - 04:50',
    slotId: 't10',
    span: 1,
    subjectCode: 'OOP-10',
    subjectTitle: 'OOP (C++)',
    grade: 'Class 10',
    gradeKey: 'class-10',
    teacher: 'OOP10-Teacher',
    lab: 'Computer Lab',
    labKey: 'comp',
    defaultStudents: 35,
    category: 'Computer',
    dotColor: 'bg-indigo-500',
    badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/60',
    accentColor: 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
  },
]
