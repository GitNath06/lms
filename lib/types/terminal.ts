export interface TerminalIssueChip {
  id: string
  label: string
  iconName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

export const TERMINAL_QUICK_ISSUES: TerminalIssueChip[] = [
  {
    id: 'windows_activation',
    label: 'Windows Not Activated',
    iconName: 'ShieldAlert',
    severity: 'medium',
    description: 'Windows license expired or activation watermark visible on screen',
  },
  {
    id: 'office_license',
    label: 'MS Office Unlicensed',
    iconName: 'FileText',
    severity: 'medium',
    description: 'MS Word / Excel / PowerPoint activation notice or read-only mode',
  },
  {
    id: 'missing_software',
    label: 'Missing Software',
    iconName: 'PackageX',
    severity: 'high',
    description: 'Required subject software not installed (Python, VS Code, Turbo C++, DBMS)',
  },
  {
    id: 'system_freeze',
    label: 'Crash / Blue Screen',
    iconName: 'ZapOff',
    severity: 'critical',
    description: 'PC rebooting unexpectedly, BSOD screen, or completely frozen',
  },
  {
    id: 'peripherals',
    label: 'Mouse / Keyboard / Audio',
    iconName: 'MousePointer',
    severity: 'low',
    description: 'Mouse wheel, keys not responding, or headphone jack faulty',
  },
  {
    id: 'no_internet',
    label: 'No Internet / Network Disconnected',
    iconName: 'WifiOff',
    severity: 'high',
    description: 'LAN cable unplugged or internet connection unavailable',
  },
  {
    id: 'other',
    label: 'Other Problem',
    iconName: 'HelpCircle',
    severity: 'medium',
    description: 'Custom laboratory hardware or software difficulty',
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
