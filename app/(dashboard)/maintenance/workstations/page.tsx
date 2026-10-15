import React from 'react'
import { Metadata } from 'next'
import { Wrench } from 'lucide-react'
import PageHeader from '@/components/layout/page-header'
import { getDiagnosticsTriageData } from '@/app/actions/workstations'
import { DiagnosticsTriageHub } from '@/components/maintenance/diagnostics-triage-hub'

export const metadata: Metadata = {
  title: 'Hardware Diagnostics & Issue Resolution | LabSync LIMS',
  description:
    'Institutional Computer Lab Diagnostics, Workstation Health Triage, and Problem Resolution',
}

export default async function WorkstationDiagnosticsPage() {
  const triageData = await getDiagnosticsTriageData('comp')

  return (
    <div className="space-y-4 w-full pb-16 font-sans">
      <PageHeader
        title="Hardware Diagnostics & Issue Resolution"
        subtitle="Workstation fleet health matrix, technician problem triage, and certified repair restoration"
        icon={Wrench}
        breadcrumbs={[
          { label: 'Lab Diagnostics & Maintenance', href: '/maintenance' },
          { label: 'Hardware Diagnostics & Resolution' },
        ]}
      />

      <DiagnosticsTriageHub initialData={triageData} />
    </div>
  )
}
