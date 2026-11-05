import React from 'react'
import { Metadata } from 'next'
import { AnalyticsClientPage } from './analytics-client-page'

export const metadata: Metadata = {
  title: 'Institutional Intelligence & Canonical Reports | LabSync LIMS',
  description:
    'Institutional dashboard covering NEB exam compliance, syllabus completion, faculty practical audits, lab occupancy, and workstation reliability analytics.',
}

export default function AnalyticsPage() {
  const classes = [
    { id: '12eng', name: 'Class 12 Science (Computer)' },
    { id: '11eng', name: 'Class 11 Science (Computer)' },
  ]

  const academicYears = [
    { id: '2083', name: '2083 BS' },
    { id: '2082', name: '2082 BS' },
  ]

  return (
    <AnalyticsClientPage
      classes={classes}
      academicYears={academicYears}
    />
  )
}
