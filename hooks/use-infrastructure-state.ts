'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  MASTER_TIME_SLOTS,
  LAB_ROOMS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  DEFAULT_HOLIDAYS,
  HolidayItem,
  isDateWithinHoliday
} from '@/lib/master-data'

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
    name: 'Apparatus Breakage / Glassware',
    description: 'Glassware fracture, burette/pipette crack, beaker collapse, optical lens drop',
    severity: 'moderate',
    targetLab: 'all',
  },
  {
    id: 'cat-2',
    code: 'malfunction',
    name: 'Equipment Fault / System Crash',
    description: 'PC system fault, monitor blackout, multimeter no-response, power pack fuse issue',
    severity: 'minor',
    targetLab: 'all',
  },
  {
    id: 'cat-3',
    code: 'burnt_apparatus',
    name: 'Burnt Component / Circuit Short',
    description: 'Resistor overheat, capacitor burst, IC circuit short, burning odor from PSU',
    severity: 'moderate',
    targetLab: 'all',
  },
  {
    id: 'cat-4',
    code: 'chemical_hazard',
    name: 'Chemical Spill / Acid Hazard',
    description: 'Corrosive reagent spillage, hazardous acid leak, fume hood failure, mercury vapor leak',
    severity: 'major_critical',
    targetLab: 'chem',
  },
  {
    id: 'cat-5',
    code: 'missing',
    name: 'Missing / Unreturned Equipment',
    description: 'Unaccounted station tool, missing patch cord, missing micro-pipette, unreturned specimen slide',
    severity: 'minor',
    targetLab: 'all',
  },
  {
    id: 'cat-6',
    code: 'other',
    name: 'Other Practical Incident',
    description: 'Any miscellaneous station damage or safety hazard during scheduled practical session',
    severity: 'minor',
    targetLab: 'all',
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

export function useInfrastructureState() {
  const [periods, setPeriods] = useState<PeriodSlotItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.PERIODS)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return [...MASTER_TIME_SLOTS]
  })

  const [labs, setLabs] = useState<LabFacilityItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.LABS)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return INITIAL_LABS
  })

  const [classes, setClasses] = useState<ClassEnrollmentItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.CLASSES)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return INITIAL_CLASSES
  })

  const [faculty, setFaculty] = useState<FacultyMemberItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.FACULTY)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return INITIAL_FACULTY
  })

  const [subjects, setSubjects] = useState<SubjectCurriculumItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.SUBJECTS)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return INITIAL_SUBJECTS
  })

  const [holidays, setHolidays] = useState<HolidayItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.HOLIDAYS)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return DEFAULT_HOLIDAYS
  })

  const [incidentCategories, setIncidentCategories] = useState<IncidentCategoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.INCIDENT_CATEGORIES)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return DEFAULT_INCIDENT_CATEGORIES
  })

  const [incidentSettings, setIncidentSettings] = useState<IncidentGovernanceSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.INCIDENT_SETTINGS)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return DEFAULT_INCIDENT_SETTINGS
  })

  // Broadcast helper
  const notifyUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('infrastructure-updated'))
    }
  }

  // Persist helper
  const saveToStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(data))
        notifyUpdated()
      } catch (e) {
        console.error('Failed to persist infrastructure state', e)
      }
    }
  }

  // Two-way remote synchronization with Supabase
  useEffect(() => {
    let isMounted = true
    if (!isSupabaseConfigured()) return

    const supabase = createClient()

    // 1. Fetch remote labs
    supabase
      .from('labs')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data: dbLabs, error }) => {
        if (!error && dbLabs && dbLabs.length > 0 && isMounted) {
          const mappedLabs: LabFacilityItem[] = dbLabs.map((l: any) => ({
            id: l.id,
            name: l.name,
            code: l.code || l.id.toUpperCase(),
            capacity: l.capacity || 40,
            type: l.type || 'computer_lab',
            status: l.is_active ? 'Operational' : 'Maintenance',
          }))
          setLabs(mappedLabs)
          try {
            localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(mappedLabs))
          } catch (e) {}
        }
      })

    // 2. Fetch remote faculty/profiles
    supabase
      .from('profiles')
      .select('*')
      .order('full_name')
      .then(({ data: dbProfiles, error }) => {
        if (!error && dbProfiles && dbProfiles.length > 0 && isMounted) {
          const mappedFaculty: FacultyMemberItem[] = dbProfiles.map((p: any) => ({
            id: p.id,
            name: p.full_name || 'Faculty Member',
            dept: p.department || 'Academic Department',
            role: p.role === 'admin' ? 'Lab In-Charge' : 'Senior Faculty',
            email: p.email || '',
            assignedSubjectCodes: [],
          }))
          setFaculty(mappedFaculty)
          try {
            localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(mappedFaculty))
          } catch (e) {}
        }
      })

    // 3. Realtime subscription on labs and profiles
    const channelName = `infra-changes-${Math.random().toString(36).substring(2, 8)}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labs' }, () => {
        supabase
          .from('labs')
          .select('*')
          .eq('is_active', true)
          .then(({ data: updatedLabs }) => {
            if (updatedLabs && isMounted) {
              const mapped: LabFacilityItem[] = updatedLabs.map((l: any) => ({
                id: l.id,
                name: l.name,
                code: l.code || l.id.toUpperCase(),
                capacity: l.capacity || 40,
                type: l.type || 'computer_lab',
                status: l.is_active ? 'Operational' : 'Maintenance',
              }))
              setLabs(mapped)
              try {
                localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(mapped))
              } catch (e) {}
            }
          })
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  // Cross-tab / cross-component sync
  useEffect(() => {
    const handleSync = () => {
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
        if (h) setHolidays(JSON.parse(h))
        const ic = localStorage.getItem(STORAGE_KEYS.INCIDENT_CATEGORIES)
        if (ic) setIncidentCategories(JSON.parse(ic))
        const is = localStorage.getItem(STORAGE_KEYS.INCIDENT_SETTINGS)
        if (is) setIncidentSettings(JSON.parse(is))
      } catch (e) {}
    }

    window.addEventListener('infrastructure-updated', handleSync)
    return () => window.removeEventListener('infrastructure-updated', handleSync)
  }, [])

  // 1. Periods Management
  const addPeriod = useCallback((period: PeriodSlotItem) => {
    setPeriods((prev) => {
      const updated = [...prev, period]
      saveToStorage(STORAGE_KEYS.PERIODS, updated)
      return updated
    })
  }, [])

  const updatePeriod = useCallback((id: string, updates: Partial<PeriodSlotItem>) => {
    setPeriods((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      saveToStorage(STORAGE_KEYS.PERIODS, updated)
      return updated
    })
  }, [])

  const deletePeriod = useCallback((id: string) => {
    setPeriods((prev) => {
      const updated = prev.filter((p) => p.id !== id)
      saveToStorage(STORAGE_KEYS.PERIODS, updated)
      return updated
    })
  }, [])

  const resetPeriods = useCallback(() => {
    setPeriods([...MASTER_TIME_SLOTS])
    saveToStorage(STORAGE_KEYS.PERIODS, [...MASTER_TIME_SLOTS])
  }, [])

  // 2. Labs Management
  const addLab = useCallback((lab: LabFacilityItem) => {
    setLabs((prev) => {
      const updated = [...prev, lab]
      saveToStorage(STORAGE_KEYS.LABS, updated)
      return updated
    })
  }, [])

  const deleteLab = useCallback((id: string) => {
    setLabs((prev) => {
      const updated = prev.filter((l) => l.id !== id)
      saveToStorage(STORAGE_KEYS.LABS, updated)
      return updated
    })
  }, [])

  // 3. Classes Management
  const addClass = useCallback((cls: ClassEnrollmentItem) => {
    setClasses((prev) => {
      const updated = [...prev, cls]
      saveToStorage(STORAGE_KEYS.CLASSES, updated)
      return updated
    })
  }, [])

  const deleteClass = useCallback((id: string) => {
    setClasses((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      saveToStorage(STORAGE_KEYS.CLASSES, updated)
      return updated
    })
  }, [])

  // 4. Faculty Management
  const addFaculty = useCallback((fac: FacultyMemberItem) => {
    setFaculty((prev) => {
      const updated = [...prev, fac]
      saveToStorage(STORAGE_KEYS.FACULTY, updated)
      return updated
    })
  }, [])

  const updateFaculty = useCallback((id: string, updates: Partial<FacultyMemberItem>) => {
    setFaculty((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      saveToStorage(STORAGE_KEYS.FACULTY, updated)
      return updated
    })
  }, [])

  const deleteFaculty = useCallback((id: string) => {
    setFaculty((prev) => {
      const updated = prev.filter((f) => f.id !== id)
      saveToStorage(STORAGE_KEYS.FACULTY, updated)
      return updated
    })
  }, [])

  // 5. Subjects & Teacher Assignment Management
  const addSubject = useCallback((sub: SubjectCurriculumItem) => {
    setSubjects((prev) => {
      const updated = [...prev, sub]
      saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
      return updated
    })
  }, [])

  const deleteSubject = useCallback((code: string) => {
    setSubjects((prev) => {
      const updated = prev.filter((s) => s.code !== code)
      saveToStorage(STORAGE_KEYS.SUBJECTS, updated)
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
      // Update assignedSubjectCodes in faculty roster
      const updatedFaculty = prevFaculty.map((f) => {
        const codes = f.assignedSubjectCodes || []
        if (f.id === teacherId) {
          return { ...f, assignedSubjectCodes: Array.from(new Set([...codes, subjectCode])) }
        } else {
          return { ...f, assignedSubjectCodes: codes.filter((c) => c !== subjectCode) }
        }
      })
      saveToStorage(STORAGE_KEYS.FACULTY, updatedFaculty)
      return updatedFaculty
    })

    setSubjects((prevSubjects) => {
      const updatedSubjects = prevSubjects.map((s) =>
        s.code === subjectCode ? { ...s, teacherId, teacherName } : s
      )
      saveToStorage(STORAGE_KEYS.SUBJECTS, updatedSubjects)
      return updatedSubjects
    })
  }, [])

  // 6. Holidays & Calendar Management
  const addHoliday = useCallback((hol: HolidayItem) => {
    setHolidays((prev) => {
      const updated = [hol, ...prev]
      saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
      return updated
    })
  }, [])

  const deleteHoliday = useCallback((id: string) => {
    setHolidays((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
      return updated
    })
  }, [])

  const checkIsHoliday = useCallback((dateStr: string) => {
    return holidays.some((h) => isDateWithinHoliday(dateStr, h))
  }, [holidays])

  const getHolidayForDate = useCallback((dateStr: string) => {
    return holidays.find((h) => isDateWithinHoliday(dateStr, h))
  }, [holidays])

  // 7. Incident Categories & Governance Settings Management
  const addIncidentCategory = useCallback((cat: IncidentCategoryItem) => {
    setIncidentCategories((prev) => {
      const updated = [...prev, cat]
      saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
      return updated
    })
  }, [])

  const updateIncidentCategory = useCallback((id: string, updates: Partial<IncidentCategoryItem>) => {
    setIncidentCategories((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
      return updated
    })
  }, [])

  const deleteIncidentCategory = useCallback((id: string) => {
    setIncidentCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, updated)
      return updated
    })
  }, [])

  const resetIncidentCategories = useCallback(() => {
    setIncidentCategories(DEFAULT_INCIDENT_CATEGORIES)
    saveToStorage(STORAGE_KEYS.INCIDENT_CATEGORIES, DEFAULT_INCIDENT_CATEGORIES)
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
      saveToStorage(STORAGE_KEYS.INCIDENT_SETTINGS, updated)
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
    deleteLab,
    addClass,
    deleteClass,
    addFaculty,
    updateFaculty,
    deleteFaculty,
    addSubject,
    deleteSubject,
    assignTeacherToSubject,
    addHoliday,
    deleteHoliday,
    checkIsHoliday,
    getHolidayForDate,
    addIncidentCategory,
    updateIncidentCategory,
    deleteIncidentCategory,
    resetIncidentCategories,
    updateIncidentSettings,
  }
}
