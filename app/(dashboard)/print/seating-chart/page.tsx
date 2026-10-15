import React from 'react'
import { Metadata } from 'next'
import { getLabSeatPlan } from '@/app/actions/seat-plans'
import { getAuthorizedClasses } from '@/app/actions/seat-plans'
import { getAcademicYears } from '@/app/actions/academic-years'
import PrintSeatingChartView from '@/components/computer-lab/print-seating-chart-view'
import type { CohortSeatPlanData } from '@/lib/types/seat-plans'

export const metadata: Metadata = {
  title: 'Official Laboratory Seating Wall Chart | Print Sheet',
  description: 'Certified A4 landscape laboratory workstation seating chart and student roster for door mounting',
}

interface PrintSeatingChartPageProps {
  searchParams: Promise<{
    lab_id?: string
    class_id?: string
    academic_year_id?: string
  }>
}

export default async function PrintSeatingChartPage({ searchParams }: PrintSeatingChartPageProps) {
  const params = await searchParams
  const labId = params.lab_id || 'comp'
  const classId = params.class_id || '12eng'
  const yearId = params.academic_year_id || '2083'

  const [planRes, classesRes, yearsRes] = await Promise.all([
    getLabSeatPlan({ labId, classId, academicYearId: yearId }),
    getAuthorizedClasses(),
    getAcademicYears(),
  ])

  const planData: CohortSeatPlanData = planRes.success && planRes.data ? planRes.data : {
    lab_id: labId,
    lab_name: 'Computer Engineering Lab 01',
    academic_year_id: yearId,
    academic_year_name: '2083 BS',
    class_id: classId,
    class_name: 'Class 12 Science (Computer)',
    total_students: 0,
    assigned_count: 0,
    unassigned_count: 0,
    workstations: [],
    unassigned_students: [],
  }

  const currentClass = classesRes.success && classesRes.data
    ? classesRes.data.find((c) => c.id === classId)?.name || 'Class 12 Science (Computer)'
    : 'Class 12 Science (Computer)'

  const currentYear = yearsRes.success && yearsRes.data
    ? yearsRes.data.find((y) => y.id === yearId)?.name || '2083 BS'
    : '2083 BS'

  return (
    <PrintSeatingChartView
      data={planData}
      classNameDisplay={currentClass}
      academicYearDisplay={currentYear}
      labDisplayName="Computer Engineering Lab 01"
    />
  )
}
