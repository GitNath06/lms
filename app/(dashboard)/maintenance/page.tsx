import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMaintenanceOverview } from '@/app/actions/maintenance'
import { getWorkstationBoardData, getDiagnosticsTriageData } from '@/app/actions/workstations'
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

  const [data, workstationData, triageData] = await Promise.all([
    getMaintenanceOverview('all'),
    getWorkstationBoardData('comp'),
    getDiagnosticsTriageData('comp'),
  ])

  if (!data.authorized) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center font-sans space-y-4 shadow-sm">
        <div className="h-12 w-12 mx-auto rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Restricted Lab Access
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            The Lab Maintenance module is restricted to Laboratory In-Charges,
            Assigned Technicians, Academic Coordinators, and Administrators.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/">
            <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <MaintenanceClientPage
      initialData={data}
      initialWorkstationData={workstationData}
      initialTriageData={triageData}
      initialSearch={initialSearch}
      initialTab={initialTab}
    />
  )
}

