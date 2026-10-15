import React from 'react'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { getWorkstationBoardData } from '@/app/actions/workstations'
import { getPgPool } from '@/lib/db'
import { ComputerLabWorkspace } from '@/components/computer-lab/computer-lab-workspace'
import { sortSessionsChronologically } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Floor Plan & Cockpit | LabSync LIMS',
  description:
    'Interactive CAD Floor Plan, Live Practical Session Cockpit, In-Seat Roll-Call, and Hardware Diagnostics',
}

export default async function ComputerLabPage() {
  const supabase = await createClient()
  const scope = await getServerUserScope()

  // 1. Fetch initial workstation board telemetry
  const initialBoardData = await getWorkstationBoardData('comp')

  // 2. Fetch lab facility status from public.labs with resilient fallback
  let initialLabFacility = {
    id: 'comp',
    name: 'Computer Lab 01',
    code: 'COM-LAB',
    capacity: 40,
    type: 'computer_lab',
    status: 'Operational',
    is_active: true,
  }

  try {
    const pool = getPgPool()
    const labRes = await pool.query(
      'SELECT id, name, code, capacity, type, status, is_active FROM public.labs WHERE id = $1 LIMIT 1',
      ['comp']
    )
    if (labRes.rows[0]) {
      initialLabFacility = labRes.rows[0]
    }
  } catch (poolErr) {
    console.warn('PG pool query timed out or disconnected, falling back to Supabase client:', poolErr)
    try {
      const { data: labData } = await supabase
        .from('labs')
        .select('id, name, code, capacity, type, status, is_active')
        .eq('id', 'comp')
        .single()
      if (labData && typeof labData === 'object' && 'id' in labData) {
        initialLabFacility = labData as any
      }
    } catch (supabaseErr) {
      console.warn('Both PG pool and Supabase failed, using default operational facility:', supabaseErr)
    }
  }

  // 2. Fetch scheduled practical sessions for Computer Lab (comp)
  const { data: schedRows } = await (supabase
    .from('schedules') as any)
    .select(`
      id, lab_id, teacher_id, start_time, end_time, day_key, class_subject_id,
      class_subjects:class_subject_id (
        id, class_id, subject_id, teacher_id,
        classes:class_id ( id, name, grade, section ),
        subjects:subject_id ( id, code, name ),
        profiles:teacher_id ( id, full_name )
      )
    `)
    .eq('lab_id', 'comp')
    .order('start_time', { ascending: true })

  const rawScheduledSessions: Array<{
    id: string
    startTime: string
    endTime: string
    dayKey: string
    subjectName: string
    batchName: string
    teacherName: string
    classSubjectId: string
  }> = (schedRows || [])
    .filter((s: any) => s.class_subjects)
    .map((s: any) => {
      const cs = s.class_subjects
      return {
        id: s.id,
        startTime: s.start_time,
        endTime: s.end_time,
        dayKey: s.day_key,
        subjectName: cs.subjects?.name || s.subject_name || 'Computer Science',
        batchName: cs.classes?.name || s.batch_name || 'Class 12 Eng',
        teacherName: cs.profiles?.full_name || 'Assigned Faculty',
        classSubjectId: cs.id,
      }
    })

  const scheduledSessions = sortSessionsChronologically(rawScheduledSessions)

  // 3. Fetch canonical classes and class_subjects for ad-hoc / baseline selectors
  const { data: classesData } = await (supabase
    .from('classes') as any)
    .select('id, name, grade, section')
    .order('grade', { ascending: true })

  const authorizedClasses = (classesData || [])
    .filter((c: any) => {
      if (scope.isPrivileged) return true
      return scope.assignedClasses.includes(c.name) || scope.assignedClasses.includes(c.id)
    })
    .map((c: any) => ({
      id: c.id,
      name: c.name,
    }))

  const { data: csRows } = await (supabase
    .from('class_subjects') as any)
    .select(`
      id, class_id, subject_id, teacher_id,
      classes:class_id ( id, name ),
      subjects:subject_id ( id, code, name )
    `)

  const classSubjects = (csRows || [])
    .filter((cs: any) => {
      if (scope.isPrivileged) return true
      if (cs.teacher_id === scope.userId) return true
      return scope.assignedClasses.includes(cs.classes?.name || cs.class_id)
    })
    .map((cs: any) => ({
      id: cs.id,
      classId: cs.class_id,
      subjectId: cs.subject_id,
      className: cs.classes?.name || cs.class_id,
      subjectName: cs.subjects?.name || cs.subject_id,
      subjectCode: cs.subjects?.code || cs.subject_id,
    }))

  const authorizedSubjects = classSubjects.map((cs: any) => ({
    id: cs.subjectId,
    code: cs.subjectCode,
    name: cs.subjectName,
    classId: cs.classId,
    className: cs.className,
  }))

  return (
    <div className="w-full">
      <ComputerLabWorkspace
        initialBoardData={initialBoardData}
        initialLabFacility={initialLabFacility}
        scheduledSessions={scheduledSessions}
        authorizedClasses={authorizedClasses}
        authorizedSubjects={authorizedSubjects}
        classSubjects={classSubjects}
        isPrivileged={scope.isPrivileged}
        isTeacher={scope.isTeacher}
      />
    </div>
  )
}
