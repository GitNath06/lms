import React from 'react'
import { Metadata } from 'next'
import { ComputerLabWorkspace } from '@/components/computer-lab/computer-lab-workspace'

export const metadata: Metadata = {
  title: 'Floor Plan & Cockpit | LabSync LIMS',
  description:
    'Interactive CAD Floor Plan, Live Practical Session Cockpit, In-Seat Roll-Call, and Hardware Diagnostics',
}

export default function ComputerLabPage() {
  return (
    <div className="w-full">
      <ComputerLabWorkspace />
    </div>
  )
}
