'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Check,
  X,
  Edit3,
  Trash2,
  Lock,
  Info,
  FileText,
  Users,
  Monitor,
  LayoutGrid,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { NepaliDatePicker } from '@/components/ui/nepali-date-picker'
import {
  getAcademicYears,
  setCurrentAcademicYear,
  createAcademicYear,
  updateAcademicYearAction,
  checkAcademicYearDependenciesAction,
  deleteAcademicYearAction,
} from '@/app/actions/academic-years'
import type { AcademicYear, AcademicYearDependencyReport } from '@/lib/types/academic-years'

interface AcademicYearsManagerProps {
  isEditModeUnlocked: boolean
  triggerToast?: (msg: string) => void
}

export function AcademicYearsManager({
  isEditModeUnlocked,
  triggerToast,
}: AcademicYearsManagerProps) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [newYearId, setNewYearId] = useState<string>('')
  const [newName, setNewName] = useState<string>('')
  const [newStartDate, setNewStartDate] = useState<string>('')
  const [newEndDate, setNewEndDate] = useState<string>('')
  const [setAsCurrentOnCreate, setSetAsCurrentOnCreate] = useState<boolean>(false)
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false)
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editStartDate, setEditStartDate] = useState<string>('')
  const [editEndDate, setEditEndDate] = useState<string>('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Safe Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [deletingYear, setDeletingYear] = useState<AcademicYear | null>(null)
  const [dependencyReport, setDependencyReport] = useState<AcademicYearDependencyReport | null>(null)
  const [isCheckingDeps, setIsCheckingDeps] = useState<boolean>(false)
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('')

  const showToast = useCallback(
    (msg: string) => {
      if (triggerToast) {
        triggerToast(msg)
      } else {
        alert(msg)
      }
    },
    [triggerToast]
  )

  // Fetch Academic Years
  const fetchYears = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getAcademicYears()
      if (res.success && res.data) {
        setAcademicYears(res.data)
      } else {
        setAcademicYears([])
        if (res.error) showToast(res.error)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load academic years'
      console.error(msg)
      setAcademicYears([])
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchYears()
  }, [fetchYears])

  // Active current year
  const activeYear = useMemo(() => {
    return academicYears.find((y) => y.is_current) || null
  }, [academicYears])

  // Handle Switch Active Year
  const handleSetActiveYear = async (targetYear: AcademicYear) => {
    if (!isEditModeUnlocked) {
      showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to modify academic cycles.')
      return
    }

    if (targetYear.is_current) return

    setActionLoadingId(targetYear.id)
    try {
      const res = await setCurrentAcademicYear(targetYear.id)
      if (res.success) {
        showToast(`✅ Academic year switched to ${targetYear.name || targetYear.id}`)
        await fetchYears()
      } else {
        showToast(res.error || 'Failed to switch active academic year.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      showToast(msg)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!isEditModeUnlocked) {
      setCreateError('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before creating academic years.')
      return
    }

    const cleanId = newYearId.trim()
    const cleanName = newName.trim()

    if (!cleanId || !cleanName || !newStartDate || !newEndDate) {
      setCreateError('All fields (Year ID, Title, Start Date, End Date) are required.')
      return
    }

    setIsSubmittingCreate(true)
    try {
      const res = await createAcademicYear({
        id: cleanId,
        name: cleanName,
        start_date: newStartDate,
        end_date: newEndDate,
        is_current: setAsCurrentOnCreate,
      })

      if (res.success) {
        showToast(`🎉 Academic Year ${cleanName} created successfully.`)
        setIsCreateModalOpen(false)
        setNewYearId('')
        setNewName('')
        setNewStartDate('')
        setNewEndDate('')
        setSetAsCurrentOnCreate(false)
        await fetchYears()
      } else {
        setCreateError(res.error || 'Failed to create academic year.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error creating academic year'
      setCreateError(msg)
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // Handle Open Edit Modal
  const handleOpenEditModal = (year: AcademicYear) => {
    if (!isEditModeUnlocked) {
      showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before editing.')
      return
    }
    setEditingYear(year)
    setEditName(year.name)
    setEditStartDate(year.start_date ? year.start_date.split('T')[0] : '')
    setEditEndDate(year.end_date ? year.end_date.split('T')[0] : '')
    setEditError(null)
    setIsEditModalOpen(true)
  }

  // Handle Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingYear) return

    if (!isEditModeUnlocked) {
      setEditError('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to modify academic cycles.')
      return
    }

    const cleanName = editName.trim()
    if (!cleanName || !editStartDate || !editEndDate) {
      setEditError('Display name, start date, and end date are required.')
      return
    }

    setIsSubmittingEdit(true)
    setEditError(null)
    try {
      const res = await updateAcademicYearAction({
        id: editingYear.id,
        name: cleanName,
        start_date: editStartDate,
        end_date: editEndDate,
      })

      if (res.success) {
        showToast(`✅ Academic Year ${cleanName} updated successfully.`)
        setIsEditModalOpen(false)
        setEditingYear(null)
        await fetchYears()
      } else {
        setEditError(res.error || 'Failed to update academic year.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error updating academic year'
      setEditError(msg)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Handle Open Delete Modal with Real-time Pre-Flight Inspection
  const handleOpenDeleteModal = async (year: AcademicYear) => {
    if (!isEditModeUnlocked) {
      showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before deleting.')
      return
    }
    setDeletingYear(year)
    setDependencyReport(null)
    setDeleteError(null)
    setDeleteConfirmText('')
    setIsDeleteModalOpen(true)
    setIsCheckingDeps(true)

    try {
      const res = await checkAcademicYearDependenciesAction(year.id)
      if (res.success && res.data) {
        setDependencyReport(res.data)
      } else {
        setDeleteError(res.error || 'Failed to inspect academic year dependencies.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inspecting dependencies'
      setDeleteError(msg)
    } finally {
      setIsCheckingDeps(false)
    }
  }

  // Handle Confirm Delete
  const handleDeleteSubmit = async () => {
    if (!deletingYear || !dependencyReport) return
    if (!isEditModeUnlocked) {
      setDeleteError('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top before deleting.')
      return
    }
    if (!dependencyReport.canDelete) {
      setDeleteError('Deletion is strictly blocked to preserve historical operational records.')
      return
    }
    if (deleteConfirmText.trim() !== deletingYear.id.trim()) {
      setDeleteError(`Please type "${deletingYear.id}" exactly to confirm deletion.`)
      return
    }

    setIsSubmittingDelete(true)
    setDeleteError(null)
    try {
      const res = await deleteAcademicYearAction(deletingYear.id)
      if (res.success) {
        showToast(`🗑️ Academic Year ${deletingYear.name} permanently deleted.`)
        setIsDeleteModalOpen(false)
        setDeletingYear(null)
        setDependencyReport(null)
        await fetchYears()
      } else {
        setDeleteError(res.error || 'Failed to delete academic year.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error deleting academic year'
      setDeleteError(msg)
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Metric Header Row: Direct Grid, No Double Nesting */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Current Active Cycle */}
        <div className="glass-card p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Cycle</div>
              <div className="text-base font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                {activeYear ? activeYear.name : 'None Selected'}
              </div>
            </div>
          </div>
          {activeYear && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          )}
        </div>

        {/* Metric 2: Total Defined Cycles */}
        <div className="glass-card p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Cycles</div>
              <div className="text-base font-extrabold font-heading text-zinc-900 dark:text-white tabular-nums">
                {academicYears.length} Years
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">B.S. Calendar</span>
        </div>

        {/* Metric 3: Safety Guard Status */}
        <div className="glass-card p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${
                isEditModeUnlocked
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Precaution Guard</div>
              <div className="text-xs font-bold font-heading text-zinc-900 dark:text-white">
                {isEditModeUnlocked ? 'Unlocked (Edit Mode)' : 'Precaution Active'}
              </div>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isEditModeUnlocked
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-slate-400'
            }`}
          >
            {isEditModeUnlocked ? 'Caution' : 'Locked'}
          </span>
        </div>
      </div>

      {/* Main Academic Years Card */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <Calendar className="h-4 w-4 text-indigo-500" />
              <span>Academic Year Operational Cycles</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
              Governs student enrollments, timetable schedules, and practical logbooks across the institution.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchYears}
              disabled={isLoading}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-500 hover:text-zinc-900 dark:hover:text-white transition disabled:opacity-50 cursor-pointer"
              title="Refresh Academic Years"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            <Button
              size="sm"
              onClick={() => {
                if (!isEditModeUnlocked) {
                  showToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to create a new academic year.')
                  return
                }
                setIsCreateModalOpen(true)
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Calendar className="h-4 w-4" />
              <span>New Academic Year</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span>Loading institutional academic years...</span>
            </div>
          ) : academicYears.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No academic years registered yet. Click &quot;New Academic Year&quot; above to initialize.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {academicYears.map((year) => {
                const isCurrent = year.is_current
                const isActionLoading = actionLoadingId === year.id

                return (
                  <div
                    key={year.id}
                    className={`p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isCurrent
                        ? 'bg-indigo-500/[0.03] dark:bg-indigo-500/[0.06]'
                        : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    {/* Left: Identity & Badges */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-slate-400'
                        }`}
                      >
                        <Calendar className="h-5 w-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold font-heading text-zinc-900 dark:text-white">
                            {year.name}
                          </h4>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-slate-500">
                            {year.id}
                          </span>

                          {isCurrent ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold px-2 py-0.5">
                              Current Active Cycle
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400 border-zinc-200 dark:border-zinc-700">
                              Archived / Past
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Start: <strong className="text-zinc-700 dark:text-slate-200">{year.start_date}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            End: <strong className="text-zinc-700 dark:text-slate-200">{year.end_date}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                      {isCurrent ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Active Cycle</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetActiveYear(year)}
                          disabled={isActionLoading || !isEditModeUnlocked}
                          className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition disabled:opacity-50"
                          title={
                            !isEditModeUnlocked
                              ? 'Unlock Precaution Active at the top to switch the active cycle'
                              : 'Set this academic year as the active operational cycle'
                          }
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-indigo-500" />
                          )}
                          <span>Set as Active</span>
                        </Button>
                      )}

                      {/* Edit Button: Safe modification preserving immutable ID */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditModal(year)}
                        disabled={!isEditModeUnlocked}
                        className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                        title={
                          !isEditModeUnlocked
                            ? 'Unlock Precaution Active at the top to edit this academic year'
                            : 'Safely edit display title and date range without touching primary key ID'
                        }
                      >
                        <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Edit</span>
                      </Button>

                      {/* Safe Delete Button: Omitted for active cycle */}
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDeleteModal(year)}
                          disabled={!isEditModeUnlocked}
                          className="text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30 hover:bg-rose-500/10 hover:border-rose-500/30 transition disabled:opacity-50"
                          title={
                            !isEditModeUnlocked
                              ? 'Unlock Precaution Active at the top to delete academic cycles'
                              : 'Safely check dependencies and delete empty/accidental cycle'
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          <span>Delete</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: New Academic Year */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#101726] border border-zinc-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-4 px-5 border-b border-zinc-100 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/60 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">New Academic Year</h3>
                  <p className="text-[11px] text-slate-400">Initialize a new academic operational cycle</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Year ID / Code</label>
                  <Input
                    placeholder="e.g. 2084"
                    value={newYearId}
                    onChange={(e) => setNewYearId(e.target.value)}
                    className="text-xs h-9 rounded-xl border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32]"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Database primary key</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Display Label</label>
                  <Input
                    placeholder="e.g. 2084/85 B.S."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-xs h-9 rounded-xl border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32]"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Shown across UI</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Start Date (वि.सं.)</label>
                  <NepaliDatePicker
                    value={newStartDate}
                    onChange={(dateStr) => setNewStartDate(dateStr)}
                    placeholder="सुरु मिति / Start Date"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">End Date (वि.सं.)</label>
                  <NepaliDatePicker
                    value={newEndDate}
                    onChange={(dateStr) => setNewEndDate(dateStr)}
                    placeholder="अन्त्य मिति / End Date"
                    align="right"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#151E32] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">Set as Active Year Immediately</div>
                  <div className="text-[10px] text-slate-400">All daily rosters and schedules will switch to this cycle</div>
                </div>
                <input
                  type="checkbox"
                  checked={setAsCurrentOnCreate}
                  onChange={(e) => setSetAsCurrentOnCreate(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingCreate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingCreate ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Create Academic Year</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Academic Year */}
      {isEditModalOpen && editingYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#101726] border border-zinc-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-4 px-5 border-b border-zinc-100 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/60 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Edit Academic Year</h3>
                  <p className="text-[11px] text-slate-400">Update display name and operational date range</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Data Integrity Protection Notice */}
              <div className="p-3 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">100% Relational Data Integrity Guaranteed</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Primary Key ID (<span className="font-mono font-bold text-zinc-900 dark:text-white">{editingYear.id}</span>) is locked and immutable. All linked practical logs, student enrollments, and timetables remain completely unharmed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <span>Year ID / Code</span>
                    <Lock className="h-3 w-3 text-slate-400" />
                  </label>
                  <Input
                    value={editingYear.id}
                    disabled
                    className="text-xs h-9 rounded-xl border-zinc-200 dark:border-white/[0.08] bg-zinc-100 dark:bg-zinc-800/60 font-mono text-slate-500 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400">Primary Key (Locked)</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Display Label</label>
                  <Input
                    placeholder="e.g. 2083/84 B.S."
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xs h-9 rounded-xl border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32]"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Shown across all UI pages</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Start Date (वि.सं.)</label>
                  <NepaliDatePicker
                    value={editStartDate}
                    onChange={(dateStr) => setEditStartDate(dateStr)}
                    placeholder="सुरु मिति / Start Date"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">End Date (वि.सं.)</label>
                  <NepaliDatePicker
                    value={editEndDate}
                    onChange={(dateStr) => setEditEndDate(dateStr)}
                    placeholder="अन्त्य मिति / End Date"
                    align="right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmittingEdit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Save Changes</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Safe Academic Year Deletion & Pre-Flight Dependency Inspector */}
      {isDeleteModalOpen && deletingYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#101726] border border-zinc-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-4 px-5 border-b border-zinc-100 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/60 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Safe Academic Year Deletion</h3>
                  <p className="text-[11px] text-slate-400">Pre-flight relational dependency & audit inspection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Target Cycle Card */}
              <div className="glass-card p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Academic Cycle</div>
                  <div className="text-sm font-extrabold font-heading text-zinc-900 dark:text-white">
                    {deletingYear.name} <span className="font-mono text-xs font-normal text-slate-400">({deletingYear.id})</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  वि.सं. {deletingYear.id}
                </Badge>
              </div>

              {/* Dependency Inspection Telemetry */}
              {isCheckingDeps ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-zinc-500 text-xs">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <span className="font-medium">Inspecting relational databases across practical logs, enrollments, and timetables...</span>
                </div>
              ) : dependencyReport ? (
                <>
                  {!dependencyReport.canDelete ? (
                    /* CASE A: Deletion Blocked due to existing records (e.g. 1000 logs) */
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
                        <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400">
                            Deletion Strictly Blocked (NEB Compliance Lock)
                          </h4>
                          <p className="text-[11px] text-rose-600/90 dark:text-rose-300 leading-relaxed">
                            {dependencyReport.blockReason}
                          </p>
                        </div>
                      </div>

                      {/* High Density Metric Breakdown */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="glass-card p-2.5 rounded-xl flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-indigo-500" />
                          <div>
                            <div className="text-[10px] text-slate-400">Practical Logs</div>
                            <div className="font-extrabold font-heading tabular-nums text-zinc-900 dark:text-white">
                              {dependencyReport.practicalLogsCount} Logs
                            </div>
                          </div>
                        </div>

                        <div className="glass-card p-2.5 rounded-xl flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-emerald-500" />
                          <div>
                            <div className="text-[10px] text-slate-400">Student Enrollments</div>
                            <div className="font-extrabold font-heading tabular-nums text-zinc-900 dark:text-white">
                              {dependencyReport.enrollmentsCount} Students
                            </div>
                          </div>
                        </div>

                        <div className="glass-card p-2.5 rounded-xl flex items-center gap-2.5">
                          <Monitor className="h-4 w-4 text-amber-500" />
                          <div>
                            <div className="text-[10px] text-slate-400">Seat Assignments</div>
                            <div className="font-extrabold font-heading tabular-nums text-zinc-900 dark:text-white">
                              {dependencyReport.seatPlansCount} Desks
                            </div>
                          </div>
                        </div>

                        <div className="glass-card p-2.5 rounded-xl flex items-center gap-2.5">
                          <LayoutGrid className="h-4 w-4 text-purple-500" />
                          <div>
                            <div className="text-[10px] text-slate-400">Timetable Schedules</div>
                            <div className="font-extrabold font-heading tabular-nums text-zinc-900 dark:text-white">
                              {dependencyReport.schedulesCount} Slots
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-white/[0.06] text-[11px] text-slate-500 dark:text-slate-400">
                        💡 <strong>Institutional Policy</strong>: Academic operational data is permanent. To protect historical NEB 75% attendance audits, completed years must remain preserved in archive mode.
                      </div>
                    </div>
                  ) : (
                    /* CASE B: Safe Deletion Allowed (0 records detected, accidental year) */
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            Zero Operational Records Detected
                          </h4>
                          <p className="text-[11px] text-amber-600/90 dark:text-amber-300 leading-relaxed">
                            This academic cycle has 0 practical logs, 0 student enrollments, 0 seat plans, and 0 schedules. It is confirmed to be an empty or accidental creation.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Confirm Deletion by Typing Year ID: <span className="font-mono text-zinc-900 dark:text-white font-bold">{deletingYear.id}</span>
                        </label>
                        <Input
                          placeholder={`Type "${deletingYear.id}" to confirm`}
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="text-xs h-9 rounded-xl border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#151E32] font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : null}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  {dependencyReport && !dependencyReport.canDelete ? 'Understood — Keep Archived' : 'Cancel'}
                </Button>

                {dependencyReport && dependencyReport.canDelete && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubmittingDelete || deleteConfirmText.trim() !== deletingYear.id.trim()}
                    onClick={handleDeleteSubmit}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingDelete ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>Permanently Delete Empty Cycle</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
