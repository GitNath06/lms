'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import {
  Users,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Wand2,
  RefreshCw,
  Calendar,
  GraduationCap,
  Layers,
  Loader2,
  X,
  ShieldAlert,
  ChevronDown,
  Eye,
  Upload,
} from 'lucide-react'
import { WorkstationNode } from './workstation-node'
import { FloorLandmarkNode } from './floor-landmark-node'
import { StudentTray } from './student-tray'
import { RosterImportModal } from '@/components/roster/roster-import-modal'
import {
  getLabSeatPlan,
  getAuthorizedClasses,
  assignStudentToSeat,
  swapStudents,
  clearSeatAssignment,
  autoAssignRemainingSeats,
  clearSessionSeatOverride,
} from '@/app/actions/seat-plans'
import { getAcademicYears } from '@/app/actions/academic-years'
import { getLabFloorElements } from '@/app/actions/floor-elements'
import type {
  CohortSeatPlanData,
  WorkstationWithAssignment,
} from '@/lib/types/seat-plans'
import type { StudentWithEnrollment } from '@/lib/types/students'
import type { LabFloorElementRow } from '@/types/database'

interface SeatPlannerTabProps {
  labId?: string
  labName?: string
  isPrivileged?: boolean
  onInspectWorkstation?: (wsId: string) => void
}

export function SeatPlannerTab({
  labId = 'comp',
  labName = 'Computer Lab 01',
  isPrivileged = false,
  onInspectWorkstation,
}: SeatPlannerTabProps) {
  // Cohort Selection State
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string }>>([])
  const [selectedYearId, setSelectedYearId] = useState<string>('2083')
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('12eng')

  // Seat Plan State
  const [planData, setPlanData] = useState<CohortSeatPlanData | null>(null)
  const [floorElements, setFloorElements] = useState<LabFloorElementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Selected Student in Tray (Click-to-assign workflow)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithEnrollment | null>(null)

  // Drag over target workstation ID
  const [dragOverWsId, setDragOverWsId] = useState<string | null>(null)

  // Modal / Action Popovers
  const [activeWsModal, setActiveWsModal] = useState<WorkstationWithAssignment | null>(null)
  const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false)
  const [swapTargetWsId, setSwapTargetWsId] = useState<string>('')
  const [isAutoAssignDialogOpen, setIsAutoAssignDialogOpen] = useState(false)
  const [isAutoAssigning, setIsAutoAssigning] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Mobile Bottom Sheet for Student Tray
  const [isMobileTrayOpen, setIsMobileTrayOpen] = useState(false)

  // 1. Load Academic Years & Authorized Classes on Mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const [yearsRes, classesRes] = await Promise.all([
          getAcademicYears(),
          getAuthorizedClasses(),
        ])

        if (yearsRes.success && yearsRes.data) {
          setAcademicYears(yearsRes.data)
          const current = yearsRes.data.find((y: any) => y.is_current)
          if (current) setSelectedYearId(current.id)
        }

        if (classesRes.success && classesRes.data && classesRes.data.length > 0) {
          setClasses(classesRes.data)
          const defaultClass = classesRes.data.find((c: any) => c.id === '12eng') || classesRes.data[0]
          setSelectedClassId(defaultClass.id)
        }
      } catch (err) {
        console.error('Failed to load cohort metadata:', err)
      }
    }
    loadMeta()
  }, [])

  // 2. Fetch Seat Plan & Floor Elements whenever cohort changes
  const fetchSeatPlan = useCallback(async () => {
    if (!selectedClassId) return
    setLoading(true)
    setError(null)

    try {
      const [seatRes, floorRes] = await Promise.all([
        getLabSeatPlan({
          labId,
          classId: selectedClassId,
          academicYearId: selectedYearId,
        }),
        getLabFloorElements(labId),
      ])

      if (!seatRes.success || !seatRes.data) {
        setError(seatRes.error || 'Failed to load seat plan.')
        setPlanData(null)
      } else {
        setPlanData(seatRes.data)
      }

      if (floorRes.success && floorRes.data) {
        setFloorElements(floorRes.data)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading seat plan'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [labId, selectedClassId, selectedYearId])

  useEffect(() => {
    fetchSeatPlan()
  }, [fetchSeatPlan])

  // Helper for status toasts
  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type })
    setTimeout(() => setActionMessage(null), 3500)
  }

  // 3. Assign Student to Workstation (Click or Drop)
  const handleAssignToWorkstation = async (ws: WorkstationWithAssignment, enrollmentId: string) => {
    if (!isPrivileged) {
      notify('Read-Only View: Seat assignments can only be modified by Super Admin or Lab In-Charge.', 'error')
      setSelectedStudent(null)
      return
    }

    startTransition(async () => {
      try {
        const res = await assignStudentToSeat({
          lab_id: labId,
          academic_year_id: selectedYearId,
          class_id: selectedClassId,
          workstation_id: ws.id,
          enrollment_id: enrollmentId,
        })

        if (!res.success) {
          notify(res.error || 'Assignment failed', 'error')
        } else {
          notify(`Student assigned to ${ws.label}`, 'success')
          setSelectedStudent(null)
          fetchSeatPlan()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to assign seat'
        notify(msg, 'error')
      }
    })
  }

  // 4. Click Handler for Workstation Node
  const handleWorkstationClick = (ws: WorkstationWithAssignment) => {
    // If a student is currently selected in tray -> assign to this workstation!
    if (selectedStudent) {
      if (!isPrivileged) {
        notify('Read-Only View: Seat assignments can only be modified by Super Admin or Lab In-Charge.', 'error')
        setSelectedStudent(null)
        return
      }
      handleAssignToWorkstation(ws, selectedStudent.enrollment_id)
      return
    }

    // Otherwise, open node action modal
    setActiveWsModal(ws)
  }

  // 5. Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent, wsId: string) => {
    if (!isPrivileged) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverWsId(wsId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isPrivileged) return
    e.preventDefault()
    setDragOverWsId(null)
  }

  const handleDrop = async (e: React.DragEvent, ws: WorkstationWithAssignment) => {
    if (!isPrivileged) {
      notify('Read-Only View: Seat assignments can only be modified by Super Admin or Lab In-Charge.', 'error')
      return
    }
    e.preventDefault()
    setDragOverWsId(null)

    const rawData = e.dataTransfer.getData('application/json')
    if (!rawData) return

    try {
      const parsed = JSON.parse(rawData)
      if (parsed.type === 'student' && parsed.enrollment_id) {
        handleAssignToWorkstation(ws, parsed.enrollment_id)
      }
    } catch (err) {
      console.error('Invalid drag payload:', err)
    }
  }

  // 6. Student Swap Execution
  const handleExecuteSwap = async () => {
    if (!activeWsModal || !swapTargetWsId) return

    startTransition(async () => {
      try {
        const res = await swapStudents({
          lab_id: labId,
          academic_year_id: selectedYearId,
          class_id: selectedClassId,
          workstation_id_a: activeWsModal.id,
          workstation_id_b: swapTargetWsId,
        })

        if (!res.success) {
          notify(res.error || 'Swap failed', 'error')
        } else {
          notify('Students swapped successfully', 'success')
          setIsSwapDialogOpen(false)
          setActiveWsModal(null)
          setSwapTargetWsId('')
          fetchSeatPlan()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Swap execution error'
        notify(msg, 'error')
      }
    })
  }

  // 7. Clear Assignment
  const handleClearAssignment = async () => {
    if (!activeWsModal?.assignment) return

    startTransition(async () => {
      try {
        const res = await clearSeatAssignment(activeWsModal.assignment!.seat_plan_id)
        if (!res.success) {
          notify(res.error || 'Failed to remove assignment', 'error')
        } else {
          notify(`Assignment removed from ${activeWsModal.label}`, 'success')
          setActiveWsModal(null)
          fetchSeatPlan()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error clearing seat'
        notify(msg, 'error')
      }
    })
  }

  // 8. Auto-Assign Execution
  const handleAutoAssign = async () => {
    setIsAutoAssigning(true)
    try {
      const res = await autoAssignRemainingSeats({
        lab_id: labId,
        academic_year_id: selectedYearId,
        class_id: selectedClassId,
      })

      if (!res.success) {
        notify(res.error || 'Auto-assignment failed', 'error')
      } else {
        notify(`Auto-assigned ${res.data?.assigned_count || 0} students to workstations.`, 'success')
        setIsAutoAssignDialogOpen(false)
        fetchSeatPlan()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Auto-assign error'
      notify(msg, 'error')
    } finally {
      setIsAutoAssigning(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. TOP COHORT SELECTOR & TELEMETRY STRIP */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] p-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Cohort Selectors: Year + Class */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Academic Year */}
            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[10px] uppercase font-bold text-slate-400">Year:</span>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
              >
                {academicYears.map((yr) => (
                  <option key={yr.id} value={yr.id} className="bg-[#101726] text-white">
                    {yr.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class / Cohort */}
            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-1.5 text-xs">
              <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase font-bold text-slate-400">Class:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id} className="bg-[#101726] text-white">
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sync Button */}
            <button
              type="button"
              disabled={loading}
              onClick={fetchSeatPlan}
              className="rounded-xl border border-white/[0.08] bg-[#151E32] p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh seat plan"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {!isPrivileged && (
              <span className="flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-300">
                <Eye className="h-3 w-3" />
                <span>Read-Only View</span>
              </span>
            )}

            {isPrivileged && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-600/20 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-600/30 hover:text-white transition cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import Roster</span>
              </button>
            )}
          </div>

          {/* Realtime Cohort Metrics */}
          {planData && (
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Total Enrolled:</span>
                <span className="font-mono font-extrabold text-white tabular-nums">
                  {planData.total_students}
                </span>
              </div>
              <div className="h-3 w-px bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Seated:</span>
                <span className="font-mono font-extrabold text-emerald-400 tabular-nums">
                  {planData.assigned_count}
                </span>
              </div>
              <div className="h-3 w-px bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Unassigned:</span>
                <span className="font-mono font-extrabold text-amber-400 tabular-nums">
                  {planData.unassigned_count}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action / Status Toast Banner */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-top-2 ${
            actionMessage.type === 'success'
              ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
              : 'border-rose-500/50 bg-rose-950/80 text-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="p-1 rounded hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Selected Student Active Notice */}
      {selectedStudent && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-500/50 bg-indigo-950/80 px-4 py-2 text-xs text-indigo-200 shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-extrabold font-mono bg-indigo-500/20 px-2 py-0.5 rounded">
              Roll {selectedStudent.roll_number}
            </span>
            <span>
              Assigning <strong className="text-white">{selectedStudent.full_name}</strong> &mdash; Click any PC workstation node to place.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedStudent(null)}
            className="text-xs font-bold text-indigo-300 hover:text-white underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 2. MAIN WORKBENCH: VISUAL FLOOR + STUDENT TRAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Floor Canvas Area (Primary Hero - 8 or 9 cols on desktop) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-3">
          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-[#101726] p-8 text-center">
              <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">Seat Plan Unavailable</h3>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
          ) : (
            <div
              className="relative w-full aspect-[16/9] min-h-[380px] sm:min-h-[500px] rounded-2xl border border-white/[0.08] bg-[#0B0F19] overflow-hidden select-none shadow-2xl"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 80%),
                  linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
                `,
                backgroundSize: '100% 100%, 32px 32px, 32px 32px',
              }}
            >
              {/* Database-backed Floor Landmarks */}
              {floorElements.map((el) => (
                <FloorLandmarkNode key={el.id} element={el} />
              ))}

              {/* Workstation Nodes with Student Badges */}
              {(planData?.workstations || []).map((ws) => (
                <WorkstationNode
                  key={ws.id}
                  workstation={ws as any}
                  isSeatPlanMode={true}
                  isSelected={activeWsModal?.id === ws.id}
                  isDropTarget={dragOverWsId === ws.id}
                  onClick={() => handleWorkstationClick(ws)}
                  onDragOver={(e) => handleDragOver(e, ws.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, ws)}
                />
              ))}

              {/* Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 bg-[#0B0F19]/60 backdrop-blur-xs flex items-center justify-center z-40">
                  <div className="flex items-center gap-2 rounded-xl bg-[#151E32] px-4 py-2 border border-white/10 text-xs font-semibold text-white">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span>Loading cohort seating...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visual Floor Status Legend Bar */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#101726] p-3 text-xs text-slate-300 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span>Operational (Ready)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                <span>Student Assigned</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span>Session Override</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Hardware Issue</span>
              </div>
            </div>

            {/* Mobile Drawer Trigger Button */}
            <div className="block lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileTrayOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Unassigned Tray ({planData?.unassigned_count || 0})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Unassigned Students Dock (Right column on desktop) */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3">
          <StudentTray
            unassignedStudents={planData?.unassigned_students || []}
            selectedStudent={selectedStudent}
            onSelectStudent={setSelectedStudent}
            onAutoAssign={() => setIsAutoAssignDialogOpen(true)}
            isAutoAssigning={isAutoAssigning}
            isPrivileged={isPrivileged}
          />
        </div>
      </div>

      {/* 3. MOBILE BOTTOM SHEET FOR UNASSIGNED TRAY */}
      {isMobileTrayOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:hidden">
          <div className="w-full max-h-[80vh] rounded-t-3xl border-t border-white/10 bg-[#101726] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <span>Unassigned Students ({planData?.unassigned_count || 0})</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileTrayOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3">
              <StudentTray
                unassignedStudents={planData?.unassigned_students || []}
                selectedStudent={selectedStudent}
                onSelectStudent={(st) => {
                  setSelectedStudent(st)
                  setIsMobileTrayOpen(false)
                }}
                onAutoAssign={() => {
                  setIsMobileTrayOpen(false)
                  setIsAutoAssignDialogOpen(true)
                }}
                isAutoAssigning={isAutoAssigning}
                isPrivileged={isPrivileged}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. WORKSTATION ACTION POPOVER / MODAL */}
      {activeWsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101726] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <h4 className="font-heading font-extrabold text-base text-white">
                  {activeWsModal.label}
                </h4>
                <span className="text-[11px] text-slate-400">
                  {activeWsModal.row_label || 'Workstation'} &bull; {activeWsModal.device_type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveWsModal(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              {/* Assignment Info */}
              {activeWsModal.assignment ? (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <span className="text-[10px] font-bold uppercase text-indigo-400">
                    Default Assigned Student
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-white">
                      {activeWsModal.assignment.student_name}
                    </span>
                    <span className="font-mono text-xs font-extrabold text-indigo-300">
                      Roll {activeWsModal.assignment.roll_number}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-[#151E32]/50 p-3 text-center text-xs text-slate-400">
                  No default student assigned to this workstation.
                </div>
              )}

              {/* Active Issue Info if any */}
              {activeWsModal.active_issue && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Active Hardware Fault</span>
                  </div>
                  <p className="text-xs text-rose-200 mt-1">
                    {activeWsModal.active_issue.title || 'Maintenance ticket reported.'}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {isPrivileged && activeWsModal.assignment && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsSwapDialogOpen(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:border-indigo-500/50 transition-colors"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Swap Seat with Another PC</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAssignment}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
                    >
                      <span>Remove Student Assignment</span>
                    </button>
                  </>
                )}

                {!isPrivileged && activeWsModal.assignment && (
                  <div className="rounded-xl border border-white/5 bg-[#151E32]/40 p-2.5 text-center text-[11px] text-slate-400">
                    Read-only session view. Seat allocations can only be modified by Super Admin or Lab In-Charge.
                  </div>
                )}

                {onInspectWorkstation && (
                  <button
                    type="button"
                    onClick={() => {
                      onInspectWorkstation(activeWsModal.id)
                      setActiveWsModal(null)
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    <span>Inspect Hardware &amp; Tickets</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ATOMIC STUDENT SWAP DIALOG */}
      {isSwapDialogOpen && activeWsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#101726] p-5 shadow-2xl">
            <h4 className="font-heading font-extrabold text-sm text-white mb-2">
              Swap Seats &mdash; {activeWsModal.label}
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Select another workstation to swap positions atomically without data loss.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400">Target Workstation</label>
                <select
                  value={swapTargetWsId}
                  onChange={(e) => setSwapTargetWsId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/[0.08] bg-[#151E32] px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose workstation --</option>
                  {(planData?.workstations || [])
                    .filter((w) => w.id !== activeWsModal.id)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label} {w.assignment ? `(${w.assignment.student_name} - Roll ${w.assignment.roll_number})` : '(Available)'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSwapDialogOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!swapTargetWsId || isPending}
                  onClick={handleExecuteSwap}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Confirm Swap</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. AUTO-ASSIGN CONFIRMATION MODAL */}
      {isAutoAssignDialogOpen && planData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#101726] p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Wand2 className="h-4 w-4" />
              </span>
              <h4 className="font-heading font-extrabold text-base text-white">
                Auto Assign Remaining Students
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              This will automatically match remaining unassigned students to available workstations in ascending roll number order.
            </p>

            <div className="rounded-xl border border-white/[0.06] bg-[#151E32]/60 p-3 space-y-2 text-xs mb-4">
              <div className="flex justify-between text-slate-300">
                <span>Unassigned Students:</span>
                <span className="font-mono font-bold text-amber-400">{planData.unassigned_count}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Existing Manual Seats:</span>
                <span className="font-bold text-emerald-400">Preserved (Untouched)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Severe Faulty PCs:</span>
                <span className="font-bold text-rose-400">Excluded</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAutoAssignDialogOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAutoAssigning}
                onClick={handleAutoAssign}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50"
              >
                {isAutoAssigning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Allocating...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>Confirm Auto Assign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Excel Import Modal */}
      {isPrivileged && (
        <RosterImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          academicYearId={selectedYearId}
          academicYearName={academicYears.find((y) => y.id === selectedYearId)?.name || `${selectedYearId} B.S.`}
          classId={selectedClassId}
          className={classes.find((c) => c.id === selectedClassId)?.name || selectedClassId}
          onSuccess={fetchSeatPlan}
        />
      )}
    </div>
  )
}
