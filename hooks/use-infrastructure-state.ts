'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { broadcastSync, subscribeToSync } from '@/lib/sync-bus'
import {
  MASTER_TIME_SLOTS,
  LAB_ROOMS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  DEFAULT_HOLIDAYS,
  HolidayItem,
  isDateWithinHoliday
} from '@/lib/master-data'
import {
  getAcademicHolidays,
  addAcademicHoliday,
  updateAcademicHoliday,
  deleteAcademicHoliday,
} from '@/app/actions/holidays'
import {
  getInstitutionSetting,
  updateInstitutionSetting,
} from '@/app/actions/settings'
import {
  updateLabFacility,
  createLabFacility,
  deleteLabFacility,
} from '@/app/actions/labs'

export interface PeriodSlotItem {
  id: string
  name: string
  label: string
}

export interface LabFacilityItem {
  id: string
  name: string
  code: string
  capacity: number
  type: string
  status: string
}

export interface ClassEnrollmentItem {
  id: string
  name: string
  section: string
  capacity: number
  stream: string
}

export interface FacultyMemberItem {
  id: string
  name: string
  dept: string
  role: string
  email: string
  assignedSubjectCodes?: string[]
}

export interface SubjectCurriculumItem {
  code: string
  title: string
  grade: string
  quota: number
  lab: string
  labId: string
  teacherId: string
  teacherName?: string
}

export interface IncidentCategoryItem {
  id: string
  code: string
  name: string
  description: string
  severity: 'minor' | 'moderate' | 'major_critical'
  targetLab?: 'all' | 'phys' | 'chem' | 'comp'
  is_active?: boolean
}

export interface IncidentGovernanceSettings {
  autoEscalateMajorToHOD: boolean
  notifyLabInCharge: boolean
  emergencyContacts: {
    physEmail: string
    chemEmail: string
    compEmail: string
    hodEmail: string
  }
}

export const DEFAULT_INCIDENT_CATEGORIES: IncidentCategoryItem[] = [
  {
    id: 'cat-1',
    code: 'breakage',
    name: 'Equipment / Glassware Breakage',
    description: 'Hardware damage, glassware fracture, tool breakage, or peripheral collapse',
    severity: 'moderate',
    targetLab: 'all',
    is_active: true,
  },
  {
    id: 'cat-2',
    code: 'malfunction',
    name: 'Equipment Fault / System Crash',
    description: 'PC system fault, monitor blackout, multimeter no-response, power pack fuse issue',
    severity: 'minor',
    targetLab: 'all',
    is_active: true,
  },
  {
    id: 'cat-3',
    code: 'burnt_apparatus',
    name: 'Burnt Component / Circuit Short',
    description: 'Resistor overheat, capacitor burst, IC circuit short, burning odor from PSU',
    severity: 'moderate',
    targetLab: 'all',
    is_active: true,
  },
  {
    id: 'cat-4',
    code: 'chemical_hazard',
    name: 'Chemical Spill / Acid Hazard',
    description: 'Corrosive reagent spillage, hazardous acid leak, fume hood failure, mercury vapor leak',
    severity: 'major_critical',
    targetLab: 'chem',
    is_active: true,
  },
  {
    id: 'cat-5',
    code: 'missing',
    name: 'Missing / Unreturned Equipment',
    description: 'Unaccounted station tool, missing patch cord, missing micro-pipette, unreturned specimen slide',
    severity: 'minor',
    targetLab: 'all',
    is_active: true,
  },
  {
    id: 'cat-6',
    code: 'other',
    name: 'Other Practical Incident',
    description: 'Any miscellaneous station damage or safety hazard during scheduled practical session',
    severity: 'minor',
    targetLab: 'all',
    is_active: true,
  },
]

export const DEFAULT_INCIDENT_SETTINGS: IncidentGovernanceSettings = {
  autoEscalateMajorToHOD: true,
  notifyLabInCharge: true,
  emergencyContacts: {
    physEmail: 'physics.incharge@rrl.edu.np',
    chemEmail: 'chemistry.incharge@rrl.edu.np',
    compEmail: 'computer.incharge@rrl.edu.np',
    hodEmail: 'hod.science@rrl.edu.np',
  },
}

const STORAGE_KEYS = {
  PERIODS: 'lmr_admin_periods_v2',
  LABS: 'lmr_admin_labs_v2',
  CLASSES: 'lmr_admin_classes_v2',
  FACULTY: 'lmr_admin_faculty_v2',
  SUBJECTS: 'lmr_admin_subjects_v2',
  HOLIDAYS: 'lmr_admin_holidays_v2',
  INCIDENT_CATEGORIES: 'lmr_admin_incident_categories_v2',
  INCIDENT_SETTINGS: 'lmr_admin_incident_settings_v2',
}

const INITIAL_FACULTY: FacultyMemberItem[] = [
  { id: 't1', name: 'Dr. Rajesh Sharma', dept: 'Computer Science & Engineering', role: 'Lab In-Charge', email: 'r.sharma@rrl.edu.np', assignedSubjectCodes: ['COMP-12C', 'DBMS-10A', 'WPD-9B'] },
  { id: 't2', name: 'Dr. Prakash Adhikari', dept: 'Physics Department', role: 'Senior Faculty', email: 'p.adhikari@rrl.edu.np', assignedSubjectCodes: ['PHY-11SC', 'PHY-12SC'] },
  { id: 't3', name: 'Ms. Sunita Thapa', dept: 'Chemistry Department', role: 'Lab In-Charge', email: 's.thapa@rrl.edu.np', assignedSubjectCodes: ['CHEM-12SC'] },
  { id: 't4', name: 'Er. Anish Karki', dept: 'Electronics & Hardware', role: 'Faculty Member', email: 'a.karki@rrl.edu.np', assignedSubjectCodes: ['ELEC-12C'] },
  { id: 't5', name: 'Dr. Nirmala Poudel', dept: 'Biology & Life Sciences', role: 'Senior Faculty', email: 'n.poudel@rrl.edu.np', assignedSubjectCodes: ['BIO-11SC'] },
]

const INITIAL_LABS: LabFacilityItem[] = LAB_ROOMS.map((l) => ({
  id: l.id,
  name: l.name,
  code: l.code,
  capacity: l.capacity,
  type: l.id === 'comp' ? 'computer_lab' : l.id === 'phys' ? 'physics_lab' : l.id === 'chem' ? 'chemistry_lab' : l.id === 'bio' ? 'biology_lab' : 'electronics_lab',
  status: 'Operational',
}))

const INITIAL_CLASSES: ClassEnrollmentItem[] = DEFAULT_CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  section: c.fullName.split(' - ')[1] || c.name,
  capacity: c.strength,
  stream: c.stream,
}))

const INITIAL_SUBJECTS: SubjectCurriculumItem[] = DEFAULT_SUBJECTS.map((s) => {
  const teacher = INITIAL_FACULTY.find((f) => f.id === s.teacherId)
  return {
    code: s.code,
    title: s.title,
    grade: s.grade,
    quota: s.quota,
    lab: s.lab,
    labId: s.labId,
    teacherId: s.teacherId,
    teacherName: teacher ? teacher.name : 'Assigned Faculty',
  }
})

// Module-level deduplication cache
let cachedLabsPromise: Promise<LabFacilityItem[] | null> | null = null
let cachedFacultyPromise: Promise<FacultyMemberItem[] | null> | null = null
let cachedHolidaysPromise: Promise<HolidayItem[] | null> | null = null
let cachedPeriodsPromise: Promise<PeriodSlotItem[] | null> | null = null
let cachedClassesPromise: Promise<ClassEnrollmentItem[] | null> | null = null
let cachedSubjectsPromise: Promise<SubjectCurriculumItem[] | null> | null = null
let cachedIncidentCategoriesPromise: Promise<IncidentCategoryItem[] | null> | null = null
let cachedIncidentSettingsPromise: Promise<IncidentGovernanceSettings | null> | null = null
let lastInfraFetchTime = 0
const INFRA_CACHE_TTL = 30000 // 30 seconds

// Singleton realtime subscription & subscriber registry
let sharedInfraChannel: any = null
let infraRefCount = 0
const infraSubscribers = new Set<{
  setLabs: React.Dispatch<React.SetStateAction<LabFacilityItem[]>>
  setHolidays: React.Dispatch<React.SetStateAction<HolidayItem[]>>
  setPeriods: React.Dispatch<React.SetStateAction<PeriodSlotItem[]>>
  setClasses: React.Dispatch<React.SetStateAction<ClassEnrollmentItem[]>>
  setSubjects: React.Dispatch<React.SetStateAction<SubjectCurriculumItem[]>>
  setIncidentCategories: React.Dispatch<React.SetStateAction<IncidentCategoryItem[]>>
  setIncidentSettings: React.Dispatch<React.SetStateAction<IncidentGovernanceSettings>>
}>()

export function useInfrastructureState() {
  const [periods, setPeriods] = useState<PeriodSlotItem[]>([...MASTER_TIME_SLOTS])
  const [labs, setLabs] = useState<LabFacilityItem[]>(INITIAL_LABS)
  const [classes, setClasses] = useState<ClassEnrollmentItem[]>(INITIAL_CLASSES)
  const [faculty, setFaculty] = useState<FacultyMemberItem[]>(INITIAL_FACULTY)
  const [subjects, setSubjects] = useState<SubjectCurriculumItem[]>(INITIAL_SUBJECTS)
  const [holidays, setHolidays] = useState<HolidayItem[]>(DEFAULT_HOLIDAYS)
  const [incidentCategories, setIncidentCategories] = useState<IncidentCategoryItem[]>(DEFAULT_INCIDENT_CATEGORIES)
  const [incidentSettings, setIncidentSettings] = useState<IncidentGovernanceSettings>(DEFAULT_INCIDENT_SETTINGS)

  // Load from localStorage on mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.PERIODS)
      if (p) setPeriods(JSON.parse(p))
      const l = localStorage.getItem(STORAGE_KEYS.LABS)
      if (l) setLabs(JSON.parse(l))
      const c = localStorage.getItem(STORAGE_KEYS.CLASSES)
      if (c) setClasses(JSON.parse(c))
      const f = localStorage.getItem(STORAGE_KEYS.FACULTY)
      if (f) setFaculty(JSON.parse(f))
      const s = localStorage.getItem(STORAGE_KEYS.SUBJECTS)
      if (s) setSubjects(JSON.parse(s))
      const h = localStorage.getItem(STORAGE_KEYS.HOLIDAYS)
      if (h) {
        try {
          const parsed = JSON.parse(h)
          if (Array.isArray(parsed)) {
            const uniqueHolidaysMap = new Map<string, HolidayItem>()
            parsed.forEach((item: any) => {
              if (item && item.id) uniqueHolidaysMap.set(item.id, item)
            })
            DEFAULT_HOLIDAYS.forEach((dh) => {
              if (!uniqueHolidaysMap.has(dh.id)) {
                uniqueHolidaysMap.set(dh.id, dh)
              }
            })
            const merged = Array.from(uniqueHolidaysMap.values())
            setHolidays(merged)
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(merged))
          }
        } catch (e) {}
      }
      const ic = localStorage.getItem(STORAGE_KEYS.INCIDENT_CATEGORIES)
      if (ic) setIncidentCategories(JSON.parse(ic))
      const is = localStorage.getItem(STORAGE_KEYS.INCIDENT_SETTINGS)
      if (is) setIncidentSettings(JSON.parse(is))
    } catch (e) {}
  }, [])

  // Broadcast helper (asynchronous to prevent React setState-in-render collisions)
  const notifyUpdated = () => {
    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        window.dispatchEvent(new Event('infrastructure-updated'))
      })
    }
  }

  // Persist helper
  const saveToStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(data))
        notifyUpdated()
        queueMicrotask(() => {
          if (key === STORAGE_KEYS.HOLIDAYS) {
            cachedHolidaysPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setHolidays(data))
            broadcastSync('holidays', data)
          } else if (key === STORAGE_KEYS.LABS) {
            cachedLabsPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setLabs(data))
            broadcastSync('infrastructure', { key, data })
          } else if (key === STORAGE_KEYS.PERIODS) {
            cachedPeriodsPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setPeriods(data))
            broadcastSync('infrastructure', { key, data })
          } else if (key === STORAGE_KEYS.CLASSES) {
            cachedClassesPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setClasses(data))
            broadcastSync('infrastructure', { key, data })
          } else if (key === STORAGE_KEYS.SUBJECTS) {
            cachedSubjectsPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setSubjects(data))
            broadcastSync('infrastructure', { key, data })
          } else if (key === STORAGE_KEYS.INCIDENT_CATEGORIES) {
            cachedIncidentCategoriesPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setIncidentCategories(data))
            broadcastSync('infrastructure', { key, data })
          } else if (key === STORAGE_KEYS.INCIDENT_SETTINGS) {
            cachedIncidentSettingsPromise = Promise.resolve(data)
            infraSubscribers.forEach((sub) => sub.setIncidentSettings(data))
            broadcastSync('infrastructure', { key, data })
          } else {
            broadcastSync('infrastructure', { key, data })
          }
        })
      } catch (e) {
        console.error('Failed to persist infrastructure state', e)
      }
    }
  }

  // Two-way remote synchronization with Supabase (deduplicated across instances)
  useEffect(() => {
    let isMounted = true
    if (!isSupabaseConfigured()) return

    const subscriber = {
      setLabs,
      setHolidays,
      setPeriods,
      setClasses,
      setSubjects,
      setIncidentCategories,
      setIncidentSettings,
    }
    infraSubscribers.add(subscriber)
    infraRefCount++

    const supabase = createClient()
    const now = Date.now()
    const isCacheStale = now - lastInfraFetchTime > INFRA_CACHE_TTL

    // 1. Fetch remote labs (deduplicated)
    if (isCacheStale || !cachedLabsPromise) {
      lastInfraFetchTime = now
      cachedLabsPromise = Promise.resolve(
        supabase
          .from('labs')
          .select('*')
          .order('name')
          .then(({ data: dbLabs, error }) => {
            if (!error && dbLabs && dbLabs.length > 0) {
              const mappedLabs: LabFacilityItem[] = dbLabs.map((l: any) => ({
                id: l.id,
                name: l.name,
                code: l.code || l.id.toUpperCase(),
                capacity: l.capacity || 40,
                type: l.type || 'computer_lab',
                status: l.status || (l.is_active ? 'Operational' : 'Inactive'),
              }))
              try {
                localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(mappedLabs))
              } catch (e) {}
              return mappedLabs
            }
            return null
          })
      )
    }

    cachedLabsPromise?.then((labsData) => {
      if (labsData && isMounted) setLabs(labsData)
    })

    // 2. Fetch remote faculty/profiles (deduplicated)
    if (isCacheStale || !cachedFacultyPromise) {
      cachedFacultyPromise = Promise.resolve(
        supabase
          .from('profiles')
          .select('*')
          .order('full_name')
          .then(({ data: dbProfiles, error }) => {
            if (!error && dbProfiles && dbProfiles.length > 0) {
              const mappedFaculty: FacultyMemberItem[] = dbProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || 'Faculty Member',
                dept: p.department || 'Academic Department',
                role: p.role === 'admin' ? 'Lab In-Charge' : 'Senior Faculty',
                email: p.email || '',
                assignedSubjectCodes: [],
              }))
              try {
                localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(mappedFaculty))
              } catch (e) {}
              return mappedFaculty
            }
            return null
          })
      )
    }

    cachedFacultyPromise?.then((facultyData) => {
      if (facultyData && isMounted) setFaculty(facultyData)
    })

    // 3. Fetch remote academic holidays (deduplicated)
    if (isCacheStale || !cachedHolidaysPromise) {
      cachedHolidaysPromise = getAcademicHolidays().then((dbHolidays) => {
        if (dbHolidays && dbHolidays.length > 0) {
          const uniqueHolsMap = new Map<string, HolidayItem>()
          dbHolidays.forEach((item) => {
            if (item && item.id) uniqueHolsMap.set(item.id, item)
          })
          const dedupedHolidays = Array.from(uniqueHolsMap.values())
          try {
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(dedupedHolidays))
          } catch (e) {}
          return dedupedHolidays
        }
        return null
      })
    }

    cachedHolidaysPromise?.then((holsData) => {
      if (holsData && isMounted) setHolidays(holsData)
    })

    // 4. Fetch remote periods (deduplicated)
    if (isCacheStale || !cachedPeriodsPromise) {
      cachedPeriodsPromise = getInstitutionSetting<PeriodSlotItem[]>(
        'infrastructure_periods',
        MASTER_TIME_SLOTS
      ).then((res) => {
        if (res && res.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(res))
          } catch (e) {}
          return res
        }
        return null
      })
    }

    cachedPeriodsPromise?.then((periodsData) => {
      if (periodsData && isMounted) setPeriods(periodsData)
    })

    // 5. Fetch remote classes (deduplicated)
    if (isCacheStale || !cachedClassesPromise) {
      cachedClassesPromise = getInstitutionSetting<ClassEnrollmentItem[]>(
        'infrastructure_classes',
        INITIAL_CLASSES
      ).then((res) => {
        if (res && res.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(res))
          } catch (e) {}
          return res
        }
        return null
      })
    }

    cachedClassesPromise?.then((classesData) => {
      if (classesData && isMounted) setClasses(classesData)
    })

    // 6. Fetch remote subjects (deduplicated)
    if (isCacheStale || !cachedSubjectsPromise) {
      cachedSubjectsPromise = getInstitutionSetting<SubjectCurriculumItem[]>(
        'infrastructure_subjects',
        INITIAL_SUBJECTS
      ).then((res) => {
        if (res && res.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(res))
          } catch (e) {}
          return res
        }
        return null
      })
    }

    cachedSubjectsPromise?.then((subjectsData) => {
      if (subjectsData && isMounted) setSubjects(subjectsData)
    })

    // 7. Fetch remote incident categories (deduplicated)
    if (isCacheStale || !cachedIncidentCategoriesPromise) {
      cachedIncidentCategoriesPromise = getInstitutionSetting<IncidentCategoryItem[]>(
        'infrastructure_incident_categories',
        DEFAULT_INCIDENT_CATEGORIES
      ).then((res) => {
        if (res && res.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEYS.INCIDENT_CATEGORIES, JSON.stringify(res))
          } catch (e) {}
          return res
        }
        return null
      })
    }

    cachedIncidentCategoriesPromise?.then((catsData) => {
      if (catsData && isMounted) setIncidentCategories(catsData)
    })

    // 8. Fetch remote incident settings (deduplicated)
    if (isCacheStale || !cachedIncidentSettingsPromise) {
      cachedIncidentSettingsPromise = getInstitutionSetting<IncidentGovernanceSettings>(
        'infrastructure_incident_settings',
        DEFAULT_INCIDENT_SETTINGS
      ).then((res) => {
        if (res) {
          try {
            localStorage.setItem(STORAGE_KEYS.INCIDENT_SETTINGS, JSON.stringify(res))
          } catch (e) {}
          return res
        }
        return null
      })
    }

    cachedIncidentSettingsPromise?.then((settingsData) => {
      if (settingsData && isMounted) setIncidentSettings(settingsData)
    })

    // 9. Shared Singleton Realtime subscription
    if (!sharedInfraChannel) {
      try {
        const existing = supabase.getChannels().find((c: any) => c.topic === 'realtime:shared-infra-changes')
        if (existing) {
          supabase.removeChannel(existing)
        }
      } catch (e) {}

      sharedInfraChannel = supabase
        .channel('shared-infra-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'labs' }, () => {
          cachedLabsPromise = null
          supabase
            .from('labs')
            .select('*')
            .order('name')
            .then(({ data: updatedLabs }) => {
              if (updatedLabs) {
                const mapped: LabFacilityItem[] = updatedLabs.map((l: any) => ({
                  id: l.id,
                  name: l.name,
                  code: l.code || l.id.toUpperCase(),
                  capacity: l.capacity || 40,
                  type: l.type || 'computer_lab',
                  status: l.status || (l.is_active ? 'Operational' : 'Inactive'),
                }))
                try {
                  localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(mapped))
                } catch (e) {}
                infraSubscribers.forEach((sub) => sub.setLabs(mapped))
              }
            })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_holidays' }, () => {
          cachedHolidaysPromise = null
          getAcademicHolidays().then((updatedHolidays) => {
            if (updatedHolidays) {
              try {
                localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(updatedHolidays))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setHolidays(updatedHolidays))
            }
          })
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'institution_settings' },
          (payload: any) => {
            const row = payload.new
            if (!row || !row.key || !row.value) return
            if (row.key === 'infrastructure_periods') {
              cachedPeriodsPromise = Promise.resolve(row.value)
              try {
                localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(row.value))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setPeriods(row.value))
            } else if (row.key === 'infrastructure_classes') {
              cachedClassesPromise = Promise.resolve(row.value)
              try {
                localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(row.value))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setClasses(row.value))
            } else if (row.key === 'infrastructure_subjects') {
              cachedSubjectsPromise = Promise.resolve(row.value)
              try {
                localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(row.value))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setSubjects(row.value))
            } else if (row.key === 'infrastructure_incident_categories') {
              cachedIncidentCategoriesPromise = Promise.resolve(row.value)
              try {
                localStorage.setItem(STORAGE_KEYS.INCIDENT_CATEGORIES, JSON.stringify(row.value))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setIncidentCategories(row.value))
            } else if (row.key === 'infrastructure_incident_settings') {
              cachedIncidentSettingsPromise = Promise.resolve(row.value)
              try {
                localStorage.setItem(STORAGE_KEYS.INCIDENT_SETTINGS, JSON.stringify(row.value))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setIncidentSettings(row.value))
            }
          }
        )
        .subscribe()
    }

    return () => {
      isMounted = false
      infraSubscribers.delete(subscriber)
      infraRefCount--
      if (infraRefCount <= 0 && sharedInfraChannel) {
        supabase.removeChannel(sharedInfraChannel)
        sharedInfraChannel = null
        infraRefCount = 0
      }
    }
  }, [])

  // Cross-tab / cross-component sync
  useEffect(() => {
    const handleSync = () => {
      try {
        const p = localStorage.getItem(STORAGE_KEYS.PERIODS)
        if (p) setPeriods((prev) => (JSON.stringify(prev) === p ? prev : JSON.parse(p)))
        const l = localStorage.getItem(STORAGE_KEYS.LABS)
        if (l) setLabs((prev) => (JSON.stringify(prev) === l ? prev : JSON.parse(l)))
        const c = localStorage.getItem(STORAGE_KEYS.CLASSES)
        if (c) setClasses((prev) => (JSON.stringify(prev) === c ? prev : JSON.parse(c)))
        const f = localStorage.getItem(STORAGE_KEYS.FACULTY)
        if (f) setFaculty((prev) => (JSON.stringify(prev) === f ? prev : JSON.parse(f)))
        const s = localStorage.getItem(STORAGE_KEYS.SUBJECTS)
        if (s) setSubjects((prev) => (JSON.stringify(prev) === s ? prev : JSON.parse(s)))
        const h = localStorage.getItem(STORAGE_KEYS.HOLIDAYS)
        if (h) setHolidays((prev) => (JSON.stringify(prev) === h ? prev : JSON.parse(h)))
        const ic = localStorage.getItem(STORAGE_KEYS.INCIDENT_CATEGORIES)
        if (ic) setIncidentCategories((prev) => (JSON.stringify(prev) === ic ? prev : JSON.parse(ic)))
        const is = localStorage.getItem(STORAGE_KEYS.INCIDENT_SETTINGS)
        if (is) setIncidentSettings((prev) => (JSON.stringify(prev) === is ? prev : JSON.parse(is)))
      } catch (e) {}
    }

    window.addEventListener('infrastructure-updated', handleSync)
    window.addEventListener('storage', (e) => {
      if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
        handleSync()
      }
    })
    const unsubInfra = subscribeToSync('infrastructure', () => handleSync())
    const unsubHolidays = subscribeToSync('holidays', () => handleSync())

    return () => {
      window.removeEventListener('infrastructure-updated', handleSync)
      window.removeEventListener('storage', handleSync as any)
      unsubInfra()
      unsubHolidays()
    }
  }, [])

  // 1. Periods Management
  const addPeriod = useCallback((period: PeriodSlotItem) => {
    setPeriods((prev) => {
      const updated = [...prev, period]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, updated)
        updateInstitutionSetting('infrastructure_periods', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const updatePeriod = useCallback((id: string, updates: Partial<PeriodSlotItem>) => {
    setPeriods((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, updated)
        updateInstitutionSetting('infrastructure_periods', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const deletePeriod = useCallback((id: string) => {
    setPeriods((prev) => {
      const updated = prev.filter((p) => p.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, updated)
        updateInstitutionSetting('infrastructure_periods', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const resetPeriods = useCallback(() => {
    setPeriods([...MASTER_TIME_SLOTS])
    queueMicrotask(() => {
      saveToStorage(STORAGE_KEYS.PERIODS, [...MASTER_TIME_SLOTS])
      updateInstitutionSetting('infrastructure_periods', [...MASTER_TIME_SLOTS]).catch(() => {})
    })
  }, [])

  // 2. Labs Management
  const addLab = useCallback((lab: LabFacilityItem) => {
    setLabs((prev) => {
      const updated = [...prev, lab]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.LABS, updated)
        cachedLabsPromise = null
        lastInfraFetchTime = 0
        createLabFacility(lab).catch((err) => {
          console.error('[LMR] Remote createLabFacility failed:', err)
        })
      })
      return updated
    })
  }, [])

  const updateLab = useCallback((id: string, updates: Partial<LabFacilityItem>) => {
    setLabs((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      saveToStorage(STORAGE_KEYS.LABS, updated)
      cachedLabsPromise = null
      lastInfraFetchTime = 0
      return updated
    })
    updateLabFacility(id, updates).catch((err) => {
      console.error('[LMR] Remote updateLabFacility failed:', err)
    })
  }, [])

  const deleteLab = useCallback((id: string) => {
    setLabs((prev) => {
      const updated = prev.filter((l) => l.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.LABS, updated)
        cachedLabsPromise = null
        lastInfraFetchTime = 0
        deleteLabFacility(id).catch((err) => {
          console.error('[LMR] Remote deleteLabFacility failed:', err)
        })
      })
      return updated
    })
  }, [])

  // 3. Classes Management
  const addClass = useCallback((cls: ClassEnrollmentItem) => {
    setClasses((prev) => {
      const updated = [...prev, cls]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.CLASSES, updated)
        updateInstitutionSetting('infrastructure_classes', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const updateClass = useCallback((id: string, updates: Partial<ClassEnrollmentItem>) => {
    setClasses((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.CLASSES, updated)
        updateInstitutionSetting('infrastructure_classes', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const deleteClass = useCallback((id: string) => {
    setClasses((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.CLASSES, updated)
        updateInstitutionSetting('infrastructure_classes', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  // 4. Faculty Management
  const addFaculty = useCallback((fac: FacultyMemberItem) => {
    setFaculty((prev) => {
      const updated = [...prev, fac]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.FACULTY, updated)
      })
      return updated
    })
  }, [])

  const updateFaculty = useCallback((id: string, updates: Partial<FacultyMemberItem>) => {
    setFaculty((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.FACULTY, updated)
      })
      return updated
    })
  }, [])

  const deleteFaculty = useCallback((id: string) => {
    setFaculty((prev) => {
      const updated = prev.filter((f) => f.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.FACULTY, updated)
      })
      return updated
    })
  }, [])

  // 5. Subjects & Teacher Assignment Management
  const addSubject = useCallback((sub: SubjectCurriculumItem) => {
    setSubjects((prev) => {
      const updated = [...prev, sub]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
        updateInstitutionSetting('infrastructure_subjects', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const updateSubject = useCallback((code: string, updates: Partial<SubjectCurriculumItem>) => {
    setSubjects((prev) => {
      const updated = prev.map((s) => (s.code === code ? { ...s, ...updates } : s))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
        updateInstitutionSetting('infrastructure_subjects', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const deleteSubject = useCallback((code: string) => {
    setSubjects((prev) => {
      const updated = prev.filter((s) => s.code !== code)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
        updateInstitutionSetting('infrastructure_subjects', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const assignTeacherToSubject = useCallback((subjectCode: string, teacherId: string) => {
    let teacherName = 'Assigned Faculty'
    setFaculty((prevFaculty) => {
      const targetTeacher = prevFaculty.find((f) => f.id === teacherId)
      if (targetTeacher) {
        teacherName = targetTeacher.name
      }
      const updatedFaculty = prevFaculty.map((f) => {
        const codes = f.assignedSubjectCodes || []
        if (f.id === teacherId) {
          return { ...f, assignedSubjectCodes: Array.from(new Set([...codes, subjectCode])) }
        } else {
          return { ...f, assignedSubjectCodes: codes.filter((c) => c !== subjectCode) }
        }
      })
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.FACULTY, updatedFaculty)
      })
      return updatedFaculty
    })

    setSubjects((prevSubjects) => {
      const updatedSubjects = prevSubjects.map((s) =>
        s.code === subjectCode ? { ...s, teacherId, teacherName } : s
      )
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.SUBJECTS, updatedSubjects)
        updateInstitutionSetting('infrastructure_subjects', updatedSubjects).catch(() => {})
      })
      return updatedSubjects
    })
  }, [])

  // 6. Holidays & Calendar Management
  const addHoliday = useCallback((hol: HolidayItem) => {
    setHolidays((prev) => {
      const filtered = prev.filter((h) => h.id !== hol.id)
      const updated = [hol, ...filtered]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
        addAcademicHoliday(hol).catch((err) => {
          console.error('Failed to save academic holiday remotely:', err)
        })
      })
      return updated
    })
  }, [])

  const updateHoliday = useCallback((id: string, updates: Partial<HolidayItem>) => {
    setHolidays((prev) => {
      const updated = prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
        updateAcademicHoliday(id, updates).catch((err) => {
          console.error('Failed to update academic holiday remotely:', err)
        })
      })
      return updated
    })
  }, [])

  const deleteHoliday = useCallback((id: string) => {
    setHolidays((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
        deleteAcademicHoliday(id).catch((err) => {
          console.error('Failed to delete academic holiday remotely:', err)
        })
      })
      return updated
    })
  }, [])

  const checkIsHoliday = useCallback((dateStr: string) => {
    return holidays.some((h) => isDateWithinHoliday(dateStr, h))
  }, [holidays])

  const getHolidayForDate = useCallback((dateStr: string) => {
    return holidays.find((h) => isDateWithinHoliday(dateStr, h))
  }, [holidays])

  const resetHolidaysToOfficialGazette = useCallback(() => {
    setHolidays(DEFAULT_HOLIDAYS)
    queueMicrotask(() => {
      saveToStorage(STORAGE_KEYS.HOLIDAYS, DEFAULT_HOLIDAYS)
      DEFAULT_HOLIDAYS.forEach((dh) => {
        addAcademicHoliday(dh).catch(() => {})
      })
    })
  }, [])

  // 7. Incident Categories & Governance Settings Management
  const addIncidentCategory = useCallback((cat: IncidentCategoryItem) => {
    setIncidentCategories((prev) => {
      const updated = [...prev, cat]
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
        updateInstitutionSetting('infrastructure_incident_categories', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const updateIncidentCategory = useCallback((id: string, updates: Partial<IncidentCategoryItem>) => {
    setIncidentCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
        updateInstitutionSetting('infrastructure_incident_categories', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const deleteIncidentCategory = useCallback((id: string) => {
    setIncidentCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
        updateInstitutionSetting('infrastructure_incident_categories', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const deactivateIncidentCategory = useCallback((id: string) => {
    setIncidentCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, is_active: false } : c))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
        updateInstitutionSetting('infrastructure_incident_categories', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const resetIncidentCategories = useCallback(() => {
    setIncidentCategories(DEFAULT_INCIDENT_CATEGORIES)
    queueMicrotask(() => {
      saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, DEFAULT_INCIDENT_CATEGORIES)
      updateInstitutionSetting('infrastructure_incident_categories', DEFAULT_INCIDENT_CATEGORIES).catch(() => {})
    })
  }, [])

  const updateIncidentSettings = useCallback((updates: Partial<IncidentGovernanceSettings>) => {
    setIncidentSettings((prev) => {
      const updated = {
        ...prev,
        ...updates,
        emergencyContacts: {
          ...prev.emergencyContacts,
          ...(updates.emergencyContacts || {}),
        },
      }
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.INCIDENT_SETTINGS, updated)
        updateInstitutionSetting('infrastructure_incident_settings', updated).catch(() => {})
      })
      return updated
    })
  }, [])

  return {
    periods,
    labs,
    classes,
    faculty,
    subjects,
    holidays,
    incidentCategories,
    incidentSettings,
    addPeriod,
    updatePeriod,
    deletePeriod,
    resetPeriods,
    addLab,
    updateLab,
    deleteLab,
    addClass,
    updateClass,
    deleteClass,
    addFaculty,
    updateFaculty,
    deleteFaculty,
    addSubject,
    updateSubject,
    deleteSubject,
    assignTeacherToSubject,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    resetHolidaysToOfficialGazette,
    checkIsHoliday,
    getHolidayForDate,
    addIncidentCategory,
    updateIncidentCategory,
    deleteIncidentCategory,
    deactivateIncidentCategory,
    resetIncidentCategories,
    updateIncidentSettings,
  }
}
