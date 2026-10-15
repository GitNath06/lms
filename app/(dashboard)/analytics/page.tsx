import React from 'react'
import { Metadata } from 'next'
import { getAuthorizedClasses } from '@/app/actions/seat-plans'
import { getAcademicYears } from '@/app/actions/academic-years'
import { AnalyticsClientPage } from './analytics-client-page'

export const metadata: Metadata = {
  title: 'Institutional Intelligence & Canonical Reports | LabSync LIMS',
  description:
    'Institutional dashboard covering NEB exam compliance, syllabus completion, faculty practical audits, lab occupancy, and workstation reliability analytics.',
}

export default async function AnalyticsPage() {
  const [classesRes, yearsRes] = await Promise.all([
    getAuthorizedClasses(),
    getAcademicYears(),
  ])

  const classes = classesRes.success && classesRes.data ? classesRes.data : [
    { id: '12eng', name: 'Class 12 Science (Computer)' },
    { id: '11eng', name: 'Class 11 Science (Computer)' },
  ]

  const academicYears = yearsRes.success && yearsRes.data ? yearsRes.data : [
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
