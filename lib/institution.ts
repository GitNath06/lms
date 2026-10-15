/**
 * Institutional Configuration & Official Letterhead Metadata
 * Centralized constant for all exports (Excel, CSV, Print/PDF, and Report sheets)
 */

export const INSTITUTION_NAME =
  process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Ratna Rajya Laxmi Secondary School'

export const INSTITUTION_CONFIG = {
  code: process.env.NEXT_PUBLIC_INSTITUTION_CODE || 'RRLSS-NP',
  name: process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'RATNA RAJYA LAXMI SECONDARY SCHOOL',
  shortName: process.env.NEXT_PUBLIC_INSTITUTION_SHORT_NAME || 'Ratna Rajya Laxmi Sec School',
  nameNepali: process.env.NEXT_PUBLIC_INSTITUTION_NAME_NEPALI || 'श्री रत्न राज्य लक्ष्मी माध्यमिक विद्यालय',
  department: process.env.NEXT_PUBLIC_INSTITUTION_DEPT || 'Department of Science & Computer Engineering',
  departmentNepali: 'विज्ञान तथा कम्प्युटर इन्जिनियरिङ विभाग',
  location: process.env.NEXT_PUBLIC_INSTITUTION_LOCATION || 'Gaindakot-10, Pitauji, Nawalpur, Gandaki, Nepal',
  locationShort: process.env.NEXT_PUBLIC_INSTITUTION_LOCATION_SHORT || 'Gaindakot-10, Pitauji',
  website: process.env.NEXT_PUBLIC_INSTITUTION_WEBSITE || 'https://ratnarajya.edu.np',
  academicYear: '2083 B.S. / 2026 A.D.',
  systemTitle: 'Academic Laboratory Practical & Management System (LabSync)',
  systemSubtitle: 'Official Practical Experiment Logs, Incident Tracking & Certified Verification Registry',
  signatures: {
    left: {
      role: 'Lab In-Charge',
      title: 'Lab In-Charge Signature',
      subtitle: 'Faculty Verification & Equipment Audit',
    },
    right: {
      role: 'HOD / Principal',
      title: 'HOD / Principal Signature',
      subtitle: 'Institutional Oversight & Certified Approval',
    },
  },
} as const

export type InstitutionConfig = typeof INSTITUTION_CONFIG
