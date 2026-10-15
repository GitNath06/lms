'use client'

import React, { useState, useMemo } from 'react'
import {
  Users,
  Search,
  Wand2,
  CheckCircle2,
  GripVertical,
  UserCheck,
  Loader2,
  Sparkles,
} from 'lucide-react'
import type { StudentWithEnrollment } from '@/lib/types/students'

interface StudentTrayProps {
  unassignedStudents: StudentWithEnrollment[]
  selectedStudent: StudentWithEnrollment | null
  onSelectStudent: (student: StudentWithEnrollment | null) => void
  onAutoAssign: () => void
  isAutoAssigning?: boolean
  isPrivileged?: boolean
  className?: string
}

export function StudentTray({
  unassignedStudents,
  selectedStudent,
  onSelectStudent,
  onAutoAssign,
  isAutoAssigning = false,
  isPrivileged = false,
  className = '',
}: StudentTrayProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter students by roll number or name
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return unassignedStudents
    const q = searchQuery.toLowerCase().trim()
    return unassignedStudents.filter((s) => {
      const matchRoll = String(s.roll_number).includes(q)
      const matchName = s.full_name.toLowerCase().includes(q)
      const matchAdm = s.admission_no?.toLowerCase().includes(q)
      return matchRoll || matchName || matchAdm
    })
  }, [unassignedStudents, searchQuery])

  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#101726] shadow-xl overflow-hidden ${className}`}
    >
      {/* Header Dock */}
      <div className="p-3.5 border-b border-white/[0.08] bg-[#151E32]/60">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-heading font-extrabold text-xs sm:text-sm text-white">
                Unassigned Students
              </h3>
              <span className="text-[10px] text-slate-400">
                {unassignedStudents.length} awaiting seat placement
              </span>
            </div>
          </div>

          <span
            className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-full ${
              unassignedStudents.length > 0
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            {unassignedStudents.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roll or student name..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#0B0F19] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Student List Bay */}
      <div className="flex-1 overflow-y-auto max-h-[380px] sm:max-h-[440px] p-2 space-y-1.5 divide-y divide-white/[0.04]">
        {unassignedStudents.length === 0 ? (
          // Meaningful Empty State: All students assigned
          <div className="py-8 px-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-2.5">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="text-xs font-bold text-white">Full Cohort Seated</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              All enrolled students for this class have an assigned workstation.
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          // No match for search query
          <div className="py-6 px-4 text-center text-xs text-slate-400">
            No unassigned students match &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isSelected = selectedStudent?.enrollment_id === student.enrollment_id

            return (
              <div
                key={student.enrollment_id}
                draggable={isPrivileged}
                onDragStart={
                  isPrivileged
                    ? (e) => {
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            type: 'student',
                            enrollment_id: student.enrollment_id,
                            student_name: student.full_name,
                            roll_number: student.roll_number,
                          })
                        )
                      }
                    : undefined
                }
                onClick={isPrivileged ? () => onSelectStudent(isSelected ? null : student) : undefined}
                className={`group flex items-center justify-between gap-2 p-2 rounded-xl border transition-all select-none ${
                  isPrivileged ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50 shadow-sm'
                    : 'border-white/[0.04] bg-[#151E32]/40 hover:bg-[#151E32] hover:border-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isPrivileged && (
                    <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <span className="font-mono text-xs font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-md tabular-nums shrink-0">
                    Roll {student.roll_number}
                  </span>

                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {student.full_name}
                  </span>
                </div>

                {isPrivileged && (
                  <div className="shrink-0 text-[10px] text-slate-400">
                    {isSelected ? (
                      <span className="font-bold text-indigo-400">Tap PC</span>
                    ) : (
                      <span className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        Assign
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Action Footer: Auto-Assign Remaining (Privileged Only) */}
      {unassignedStudents.length > 0 && isPrivileged && (
        <div className="p-3 border-t border-white/[0.08] bg-[#151E32]/80">
          <button
            type="button"
            disabled={isAutoAssigning}
            onClick={onAutoAssign}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            {isAutoAssigning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Auto-Assigning...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                <span>Auto Assign Remaining ({unassignedStudents.length})</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-1.5 leading-tight">
            Preserves manual seats. Skips decommissioned &amp; critical hardware faults.
          </p>
        </div>
      )}

      {unassignedStudents.length > 0 && !isPrivileged && (
        <div className="p-3 border-t border-white/[0.08] bg-[#151E32]/40 text-center">
          <p className="text-[11px] text-slate-400">
            Read-only session view. Unassigned students are managed by Super Admin or Lab In-Charge.
          </p>
        </div>
      )}
    </div>
  )
}
