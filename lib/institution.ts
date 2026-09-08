/**
 * Institutional Configuration & Official Letterhead Metadata
 * Centralized constant for all exports (Excel, CSV, Print/PDF, and Report sheets)
 */

export const INSTITUTION_CONFIG = {
  code: 'RRLSS-KTM',
  name: 'SHREE RATNA RAJYA LAXMI SECONDARY SCHOOL',
  nameNepali: 'श्री रत्न राज्य लक्ष्मी माध्यमिक विद्यालय',
  department: 'Department of Science & Computer Engineering',
  departmentNepali: 'विज्ञान तथा कम्प्युटर इन्जिनियरिङ विभाग',
  location: 'Kathmandu, Nepal',
  academicYear: '2083 B.S. / 2026 A.D.',
  systemTitle: 'Academic Laboratory Practical & Management System (LMR)',
  systemSubtitle: 'Official Practical Experiment Logs, Incident Tracking & Certified Verification Registry',
  signatures: {
    left: {
      role: 'Lab In-Charge',
      title: 'Lab In-Charge Signature',
      subtitle: 'Faculty Verification & Apparatus Audit',
    },
    right: {
      role: 'HOD / Principal',
      title: 'HOD / Principal Signature',
      subtitle: 'Institutional Oversight & Certified Approval',
    },
  },
} as const

export type InstitutionConfig = typeof INSTITUTION_CONFIG
