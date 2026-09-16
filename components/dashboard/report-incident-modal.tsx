'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  X,
  Plus,
  Building2,
  Send,
  ShieldAlert,
  Clock,
  UserCheck,
} from 'lucide-react'
import { useIncidentState } from '@/hooks/use-incident-state'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { getNepalDateStr } from '@/lib/nepali-date'
import { MASTER_TIME_SLOTS } from '@/lib/master-data'
import { useUserScope } from '@/hooks/use-user-scope'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { IncidentPhotoUploader, UploadedPhoto } from '@/components/incidents/incident-photo-uploader'

interface ReportIncidentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (msg: string) => void
  defaultLabId?: string
}

export default function ReportIncidentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultLabId = 'chem',
}: ReportIncidentModalProps) {
  const { logIncident } = useIncidentState()
  const { faculty, classes, incidentCategories } = useInfrastructureState()
  const { scope, isTeacher } = useUserScope()

  // Primary focus on Physics, Chemistry, and Computer labs
  const TARGET_LABS = [
    { id: 'phys', name: 'Physics Laboratory' },
    { id: 'chem', name: 'Chemistry Laboratory' },
    { id: 'comp', name: 'Computer Laboratory' },
    { id: 'elec', name: 'Electronics & Hardware Lab' },
    { id: 'bio', name: 'Biology & Life Sciences Lab' },
  ]

  const availableClasses =
    isTeacher && scope?.assignedClasses && scope.assignedClasses.length > 0
      ? classes.filter((c) => scope.assignedClasses.includes(c.name))
      : classes

  const [labId, setLabId] = useState<string>(defaultLabId)
  const [periodSlot, setPeriodSlot] = useState<string>('Period 2 (11:00 - 11:45)')
  const [batchName, setBatchName] = useState<string>(availableClasses[0]?.name || 'Class 12C')
  const [teacherName, setTeacherName] = useState<string>(
    isTeacher && scope?.fullName ? scope.fullName : faculty[0]?.name || 'Dr. Prakash Adhikari'
  )
  const [incidentType, setIncidentType] = useState<string>(incidentCategories[0]?.code || 'breakage')
  const [severity, setSeverity] = useState<any>('minor')
  const [equipmentName, setEquipmentName] = useState<string>('')
  const [incidentTitle, setIncidentTitle] = useState<string>('')
  const [circumstances, setCircumstances] = useState<string>('')
  const [studentRolls, setStudentRolls] = useState<string>('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Reactively sync teacherName when scope loads
  React.useEffect(() => {
    if (isTeacher && scope?.fullName) {
      setTeacherName(scope.fullName)
    }
  }, [isTeacher, scope?.fullName])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incidentTitle.trim() && !circumstances.trim()) return

    setIsSubmitting(true)
    try {
      const displayTitle =
        incidentTitle.trim() ||
        `${incidentType.replace('_', ' ').toUpperCase()} in ${labId.toUpperCase()} Lab (${periodSlot})`

      await logIncident({
        lab_id: labId,
        date: getNepalDateStr(),
        session_label: periodSlot,
        subject_name: `${labId.toUpperCase()} Practical Session`,
        subject_teacher_name: teacherName,
        batch_name: batchName,
        title: displayTitle,
        circumstances: circumstances.trim() || undefined,
        incident_type: incidentType as any,
        severity: severity,
        equipment_name: equipmentName.trim() || 'Lab Equipment / Workstation',
        quantity: 1,
        student_rolls: studentRolls.trim() || undefined,
        resolution_notes: undefined,
        reported_by: teacherName,
        reported_by_id: scope?.userId || undefined,
      })

      if (onSuccess) {
        onSuccess(
          severity === 'major_critical'
            ? 'Major damage reported. High-priority alert routed to HOD and Admin.'
            : 'Incident reported. Notified Lab In-Charge and Admin.'
        )
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-2xl sm:max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[88vh] my-auto">
        {/* Header */}
        <div className="p-4 px-6 border-b border-zinc-100 dark:border-zinc-800 bg-rose-50/60 dark:bg-rose-950/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-xs shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-bold text-zinc-950 dark:text-white tracking-tight">
                Report Laboratory Incident & Equipment Damage
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
                Official incident register entry for Physics, Chemistry, Biology & Computer Labs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Container with Flex and Min-H-0 for Safari-Safe Docking */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4.5 text-sm font-sans flex-1 min-h-0">
            {/* Target Facility Lab & Period Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Target Laboratory <span className="text-rose-500 font-bold">*</span>
                </label>
                <Select value={labId} onChange={(e) => setLabId(e.target.value)}>
                  {TARGET_LABS.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Period / Time Slot <span className="text-rose-500 font-bold">*</span>
                </label>
                <Select value={periodSlot} onChange={(e) => setPeriodSlot(e.target.value)}>
                  {MASTER_TIME_SLOTS.map((s) => (
                    <option key={s.id} value={`${s.name} (${s.label})`}>
                      {s.name} ({s.label})
                    </option>
                  ))}
                  <option value="Preparation / Non-Session Hours">
                    Preparation / Non-Session Hours
                  </option>
                </Select>
              </div>
            </div>

            {/* Incident Category & Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Incident Category <span className="text-rose-500 font-bold">*</span>
                </label>
                <Select
                  value={incidentType}
                  onChange={(e) => {
                    const val = e.target.value
                    setIncidentType(val)
                    const found = incidentCategories.find((c) => c.code === val)
                    if (found) setSeverity(found.severity)
                  }}
                >
                  {incidentCategories.map((cat) => (
                    <option key={cat.id} value={cat.code}>
                      {cat.name.replace(/Apparatus/g, 'Equipment')}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Severity Level <span className="text-rose-500 font-bold">*</span>
                </label>
                <Select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                  <option value="minor">Minor (Low Impact / Internal Fix)</option>
                  <option value="moderate">Moderate (Store Replacement Needed)</option>
                  <option value="major_critical">Major / Critical (Direct HOD Attention)</option>
                </Select>
              </div>
            </div>

            {/* Summary Title & Equipment Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Equipment / Item Affected <span className="text-rose-500 font-bold">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. PC-04 Monitor, Digital Multimeter, Burette 50ml"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  className="bg-white dark:bg-zinc-950 text-sm font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Incident Summary Headline <span className="text-rose-500 font-bold">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Screen blackout or glass crack during experiment"
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  className="bg-white dark:bg-zinc-950 text-sm font-sans"
                />
              </div>
            </div>

            {/* What Happened (Detailed Circumstances & Equipment Details) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                What Happened & Details <span className="text-rose-500 font-bold">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={circumstances}
                onChange={(e) => setCircumstances(e.target.value)}
                placeholder="Describe exactly what happened: which equipment or station was affected, cause of damage, safety steps taken, workshop or store replacement needed..."
                className="flex w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 font-sans leading-relaxed placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
              />
            </div>

            {/* Evidence Photos Attachment (Track 2) */}
            <IncidentPhotoUploader
              photos={photos}
              onChange={setPhotos}
              disabled={isSubmitting}
            />

            {/* Class Batch, Faculty & Involved Student Rolls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Class / Batch <span className="text-rose-500 font-bold">*</span>
                </label>
                <Select
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="bg-white dark:bg-zinc-950 font-sans"
                >
                  {availableClasses.length > 0 ? (
                    availableClasses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.stream || c.section})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Class 12C">Class 12C (Science)</option>
                      <option value="Class 12B">Class 12B (Science)</option>
                      <option value="Class 11A">Class 11A (General)</option>
                      <option value="Class 11SC">Class 11SC (Science)</option>
                    </>
                  )}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Supervising Teacher
                </label>
                {isTeacher ? (
                  <div className="h-10 px-3.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-sans font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span className="truncate">{teacherName}</span>
                    <Badge className="text-[10px] font-sans font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 shrink-0">
                      Self
                    </Badge>
                  </div>
                ) : (
                  <Select value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="font-sans">
                    {faculty.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans">
                  Student Roll(s)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Roll 14, 28"
                  value={studentRolls}
                  onChange={(e) => setStudentRolls(e.target.value)}
                  className="bg-white dark:bg-zinc-950 text-sm font-sans"
                />
              </div>
            </div>
          </div>

          {/* Sticky Docked Footer Actions */}
          <div className="p-3.5 px-6 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-sm shrink-0 flex items-center justify-between gap-3 font-sans">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-xl text-sm font-semibold font-sans"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-10 px-5 rounded-xl text-sm font-bold font-sans bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-xs"
            >
              {isSubmitting ? (
                'Filing Report...'
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <span>File Incident Report</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
