import React from 'react'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getWorkstationBoardData } from '@/app/actions/workstations'
import { getLabFloorElements } from '@/app/actions/floor-elements'
import { getLiveSessionContext } from '@/app/actions/live-session'
import { ProjectorView } from '@/components/computer-lab/projector-view'

export const metadata: Metadata = {
  title: 'Wall Seating Projection Screen | LabSync LIMS',
  description: 'Full-screen high-contrast laboratory workstation seating chart optimized for big-screen wall projectors',
}

interface ProjectorPageProps {
  searchParams: Promise<{
    schedule_id?: string
    lab_id?: string
  }>
}

export default async function ProjectorPage({ searchParams }: ProjectorPageProps) {
  const params = await searchParams
  const labId = params.lab_id || 'comp'
  const supabase = await createClient()

  // 1. Fetch initial board data & landmarks
  const [boardData, floorElRes] = await Promise.all([
    getWorkstationBoardData(labId),
    getLabFloorElements(labId),
  ])

  // 2. Fetch active schedule sessions if not specified in URL
  let targetScheduleId = params.schedule_id || ''

  if (!targetScheduleId) {
    const { data: schedRows } = await (supabase
      .from('schedules') as any)
      .select('id, start_time')
      .eq('lab_id', labId)
      .order('start_time', { ascending: true })
      .limit(1)

    if (schedRows && schedRows.length > 0) {
      targetScheduleId = schedRows[0].id
    }
  }

  // 3. Fetch initial live session context if schedule ID is available
  let sessionContext = null
  if (targetScheduleId) {
    const sessionRes = await getLiveSessionContext(targetScheduleId)
    if (sessionRes.success && sessionRes.data) {
      sessionContext = sessionRes.data
    }
  }

  return (
    <ProjectorView
      initialBoardData={boardData}
      floorElements={floorElRes.success && floorElRes.data ? floorElRes.data : []}
      initialSessionContext={sessionContext}
      scheduleId={targetScheduleId}
      labName="Computer Lab 01"
      labCode="COM-LAB"
    />
  )
}
