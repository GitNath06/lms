import type { WorkstationHardwareSpecs } from '@/types/workstations'

export interface TerminalIssueChip {
  id: string
  label: string
  iconName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

export const TERMINAL_QUICK_ISSUES: TerminalIssueChip[] = [
  {
    id: 'peripherals',
    label: 'Mouse / Keyboard Fault',
    iconName: 'MousePointer',
    severity: 'low',
    description: 'Keys jamming, mouse clicker broken, or wheel not scrolling properly.',
  },
  {
    id: 'no_internet',
    label: 'No Internet / LAN Disconnected',
    iconName: 'WifiOff',
    severity: 'high',
    description: 'Local network unplugged or web browser shows connection timed out.',
  },
  {
    id: 'missing_software',
    label: 'Missing Lab Software',
    iconName: 'PackageX',
    severity: 'high',
    description: 'Required subject software not installed (Turbo C++, Python, VS Code, MySQL).',
  },
  {
    id: 'app_freeze',
    label: 'Application Freeze / Crash',
    iconName: 'ZapOff',
    severity: 'medium',
    description: 'Program not responding, compiler crashing, or code editor completely frozen.',
  },
  {
    id: 'audio_issue',
    label: 'Audio / Headphone Issue',
    iconName: 'VolumeX',
    severity: 'low',
    description: 'No sound output or headphone jack not recognized during audio practical.',
  },
  {
    id: 'other',
    label: 'Other Workstation Problem',
    iconName: 'HelpCircle',
    severity: 'medium',
    description: 'Custom problem encountered while working on this terminal.',
  },
]

export interface TerminalStudentIdentity {
  enrollmentId?: string
  studentId?: string
  studentName: string
  rollNumber: number | string
  className?: string
  section?: string
  photoUrl?: string | null
  isTemporary?: boolean
  originalWorkstationLabel?: string | null
}

export interface TerminalActiveSession {
  scheduleId?: string
  subjectName: string
  teacherName?: string
  startTime?: string
  endTime?: string
  batchName?: string
}

export interface TerminalContextData {
  workstationId: string
  stationCode: string
  rowLabel?: string | null
  labId: string
  labName: string
  lanIp?: string | null
  machineGuid?: string | null
  hardwareSpecs?: WorkstationHardwareSpecs | null
  lastSeenAt?: string | null
  isPaired: boolean
  pairingToken?: string | null
  currentStudent?: TerminalStudentIdentity | null
  activeSession?: TerminalActiveSession | null
  recentIssues: Array<{
    id: string
    title: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'open' | 'acknowledged' | 'in_progress' | 'resolved'
    createdAt: string
  }>
}

export interface SubmitStudentReportInput {
  stationCode: string
  issueTag: string
  title: string
  description?: string | null
  studentName?: string | null
  studentRoll?: string | null
  pairingToken?: string | null
  clientIp?: string | null
}

export interface TerminalVerificationResult {
  allowed: boolean
  stationCode: string
  workstationId: string
  reason?: string
  tokenMatched?: boolean
  ipMatched?: boolean
}
