/**
 * Types & Domain Helpers for Fleet Maintenance Operations
 * Used across /maintenance, /computer-lab, and Server Actions.
 */

export type FleetTerminalStatus = 'pending' | 'completed' | 'blocked'

export interface FleetTerminalEntry {
  status: FleetTerminalStatus
  updated_at: string
  technician_name?: string
  technician_id?: string
  notes?: string
}

export type FleetProgressMap = Record<string, FleetTerminalEntry>

export interface FleetProgressSummary {
  total: number
  completed: number
  pending: number
  blocked: number
  percentage: number
}

/**
 * Pure calculation helper: computes summary metrics from machine list and progress map
 */
export function calculateFleetProgressSummary(
  targetMachines: string[],
  progress: FleetProgressMap | null | undefined
): FleetProgressSummary {
  const total = targetMachines.length
  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      blocked: 0,
      percentage: 0,
    }
  }

  let completed = 0
  let blocked = 0
  let pending = 0

  const safeMap = progress || {}

  for (const label of targetMachines) {
    const entry = safeMap[label]
    if (!entry || entry.status === 'pending') {
      pending++
    } else if (entry.status === 'completed') {
      completed++
    } else if (entry.status === 'blocked') {
      blocked++
    } else {
      pending++
    }
  }

  const percentage = Math.round((completed / total) * 100)

  return {
    total,
    completed,
    pending,
    blocked,
    percentage,
  }
}

/**
 * Natural sort for workstation labels (PC-01 before PC-10, Teacher Pod at the end or top)
 */
export function sortWorkstationLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const aIsTeacher = a.toLowerCase().includes('teacher') || a.toLowerCase().includes('podium')
    const bIsTeacher = b.toLowerCase().includes('teacher') || b.toLowerCase().includes('podium')
    if (aIsTeacher && !bIsTeacher) return 1
    if (!aIsTeacher && bIsTeacher) return -1

    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Group workstation labels by Row (Row A, Row B, etc. or chunks of 10)
 */
export function groupWorkstationLabelsByRow(labels: string[]): Array<{
  rowLabel: string
  items: string[]
}> {
  const sorted = sortWorkstationLabels(labels)
  const map: Map<string, string[]> = new Map()

  for (const label of sorted) {
    // If label starts with PC- and we want to group by chunks or known pattern
    const lower = label.toLowerCase()
    let group = 'Fleet'
    if (lower.includes('teacher') || lower.includes('podium')) {
      group = 'Teacher Pod'
    } else {
      // Check if standard PC-XX number
      const numMatch = label.match(/\d+/)
      if (numMatch) {
        const num = parseInt(numMatch[0], 10)
        if (num <= 10) group = 'Row A (01-10)'
        else if (num <= 20) group = 'Row B (11-20)'
        else if (num <= 30) group = 'Row C (21-30)'
        else if (num <= 40) group = 'Row D (31-40)'
        else if (num <= 50) group = 'Row E (41-50)'
        else group = 'Additional Stations'
      }
    }

    if (!map.has(group)) {
      map.set(group, [])
    }
    map.get(group)!.push(label)
  }

  return Array.from(map.entries()).map(([rowLabel, items]) => ({
    rowLabel,
    items,
  }))
}
