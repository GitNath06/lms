import React from 'react'
import { Metadata } from 'next'
import { getMaintenanceOverview } from '@/app/actions/maintenance'
import PrintMaintenanceView from '@/components/maintenance/print-maintenance-view'

export const metadata: Metadata = {
  title: 'Certified Lab Maintenance & Servicing Logbook | Print Sheet',
  description:
    'Official A4 landscape certified maintenance logbook with 3-tier signature block',
}

interface PrintMaintenancePageProps {
  searchParams: Promise<{
    lab_id?: string
  }>
}

export default async function PrintMaintenancePage({ searchParams }: PrintMaintenancePageProps) {
  const params = await searchParams
  const labId = params.lab_id || 'all'
  const data = await getMaintenanceOverview(labId)

  return <PrintMaintenanceView data={data} labId={labId} />
}
