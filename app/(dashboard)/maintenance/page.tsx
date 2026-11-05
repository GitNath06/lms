import React from 'react'
import { Metadata } from 'next'
import MaintenanceClientPage from '@/components/maintenance/maintenance-client-page'

export const metadata: Metadata = {
  title: 'Lab Diagnostics & Maintenance | LabSync LIMS',
  description:
    'Institutional Lab Diagnostics, Workstation Health Triage, Computer Servicing & Recurrence Reminders',
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; station?: string; tab?: string }>
}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const initialSearch = resolvedParams.search || resolvedParams.station || ''
  const initialTab = (resolvedParams.tab as 'diagnostics' | 'tasks' | 'history') || undefined

  return (
    <MaintenanceClientPage
      initialSearch={initialSearch}
      initialTab={initialTab}
    />
  )
}
