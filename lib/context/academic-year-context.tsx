'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { getAcademicYears } from '@/app/actions/academic-years'
import type { AcademicYear } from '@/lib/types/academic-years'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface AcademicYearContextType {
  systemActiveYear: string
  systemActiveYearName: string
  userViewingYear: string
  setUserViewingYear: (yearId: string) => void
  isViewingArchived: boolean
  academicYears: AcademicYear[]
  resetToActiveYear: () => void
  isLoading: boolean
}

const AcademicYearContext = createContext<AcademicYearContextType>({
  systemActiveYear: '2083',
  systemActiveYearName: '2083 B.S.',
  userViewingYear: '2083',
  setUserViewingYear: () => {},
  isViewingArchived: false,
  academicYears: [],
  resetToActiveYear: () => {},
  isLoading: true,
})

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [systemActiveYear, setSystemActiveYear] = useState<string>('2083')
  const [systemActiveYearName, setSystemActiveYearName] = useState<string>('2083 B.S.')
  const [userViewingYear, setUserViewingYearState] = useState<string>('2083')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Load active and configured academic years on mount
  useEffect(() => {
    async function loadYears() {
      try {
        const res = await getAcademicYears()
        if (res.success && res.data && res.data.length > 0) {
          setAcademicYears(res.data)
          const current = res.data.find((y) => y.is_current)
          if (current) {
            setSystemActiveYear(current.id)
            setSystemActiveYearName(current.name)
            setUserViewingYearState(current.id)
          }
        }
      } catch (err) {
        console.error('Failed to load academic cycles in provider:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadYears()
  }, [])

  const setUserViewingYear = useCallback((yearId: string) => {
    setUserViewingYearState(yearId)
  }, [])

  const resetToActiveYear = useCallback(() => {
    setUserViewingYearState(systemActiveYear)
  }, [systemActiveYear])

  const isViewingArchived = useMemo(() => {
    return userViewingYear !== systemActiveYear
  }, [userViewingYear, systemActiveYear])

  const value = useMemo(
    () => ({
      systemActiveYear,
      systemActiveYearName,
      userViewingYear,
      setUserViewingYear,
      isViewingArchived,
      academicYears,
      resetToActiveYear,
      isLoading,
    }),
    [
      systemActiveYear,
      systemActiveYearName,
      userViewingYear,
      setUserViewingYear,
      isViewingArchived,
      academicYears,
      resetToActiveYear,
      isLoading,
    ]
  )

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  )
}

export function useAcademicYear() {
  return useContext(AcademicYearContext)
}

/**
 * Ambient banner alerting the user when viewing an archived historical year
 */
export function HistoricalArchiveShield() {
  const { isViewingArchived, userViewingYear, academicYears, systemActiveYearName, resetToActiveYear } = useAcademicYear()

  if (!isViewingArchived) return null

  const viewingYearObj = academicYears.find((y) => y.id === userViewingYear)
  const viewingName = viewingYearObj ? viewingYearObj.name : `${userViewingYear} B.S.`

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-amber-400 text-xs font-medium animate-in slide-in-from-top-1 duration-150 select-none">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <span>
          Viewing Historical Archive: <strong className="font-bold text-amber-300">{viewingName}</strong> (Historical Read-Only Mode)
        </span>
      </div>
      <button
        type="button"
        onClick={resetToActiveYear}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold transition-all cursor-pointer"
      >
        <RotateCcw className="h-3 w-3" />
        <span>Switch to Active Cycle ({systemActiveYearName})</span>
      </button>
    </div>
  )
}
