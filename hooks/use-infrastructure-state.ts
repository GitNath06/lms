'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { broadcastSync, subscribeToSync } from '@/lib/sync-bus'
import {
  DEFAULT_HOLIDAYS,
  CANONICAL_PERIOD_SLOTS,
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
  getPeriodSlotsAction,
  updatePeriodSlotsAction,
} from '@/app/actions/settings'
import { sortPeriodSlots } from '@/lib/utils'
import {
  getLabFacilitiesAction,
  updateLabFacility,
  createLabFacility,
  deleteLabFacility,
} from '@/app/actions/labs'
import { getClassesAction } from '@/app/actions/classes'
import { getSubjectsAction, getClassSubjectsAction } from '@/app/actions/subjects'
import { getTeachers } from '@/app/actions/logs'
import { getLabSyncBootstrapData } from '@/app/actions/bootstrap'
import { getCachedQuery, setCachedQuery, setCachedData } from '@/lib/cache/client-query-cache'

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
  is_active?: boolean
}

export interface ClassEnrollmentItem {
  id: string
  name: string
  section: string
  capacity: number
  stream: string
  is_active?: boolean
}

export interface FacultyMemberItem {
  id: string
  name: string
  dept: string
  role: string
  email: string
  photo_url?: string | null
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
  classId?: string
  classSubjectId?: string
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

// Deprecated prototype mock array - All incident categories are canonically managed in public.issue_categories
export const DEFAULT_INCIDENT_CATEGORIES: IncidentCategoryItem[] = []

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



// Module-level deduplication cache
let cachedLabsPromise: Promise<LabFacilityItem[] | null> | null = null
let cachedFacultyPromise: Promise<FacultyMemberItem[] | null> | null = null
let cachedHolidaysPromise: Promise<HolidayItem[] | null> | null = null
let cachedPeriodsPromise: Promise<PeriodSlotItem[] | null> | null = null
let cachedClassesPromise: Promise<ClassEnrollmentItem[] | null> | null = null
let cachedSubjectsPromise: Promise<SubjectCurriculumItem[] | null> | null = null
let cachedIncidentCategoriesPromise: Promise<IncidentCategoryItem[] | null> | null = null
let cachedIncidentSettingsPromise: Promise<IncidentGovernanceSettings | null> | null = null
let cachedBootstrapPromise: Promise<any> | null = null
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
  const [periods, setPeriods] = useState<PeriodSlotItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    return (Array.isArray(cached?.period_settings) ? cached.period_settings : null) || CANONICAL_PERIOD_SLOTS
  })
  const [labs, setLabs] = useState<LabFacilityItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    if (Array.isArray(cached?.labs)) {
      return cached.labs.map((l: any) => ({
        id: l.id,
        name: l.name,
        code: l.code || l.id.toUpperCase(),
        capacity: l.capacity || 40,
        type: l.type || 'computer_lab',
        status: l.status || 'Operational',
        is_active: l.is_active,
      }))
    }
    return []
  })
  const [classes, setClasses] = useState<ClassEnrollmentItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    if (Array.isArray(cached?.classes)) {
      return cached.classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        section: c.section || 'A',
        capacity: c.capacity || 40,
        stream: c.stream_id || 'General',
        is_active: c.is_active,
      }))
    }
    return []
  })
  const [faculty, setFaculty] = useState<FacultyMemberItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    if (Array.isArray(cached?.teachers)) {
      return cached.teachers.map((p: any) => ({
        id: p.id,
        name: p.full_name || p.name || 'Faculty Member',
        dept: p.department || 'Computer Science',
        role: p.role,
        email: p.email || '',
        photo_url: p.photo_url || null,
      }))
    }
    return []
  })
  const [subjects, setSubjects] = useState<SubjectCurriculumItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    if (Array.isArray(cached?.subjects)) {
      return cached.subjects.map((s: any) => ({
        code: s.code || s.id,
        title: s.name,
        creditHours: s.credit_hours || 4,
        is_active: s.is_active,
      }))
    }
    return []
  })
  const [holidays, setHolidays] = useState<HolidayItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    return (Array.isArray(cached?.academic_holidays) ? cached.academic_holidays : null) || DEFAULT_HOLIDAYS
  })
  const [incidentCategories, setIncidentCategories] = useState<IncidentCategoryItem[]>(() => {
    const cached = getCachedQuery<any>('bootstrap_data')
    return (Array.isArray(cached?.issue_categories) ? cached.issue_categories : null) || DEFAULT_INCIDENT_CATEGORIES
  })
  const [incidentSettings, setIncidentSettings] = useState<IncidentGovernanceSettings>(DEFAULT_INCIDENT_SETTINGS)

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !getCachedQuery<any>('bootstrap_data')
  })
  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(() => {
    return Boolean(getCachedQuery<any>('bootstrap_data'))
  })

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

    // Master Bootstrap RPC: Consolidates 9 individual queries into 1 pooled query
    if (isCacheStale || !cachedBootstrapPromise) {
      lastInfraFetchTime = now
      cachedBootstrapPromise = getLabSyncBootstrapData()
        .then((res) => {
          if (res.success && res.data) {
            setCachedQuery('bootstrap_data', res.data)
            if (res.data.user_profile) {
              setCachedData('auth:current-user-profile', res.data.user_profile)
              setCachedQuery('auth:current-user-profile', res.data.user_profile)
              if (res.data.user_profile.id && typeof window !== 'undefined') {
                try {
                  localStorage.setItem('labsync_active_uid', res.data.user_profile.id)
                } catch {}
              }
            }
            if (res.data.user_scope) {
              setCachedData('auth:user-scope', res.data.user_scope)
              setCachedQuery('auth:user-scope', res.data.user_scope)
            }
            return res.data
          }
          return null
        })
        .catch((err) => {
          console.warn('Bootstrap fetch warning, falling back:', err)
          return null
        })
    }

    cachedBootstrapPromise?.then((bData) => {
      if (!isMounted) return

      if (bData) {
        // 1. Labs
        if (Array.isArray(bData.labs)) {
          const mappedLabs: LabFacilityItem[] = bData.labs.map((l: any) => ({
            id: l.id,
            name: l.name,
            code: l.code || l.id.toUpperCase(),
            capacity: l.capacity || 40,
            type: l.type || 'computer_lab',
            status: l.status || 'Operational',
            is_active: l.is_active,
          }))
          setLabs(mappedLabs)
          try {
            localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(mappedLabs))
          } catch (e) {}
        }

        // 2. Faculty / Teachers
        if (Array.isArray(bData.teachers)) {
          const mappedFaculty: FacultyMemberItem[] = bData.teachers.map((p: any) => ({
            id: p.id,
            name: p.full_name || 'Faculty Member',
            dept: p.department || 'Academic Department',
            role:
              p.role === 'admin' || p.role === 'lab_incharge'
                ? 'Lab In-Charge'
                : 'Senior Faculty',
            email: p.email || '',
            photo_url: p.photo_url || null,
            assignedSubjectCodes: [],
          }))
          setFaculty(mappedFaculty)
          try {
            localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(mappedFaculty))
          } catch (e) {}
        }

        // 3. Holidays
        if (Array.isArray(bData.academic_holidays)) {
          const mappedHolidays: HolidayItem[] =
            bData.academic_holidays.length > 0
              ? bData.academic_holidays.map((h: any) => ({
                  id: h.id,
                  title: h.name,
                  dateStart: h.date_start,
                  dateEnd: h.date_end || h.date_start,
                  type: h.type || 'national',
                }))
              : DEFAULT_HOLIDAYS
          setHolidays(mappedHolidays)
          try {
            localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(mappedHolidays))
          } catch (e) {}
        }

        // 4. Periods
        if (
          bData.period_settings &&
          Array.isArray(bData.period_settings) &&
          bData.period_settings.length > 0
        ) {
          const mappedPeriodSlots: PeriodSlotItem[] = (bData.period_settings as any[]).map(
            (p: any, idx: number) => ({
              id: p.id || `slot-${idx}`,
              name: p.name || p.label || `Period ${idx + 1}`,
              label: p.label || p.timeRange || '',
            })
          )
          const sorted = sortPeriodSlots(mappedPeriodSlots)
          setPeriods(sorted)
          try {
            localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(sorted))
          } catch (e) {}
        }

        // 5. Classes
        if (Array.isArray(bData.classes)) {
          const mappedClasses: ClassEnrollmentItem[] = bData.classes.map((c: any) => ({
            id: c.id,
            name: c.name,
            section: c.section || 'A',
            capacity: c.capacity || 40,
            stream: c.stream_id || (c.grade && c.grade >= 11 ? 'Science' : 'General'),
            is_active: c.is_active,
          }))
          setClasses(mappedClasses)
          try {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(mappedClasses))
          } catch (e) {}
        }

        // 6. Subjects & Class Subjects
        const mappedSubjects: SubjectCurriculumItem[] = []
        const seenCodes = new Set<string>()

        if (Array.isArray(bData.class_subjects)) {
          for (const cs of bData.class_subjects) {
            const code = cs.subject_code || cs.subject_id
            const grade = cs.class_name || cs.class_id
            seenCodes.add(code)
            mappedSubjects.push({
              code,
              title: cs.subject_name || code,
              grade,
              quota: 4,
              lab: cs.lab_name || 'Computer Lab',
              labId: cs.default_lab_id || 'comp',
              teacherId: cs.teacher_id || '',
              teacherName: cs.teacher_name || undefined,
              classId: cs.class_id,
              classSubjectId: cs.id,
            })
          }
        }

        if (Array.isArray(bData.subjects)) {
          for (const s of bData.subjects) {
            if (!seenCodes.has(s.code)) {
              let labName = 'Computer Lab'
              if (s.default_lab_id === 'phys') labName = 'Physics Lab'
              else if (s.default_lab_id === 'chem') labName = 'Chemistry Lab'
              else if (s.default_lab_id === 'bio') labName = 'Biology Lab'
              else if (s.default_lab_id === 'elec') labName = 'Electronics Lab'

              mappedSubjects.push({
                code: s.code,
                title: s.name,
                grade: 'All Classes',
                quota: s.credit_hours || 4,
                lab: labName,
                labId: s.default_lab_id || 'comp',
                teacherId: '',
              })
            }
          }
        }

        if (mappedSubjects.length > 0) {
          setSubjects(mappedSubjects)
          try {
            localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(mappedSubjects))
          } catch (e) {}
        }

        // 7. Incident Categories
        if (Array.isArray(bData.issue_categories)) {
          const mappedCats: IncidentCategoryItem[] = bData.issue_categories.map((c: any) => ({
            id: c.id,
            code: c.name.toLowerCase().replace(/\s+/g, '_'),
            name: c.name,
            description: c.type || '',
            severity: c.default_severity || 'minor',
            is_active: c.is_active !== false,
          }))
          setIncidentCategories(mappedCats)
          try {
            localStorage.setItem(
              STORAGE_KEYS.INCIDENT_CATEGORIES,
              JSON.stringify(mappedCats)
            )
          } catch (e) {}
        }

        setIsLoading(false)
        setHasFetchedOnce(true)
      } else {
        setIsLoading(false)
        setHasFetchedOnce(true)
      }
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
          cachedBootstrapPromise = null
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
                  is_active: l.is_active !== undefined ? l.is_active : l.status === 'Operational',
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => {
          cachedClassesPromise = null
          getClassesAction({ activeOnly: true }).then((res) => {
            if (res.success && res.data) {
              const mapped: ClassEnrollmentItem[] = res.data.map((c) => ({
                id: c.id,
                name: c.name,
                section: c.section || 'A',
                capacity: c.capacity || 40,
                stream: c.stream_id || (c.grade && c.grade >= 11 ? 'Science' : 'General'),
                is_active: c.is_active,
              }))
              try {
                localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(mapped))
              } catch (e) {}
              infraSubscribers.forEach((sub) => sub.setClasses(mapped))
            }
          })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'class_subjects' }, () => {
          cachedSubjectsPromise = null
          Promise.all([getClassSubjectsAction(), getSubjectsAction({ activeOnly: true })]).then(([csRes, sRes]) => {
            const mapped: SubjectCurriculumItem[] = []
            const seenCodes = new Set<string>()
            if (csRes.success && Array.isArray(csRes.data)) {
              for (const cs of csRes.data) {
                const code = cs.subject_code || cs.subject_id
                seenCodes.add(code)
                mapped.push({
                  code,
                  title: cs.subject_name || code,
                  grade: cs.class_name || cs.class_id,
                  quota: 4,
                  lab: cs.lab_name || 'Computer Lab',
                  labId: cs.default_lab_id || 'comp',
                  teacherId: cs.teacher_id || '',
                  teacherName: cs.teacher_name || undefined,
                  classId: cs.class_id,
                  classSubjectId: cs.id,
                })
              }
            }
            if (sRes.success && Array.isArray(sRes.data)) {
              for (const s of sRes.data) {
                if (!seenCodes.has(s.code)) {
                  mapped.push({
                    code: s.code,
                    title: s.name,
                    grade: 'All Classes',
                    quota: s.credit_hours || 4,
                    lab: 'Computer Lab',
                    labId: s.default_lab_id || 'comp',
                    teacherId: '',
                  })
                }
              }
            }
            try {
              localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(mapped))
            } catch (e) {}
            infraSubscribers.forEach((sub) => sub.setSubjects(mapped))
          })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, () => {
          cachedSubjectsPromise = null
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
      const updated = sortPeriodSlots([...prev, period])
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, updated)
        updatePeriodSlotsAction(updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const updatePeriod = useCallback((id: string, updates: Partial<PeriodSlotItem>) => {
    setPeriods((prev) => {
      const updated = sortPeriodSlots(prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, updated)
        updatePeriodSlotsAction(updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const deletePeriod = useCallback((id: string) => {
    setPeriods((prev) => {
      const updated = prev.filter((p) => p.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, updated)
        updatePeriodSlotsAction(updated).catch(() => {})
      })
      return updated
    })
  }, [])

  const resetPeriods = useCallback(async () => {
    try {
      const res = await getPeriodSlotsAction()
      const slots = res.success ? res.data : []
      const sorted = sortPeriodSlots(slots)
      setPeriods(sorted)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.PERIODS, sorted)
        updatePeriodSlotsAction(sorted).catch(() => {})
      })
    } catch (e) {
      console.warn('Failed to reset periods:', e)
    }
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
      })
      return updated
    })
  }, [])

  const updateClass = useCallback((id: string, updates: Partial<ClassEnrollmentItem>) => {
    setClasses((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.CLASSES, updated)
      })
      return updated
    })
  }, [])

  const deleteClass = useCallback((id: string) => {
    setClasses((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.CLASSES, updated)
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
        // Canonical subjects persisted in public.class_subjects
      })
      return updated
    })
  }, [])

  const updateSubject = useCallback((code: string, updates: Partial<SubjectCurriculumItem>) => {
    setSubjects((prev) => {
      const updated = prev.map((s) => (s.code === code ? { ...s, ...updates } : s))
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
        // Canonical subjects persisted in public.class_subjects
      })
      return updated
    })
  }, [])

  const deleteSubject = useCallback((code: string) => {
    setSubjects((prev) => {
      const updated = prev.filter((s) => s.code !== code)
      queueMicrotask(() => {
        saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
        // Canonical subjects persisted in public.class_subjects
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
    isLoading,
    hasFetchedOnce,
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
