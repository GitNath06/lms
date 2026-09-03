import React from 'react'
import { getPracticalLogs, getActiveLabs } from '@/app/actions/logs'
import DailyLogSheetView, { PracticalLogItem } from '@/components/print/daily-log-sheet-view'

export default async function DailyLogPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; lab_id?: string }>
}) {
  const params = await searchParams
  const date = params.date || new Date().toISOString().split('T')[0]
  const labId = params.lab_id || 'all'

  const [rawLogs, labs] = await Promise.all([
    getPracticalLogs({ date, lab_id: labId === 'all' ? undefined : labId }),
    getActiveLabs(),
  ])

  const logs = rawLogs as unknown as PracticalLogItem[]

  const selectedLab = labs.find((l) => l.id === labId)
  const labDisplayName = selectedLab ? selectedLab.name : 'All Science & Engineering Laboratories'

  return (
    <DailyLogSheetView
      initialLogs={logs}
      labs={labs}
      date={date}
      labId={labId}
      labDisplayName={labDisplayName}
    />
  )
}
