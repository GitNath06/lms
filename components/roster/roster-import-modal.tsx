'use client'

import React, { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
  Loader2,
  ArrowLeft,
  Search,
  UserPlus,
  UserCheck,
  UserMinus,
  Cpu,
  Phone,
  Sparkles,
} from 'lucide-react'
import {
  validateRosterFileAction,
  commitRosterIngestionAction,
  getBlankRosterTemplateAction,
} from '@/app/actions/roster-ingestion'
import type {
  RosterPreflightReport,
  RosterCommitResult,
  ValidationRowPreview,
  IngestionPayloadRow,
  UnmatchedExistingStudent,
} from '@/lib/roster-ingestion/types'

interface RosterImportModalProps {
  isOpen: boolean
  onClose: () => void
  academicYearId: string
  academicYearName: string
  classId: string
  className: string
  onSuccess?: () => void
}

export function RosterImportModal({
  isOpen,
  onClose,
  academicYearId,
  academicYearName,
  classId,
  className,
  onSuccess,
}: RosterImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [validationReport, setValidationReport] = useState<RosterPreflightReport | null>(null)
  const [commitResult, setCommitResult] = useState<RosterCommitResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reconciliation settings
  const [keepMissingEnrolled, setKeepMissingEnrolled] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'existing' | 'missing'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // Handle template download
  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true)
    try {
      const res = await getBlankRosterTemplateAction({
        academicYearId,
        classId,
      })
      if (res.success && res.dataBase64) {
        const link = document.createElement('a')
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.dataBase64}`
        link.download = res.fileName || 'Class_Roster_Template.xlsx'
        link.click()
      } else {
        setErrorMessage(res.error || 'Failed to download template.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error downloading template.'
      setErrorMessage(msg)
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  // Handle file validation upload
  const processUploadedFile = async (file: File) => {
    setSelectedFile(file)
    setErrorMessage(null)
    setIsValidating(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('academicYearId', academicYearId)
      formData.append('classId', classId)
      formData.append('mode', 'sync')

      const res = await validateRosterFileAction(formData)
      if (res.success && res.report) {
        setValidationReport(res.report)
        setStep('preview')
      } else {
        setErrorMessage(res.error || 'Validation failed. Please verify spreadsheet contents.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected file validation error.'
      setErrorMessage(msg)
    } finally {
      setIsValidating(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processUploadedFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadedFile(file)
  }

  // Handle commit ingestion
  const handleCommit = async () => {
    if (!validationReport) return

    setIsCommitting(true)
    setErrorMessage(null)

    try {
      const payloadRows: IngestionPayloadRow[] = validationReport.rows.map((r) => ({
        roll_number: r.roll_number || 0,
        full_name: r.full_name,
        admission_no: r.admission_no || null,
        registration_no: r.registration_no || null,
        gender: r.gender || null,
        contact: r.contact || null,
        student_id: r.matched_student_id || null,
        action: 'sync',
      }))

      const res = await commitRosterIngestionAction({
        academicYearId,
        classId,
        rows: payloadRows,
        mode: 'sync',
      })

      if (res.success && res.result) {
        setCommitResult(res.result)
        setStep('result')
        onSuccess?.()
      } else {
        setErrorMessage(res.error || 'Failed to commit roster to database.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error during commit.'
      setErrorMessage(msg)
    } finally {
      setIsCommitting(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setSelectedFile(null)
    setValidationReport(null)
    setCommitResult(null)
    setErrorMessage(null)
    setSearchQuery('')
    setActiveFilter('all')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Filter rows based on search and active tab
  const rows = validationReport?.rows || []
  const missingStudents: UnmatchedExistingStudent[] =
    validationReport?.buckets.bucket4_unmatched_existing || []

  const newStudents = rows.filter((r) => r.status === 'valid_new')
  const existingStudents = rows.filter(
    (r) => r.status === 'valid_existing' || r.status === 'valid_retained' || r.status === 'valid_roll_update'
  )

  const filteredRows = rows.filter((r) => {
    if (activeFilter === 'new' && r.status !== 'valid_new') return false
    if (
      activeFilter === 'existing' &&
      r.status !== 'valid_existing' &&
      r.status !== 'valid_retained' &&
      r.status !== 'valid_roll_update'
    )
      return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = r.full_name.toLowerCase().includes(q)
      const matchAdm = (r.admission_no || '').toLowerCase().includes(q)
      const matchRoll = String(r.roll_number || '').includes(q)
      return matchName || matchAdm || matchRoll
    }
    return true
  })

  const filteredMissing = missingStudents.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.admission_no || '').toLowerCase().includes(q) ||
        String(m.roll_number).includes(q)
      )
    }
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#101726] shadow-2xl overflow-hidden font-sans text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#151E32]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
                <span>Import Class Roster</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Universal Ingestion
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Target: <span className="text-indigo-400 font-semibold">{className}</span> · Academic Year {academicYearName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-10 rounded-2xl border-2 border-dashed transition cursor-pointer ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-white/[0.12] bg-[#151E32]/40 hover:border-indigo-500/50 hover:bg-[#151E32]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                {isValidating ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                    <p className="text-sm font-semibold text-white">Analyzing spreadsheet...</p>
                    <p className="text-xs text-slate-400">Verifying student records, RFID card numbers, and cohort status</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        Click to select or drag and drop spreadsheet
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports Microsoft Excel (<span className="text-slate-300">.xlsx, .xls</span>) or CSV (<span className="text-slate-300">.csv</span>)
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-slate-400 mt-1">
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      <span>Supports your school&apos;s format: <strong>Roll, Name, RFID No., Gender, Contact</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Guidance & Template Downloader */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.06] bg-[#151E32]/60">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    Need an institutional template pre-configured for <strong>{className}</strong>?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] transition disabled:opacity-50 cursor-pointer"
                >
                  {isDownloadingTemplate ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Download Clean Template</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: RECONCILIATION PREVIEW */}
          {step === 'preview' && validationReport && (
            <div className="space-y-5">
              
              {/* Top 3 Executive Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Card 1: New Admissions */}
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>New Admissions</span>
                    </div>
                    <div className="text-2xl font-extrabold font-heading text-white tabular-nums mt-1">
                      {newStudents.length}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                    To be added
                  </span>
                </div>

                {/* Card 2: Recognized Existing */}
                <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Recognized Profiles</span>
                    </div>
                    <div className="text-2xl font-extrabold font-heading text-white tabular-nums mt-1">
                      {existingStudents.length}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
                    Matched / Retained
                  </span>
                </div>

                {/* Card 3: Not in Sheet */}
                <div className="p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/20 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <UserMinus className="h-3.5 w-3.5" />
                      <span>Not in Upload</span>
                    </div>
                    <div className="text-2xl font-extrabold font-heading text-white tabular-nums mt-1">
                      {missingStudents.length}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                    Currently enrolled
                  </span>
                </div>
              </div>

              {/* Missing Students Policy Option (if missing > 0) */}
              {missingStudents.length > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>{missingStudents.length} students currently enrolled in {className} are absent from this spreadsheet</span>
                  </div>
                  <div className="flex items-center gap-3 pl-6">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepMissingEnrolled}
                        onChange={(e) => setKeepMissingEnrolled(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                      />
                      <span>Keep them enrolled safely (Merge incoming newcomers alongside them — Recommended)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Toolbar: Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Students ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('new')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeFilter === 'new' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    New Admissions ({newStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('existing')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeFilter === 'existing' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Recognized ({existingStudents.length})
                  </button>
                  {missingStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('missing')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        activeFilter === 'missing' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Not in File ({missingStudents.length})
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or RFID..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Roster Table */}
              <div className="rounded-xl border border-white/[0.08] bg-[#151E32]/40 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="sticky top-0 bg-[#151E32] border-b border-white/[0.08] text-[11px] font-bold uppercase tracking-wider text-slate-400 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">RFID / Institutional ID</th>
                        <th className="py-2.5 px-3 w-28 text-center">Roll Hint</th>
                        <th className="py-2.5 px-3 w-24">Gender</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {activeFilter === 'missing' ? (
                        filteredMissing.map((m, idx) => (
                          <tr key={m.id} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{m.full_name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{m.admission_no || '—'}</td>
                            <td className="py-2.5 px-3 text-center tabular-nums text-slate-300">Roll #{m.roll_number}</td>
                            <td className="py-2.5 px-3 text-slate-500">—</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Not in spreadsheet
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        filteredRows.map((r, idx) => {
                          const isNew = r.status === 'valid_new'
                          return (
                            <tr key={r.row_index} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-semibold text-white">
                                <div className="flex items-center gap-1.5">
                                  <span>{r.full_name}</span>
                                  {r.contact && (
                                    <span title={r.contact} className="text-slate-500">
                                      <Phone className="h-3 w-3" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {r.admission_no ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] font-mono text-[11px] text-slate-300">
                                    <Cpu className="h-3 w-3 text-indigo-400" />
                                    <span>{r.admission_no}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">Auto-Assigned</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center tabular-nums font-semibold text-slate-300">
                                {r.roll_number ? `Roll #${r.roll_number}` : 'Auto'}
                              </td>
                              <td className="py-2.5 px-3 capitalize text-slate-400">
                                {r.gender || '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                {isNew ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                    New Student
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                    Matched Profile
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT & FINALIZATION PROMPT */}
          {step === 'result' && commitResult && (
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-white">
                  Class Roster Successfully Updated
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Ingested {commitResult.processed_rows} student records into <strong>{className}</strong> for academic year {academicYearName}.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg mt-2">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <div className="text-xs text-slate-400">New Students</div>
                  <div className="text-xl font-extrabold font-heading text-emerald-400 tabular-nums mt-0.5">
                    {commitResult.students_created}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <div className="text-xs text-slate-400">Matched Existing</div>
                  <div className="text-xl font-extrabold font-heading text-indigo-400 tabular-nums mt-0.5">
                    {commitResult.students_matched}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-400">Total Enrolled</div>
                  <div className="text-xl font-extrabold font-heading text-white tabular-nums mt-0.5">
                    {commitResult.enrollments_created + commitResult.enrollments_retained}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                  }}
                  className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>View Class Roster</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        {step !== 'result' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#151E32]">
            {step === 'preview' ? (
              <button
                type="button"
                onClick={handleReset}
                disabled={isCommitting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Upload Different File</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isCommitting || isValidating}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>

              {step === 'preview' && (
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={isCommitting || !validationReport?.can_commit}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isCommitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Commit & Ingest {validationReport?.valid_count} Students</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
