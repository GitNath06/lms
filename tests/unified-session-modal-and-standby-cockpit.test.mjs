import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Unified SessionActionModal & Live vs. Standby Floor Cockpit Invariants', () => {
  it('1. Floor Plan Uniformity: computer-lab-workspace renders unified SessionActionModal and purged custom isSkipModalOpen', () => {
    const workspaceCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx'),
      'utf8'
    )

    // Verify SessionActionModal is dynamically imported and mounted
    assert.ok(
      workspaceCode.includes("import('@/components/schedules/session-action-modal')"),
      'SessionActionModal must be imported in computer-lab-workspace'
    )
    assert.ok(
      workspaceCode.includes('<SessionActionModal'),
      'computer-lab-workspace must mount SessionActionModal'
    )

    // Verify custom isSkipModalOpen dialog (Image 3) has been purged
    assert.ok(
      !workspaceCode.includes('isSkipModalOpen'),
      'Custom isSkipModalOpen dialog state must be completely removed in favor of SessionActionModal'
    )

    // Verify LiveCockpitBar triggers SessionActionModal with initialMode="skip" and "log"
    assert.ok(
      workspaceCode.includes("setSessionActionModalMode('skip')"),
      'Clicking skip in LiveCockpitBar must open SessionActionModal in skip mode'
    )
    assert.ok(
      workspaceCode.includes("setSessionActionModalMode('log')"),
      'Clicking submit log in LiveCockpitBar must open SessionActionModal in log mode'
    )
  })

  it('2. Universal Seating Protection: computer-lab-workspace passes live 48-station seating snapshot to SessionActionModal', () => {
    const workspaceCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx'),
      'utf8'
    )

    assert.ok(
      workspaceCode.includes('seatingSnapshot={currentSeatingSnapshot || undefined}'),
      'computer-lab-workspace must pass currentSeatingSnapshot to SessionActionModal'
    )
    assert.ok(
      workspaceCode.includes('seatingSnapshotToSave = boardData.workstations.map'),
      'handleSaveLogFromModal must construct seatingSnapshotToSave from 48 workstation nodes'
    )
  })

  it('3. Cockpit Layout: LiveCockpitBar renders remaining time pill beside Operations button', () => {
    const cockpitCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/live-cockpit-bar.tsx'),
      'utf8'
    )

    // Verify remaining time is placed beside Operations button in session header
    assert.ok(
      cockpitCode.includes('minsRemaining') && cockpitCode.includes('remaining'),
      'LiveCockpitBar must display remaining minutes pill'
    )
    assert.ok(
      cockpitCode.includes('Starts in {timingStatus?.startsInMins ?? 0}m'),
      'LiveCockpitBar must display upcoming start countdown pill'
    )
    assert.ok(
      cockpitCode.includes('onManageSession'),
      'LiveCockpitBar must support onManageSession for opening modal operations'
    )
    assert.ok(
      cockpitCode.includes('Save & Submit Practical Log'),
      'Live Cockpit must have prominent Save & Submit Practical Log button'
    )
  })

  it('4. Workstation Standby Mode & Absent Greyscale: WorkstationNode handles standby and inactive absent avatars', () => {
    const nodeCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/maintenance/workstations/workstation-node.tsx'),
      'utf8'
    )

    assert.ok(
      nodeCode.includes('isStandby?: boolean'),
      'WorkstationNodeProps must declare isStandby prop'
    )
    assert.ok(
      nodeCode.includes('isStandby = false'),
      'WorkstationNode must default isStandby to false'
    )
    assert.ok(
      nodeCode.includes('STANDBY'),
      'WorkstationNode must render STANDBY badge when in sleep preview mode'
    )

    // Absent styling: greyscale avatar and removal of red dot
    assert.ok(
      nodeCode.includes('isAbsent') && nodeCode.includes('grayscale'),
      'WorkstationNode must apply greyscale filter for absent students'
    )
    assert.ok(
      !nodeCode.includes("bg-rose-400 shadow-[0_0_4px_#f43f5e] ml-0.5 shrink-0\" title=\"Absent\""),
      'WorkstationNode must not render the old red dot for absent students'
    )
  })

  it('5. Reassignment Integrity: computer-lab-workspace filters out workstations under repair/servicing', () => {
    const workspaceCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx'),
      'utf8'
    )

    assert.ok(
      workspaceCode.includes('isUnderRepair = w.status === \'under_repair\'') ||
      workspaceCode.includes("w.status === 'under_repair'"),
      'computer-lab-workspace must filter out under-repair workstations from availableWorkstations'
    )
    assert.ok(
      workspaceCode.includes('isFlagged = w.status === \'flagged\'') ||
      workspaceCode.includes("w.status === 'flagged'"),
      'computer-lab-workspace must filter out flagged workstations from availableWorkstations'
    )
  })

  it('6. SessionActionModal: Topic Validation, Error Banner & 48-Station Seating Recorded badge', () => {
    const modalCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/schedules/session-action-modal.tsx'),
      'utf8'
    )

    assert.ok(
      modalCode.includes('48-Station Seating Recorded'),
      'SessionActionModal must render 48-Station Seating Recorded badge for Computer Lab sessions'
    )
    assert.ok(
      modalCode.includes('seatingSnapshot?: any[]'),
      'SessionActionModalProps must accept seatingSnapshot'
    )
    assert.ok(
      modalCode.includes('Please specify the Practical Topic / What Was Learned before saving the practical record.'),
      'SessionActionModal must validate practical topic before saving'
    )
    assert.ok(
      modalCode.includes('initialAbsentRolls?: number[]'),
      'SessionActionModalProps must accept initialAbsentRolls'
    )
  })

  it('7. StationQuickPopover: Instant local presence and automatic dialog close', () => {
    const popoverCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/station-quick-popover.tsx'),
      'utf8'
    )

    assert.ok(
      popoverCode.includes('localPresence'),
      'StationQuickPopover must track local presence for instant responsiveness'
    )
    assert.ok(
      popoverCode.includes('onClose()'),
      'StationQuickPopover must auto-close after marking presence'
    )
  })

  it('8. Absent-Student Workstation Availability: Operational PCs with absent students are made available for reassignment', () => {
    const workspaceCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/computer-lab-workspace.tsx'),
      'utf8'
    )
    const popoverCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/station-quick-popover.tsx'),
      'utf8'
    )
    const queueCode = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/displaced-students-queue.tsx'),
      'utf8'
    )

    // 1. availableRelocationStations checks if assigned student is marked absent
    assert.ok(
      workspaceCode.includes('sessionAttendance[seatedStudent.rollNumber] === false'),
      'availableRelocationStations must include workstations where the assigned student is absent'
    )
    assert.ok(
      workspaceCode.includes('Vacant — Absent:'),
      'availableRelocationStations must label absent-student vacancies'
    )

    // 2. Both StationQuickPopover and DisplacedStudentsQueue accept and render description
    assert.ok(
      popoverCode.includes('description?: string'),
      'StationQuickPopoverProps must accept workstation description'
    )
    assert.ok(
      queueCode.includes('description?: string'),
      'DisplacedStudentsQueueProps must accept workstation description'
    )

    // 3. Absent students do not clutter displacedStudents queue
    assert.ok(
      workspaceCode.includes('sessionAttendance[student.rollNumber] === false) continue'),
      'displacedStudents must not include absent students in the relocation queue'
    )
  })
})
