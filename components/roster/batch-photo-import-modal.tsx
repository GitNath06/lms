'use client'

import React, { useState, useRef } from 'react'
import {
  Camera,
  Upload,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import {
  matchPhotosToStudents,
  type MatchedStudentPhoto,
  type StudentPhotoCandidate,
} from '@/lib/student-photos/matcher'
import { compressStudentAvatar } from '@/lib/student-photos/compressor'
import { batchUpdateStudentPhotosAction } from '@/app/actions/students'

interface BatchPhotoImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  classNameLabel: string
  academicYearLabel: string
  students: StudentPhotoCandidate[]
}

export function BatchPhotoImportModal({
  isOpen,
  onClose,
  onSuccess,
  classNameLabel,
  academicYearLabel,
  students,
}: BatchPhotoImportModalProps) {
  const [matchedPhotos, setMatchedPhotos] = useState<MatchedStudentPhoto[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // Handle file selection (multi-file or folder)
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)

    const validImageFiles: File[] = []
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg']

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (allowedTypes.includes(file.type) || file.name.match(/\.(jpe?g|png|webp|avif)$/i)) {
        validImageFiles.push(file)
      }
    }

    if (validImageFiles.length === 0) {
      setError('No valid image files found (.jpg, .jpeg, .png, .webp).')
      return
    }

    const matches = matchPhotosToStudents(validImageFiles, students)
    setMatchedPhotos(matches)
  }

  // Allow manual student override for any photo row
  const handleAssignStudent = (index: number, studentId: string) => {
    setMatchedPhotos((prev) => {
      const updated = [...prev]
      const target = updated[index]
      if (!target) return prev

      if (!studentId) {
        updated[index] = {
          ...target,
          matchedStudentId: null,
          matchedStudentName: null,
          matchedRollNumber: null,
          confidence: 'unmatched',
          matchReason: 'Unassigned manual photo',
        }
      } else {
        const student = students.find((s) => s.student_id === studentId)
        if (student) {
          updated[index] = {
            ...target,
            matchedStudentId: student.student_id,
            matchedStudentName: student.full_name,
            matchedRollNumber: student.roll_number,
            confidence: 'high',
            matchReason: `Manual Assignment (Roll ${student.roll_number})`,
          }
        }
      }
      return updated
    })
  }

  // Remove a photo from the staged list
  const handleRemovePhoto = (index: number) => {
    setMatchedPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // Commit photos: Compress on client and batch update in database
  const handleCommitPhotos = async () => {
    const validMatches = matchedPhotos.filter((p) => p.matchedStudentId)
    if (validMatches.length === 0) {
      setError('Please assign at least one photo to a student before saving.')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const updates: Array<{ studentId: string; photoUrl: string }> = []

      for (let i = 0; i < validMatches.length; i++) {
        const item = validMatches[i]
        setProcessingStatus(`Optimizing photo ${i + 1} of ${validMatches.length}...`)

        // Compress and crop square to 256x256 (~15-20 KB)
        const compressed = await compressStudentAvatar(item.file, 256, 0.75)
        updates.push({
          studentId: item.matchedStudentId!,
          photoUrl: compressed.dataUrl,
        })
      }

      setProcessingStatus(`Saving ${updates.length} student photos to institutional roster...`)
      const res = await batchUpdateStudentPhotosAction({ updates })

      if (!res.success) {
        setError(res.error || 'Failed to update student photos.')
        setIsProcessing(false)
        return
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown photo optimization error'
      setError(msg)
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const highCount = matchedPhotos.filter((p) => p.confidence === 'high' && p.matchedStudentId).length
  const mediumCount = matchedPhotos.filter((p) => p.confidence === 'medium' && p.matchedStudentId).length
  const unmatchedCount = matchedPhotos.filter((p) => !p.matchedStudentId).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0E1526] shadow-2xl overflow-hidden font-sans">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4.5 bg-[#121A2F]/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white font-heading tracking-tight flex items-center gap-2">
                <span>Batch Student Photo Ingestion</span>
                <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                  {classNameLabel}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Academic Cycle: <span className="text-slate-200 font-semibold">{academicYearLabel}</span> • Supported naming: <code className="text-indigo-300 font-mono text-[11px]">8_kaustuv_thapa.jpg</code>, <code className="text-indigo-300 font-mono text-[11px]">14.jpg</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3.5 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: DROPZONE / FILE SELECTION */}
          {matchedPhotos.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 bg-[#151E32]/40 hover:bg-[#151E32]/70 p-10 text-center transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 group-hover:scale-105 transition-transform mb-4 shadow-inner">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-white font-heading">
                Drag & Drop Student Photos or Browse Files
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-400">
                Select multiple student portrait images (.jpg, .jpeg, .png, .webp). The system automatically parses roll numbers and names for instant 2-factor matching.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
                <span className="rounded-lg bg-black/40 px-2.5 py-1 border border-white/[0.06]">
                  ✓ 8_kaustuv_thapa.jpg
                </span>
                <span className="rounded-lg bg-black/40 px-2.5 py-1 border border-white/[0.06]">
                  ✓ 08-kaustuv-thapa.png
                </span>
                <span className="rounded-lg bg-black/40 px-2.5 py-1 border border-white/[0.06]">
                  ✓ 14.jpg
                </span>
                <span className="rounded-lg bg-black/40 px-2.5 py-1 border border-white/[0.06]">
                  ✓ ADM-042.jpg
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* RECONCILIATION SUMMARY KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-white/[0.06] bg-[#151E32] p-3 text-center">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Total Photos
                  </span>
                  <span className="text-xl font-extrabold text-white font-heading tabular-nums">
                    {matchedPhotos.length}
                  </span>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-center">
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                    Auto-Matched
                  </span>
                  <span className="text-xl font-extrabold text-emerald-300 font-heading tabular-nums">
                    {highCount}
                  </span>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-center">
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">
                    Review Needed
                  </span>
                  <span className="text-xl font-extrabold text-amber-300 font-heading tabular-nums">
                    {mediumCount}
                  </span>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-center">
                  <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider block">
                    Unmatched
                  </span>
                  <span className="text-xl font-extrabold text-rose-300 font-heading tabular-nums">
                    {unmatchedCount}
                  </span>
                </div>
              </div>

              {/* ACTION BAR ABOVE TABLE */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Review student allocations or manually assign unmatched images:</span>
                <button
                  type="button"
                  onClick={() => {
                    setMatchedPhotos([])
                    setError(null)
                  }}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Choose Different Files</span>
                </button>
              </div>

              {/* RECONCILIATION PREVIEW TABLE */}
              <div className="rounded-xl border border-white/[0.08] bg-[#121A2F] overflow-hidden max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#151E32] text-slate-400 uppercase text-[10px] font-semibold sticky top-0 z-10 border-b border-white/[0.08]">
                    <tr>
                      <th className="py-2.5 px-3">Photo Preview</th>
                      <th className="py-2.5 px-3">Uploaded File</th>
                      <th className="py-2.5 px-3">Assigned Student</th>
                      <th className="py-2.5 px-3">Match Confidence</th>
                      <th className="py-2.5 px-2 text-center w-10">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {matchedPhotos.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        {/* PHOTO THUMBNAIL */}
                        <td className="py-2.5 px-3">
                          <div className="h-10 w-10 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center">
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.filename}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                        </td>

                        {/* FILENAME & EXTRACTED PARAMS */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-200 font-semibold block truncate max-w-[180px]">
                            {item.filename}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.extractedRoll ? `Roll ${item.extractedRoll}` : 'No roll parsed'}
                            {item.extractedName ? ` • "${item.extractedName}"` : ''}
                          </span>
                        </td>

                        {/* STUDENT SELECTOR DROPDOWN */}
                        <td className="py-2.5 px-3">
                          <select
                            value={item.matchedStudentId || ''}
                            onChange={(e) => handleAssignStudent(idx, e.target.value)}
                            className={`w-full rounded-lg border px-2.5 py-1.5 text-xs font-sans transition-colors ${
                              item.matchedStudentId
                                ? 'border-white/[0.12] bg-[#151E32] text-white focus:border-indigo-500'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                            }`}
                          >
                            <option value="">— Select Student —</option>
                            {students.map((s) => (
                              <option key={s.student_id} value={s.student_id}>
                                Roll {s.roll_number}: {s.full_name} {s.admission_no ? `(${s.admission_no})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* CONFIDENCE PILL & REASON */}
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5">
                            {item.confidence === 'high' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                <Check className="h-3 w-3" />
                                <span>High Match</span>
                              </span>
                            )}
                            {item.confidence === 'medium' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Review</span>
                              </span>
                            )}
                            {item.confidence === 'unmatched' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                <HelpCircle className="h-3 w-3" />
                                <span>Unassigned</span>
                              </span>
                            )}
                            <span className="block text-[10px] text-slate-400 truncate max-w-[200px]" title={item.matchReason}>
                              {item.matchReason}
                            </span>
                          </div>
                        </td>

                        {/* REMOVE BUTTON */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove photo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between border-t border-white/[0.08] px-6 py-4 bg-[#121A2F]/80">
          <div className="text-xs text-slate-400">
            {isProcessing && (
              <span className="flex items-center gap-2 text-indigo-300 font-semibold animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{processingStatus}</span>
              </span>
            )}
            {!isProcessing && matchedPhotos.length > 0 && (
              <span>
                Ready to commit <strong className="text-white">{matchedPhotos.filter((p) => p.matchedStudentId).length}</strong> photos to {classNameLabel}.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {matchedPhotos.length > 0 && (
              <button
                type="button"
                disabled={isProcessing || matchedPhotos.filter((p) => p.matchedStudentId).length === 0}
                onClick={handleCommitPhotos}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Photos...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Apply & Save Photos</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
