import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Temporary Relocation, Student Photos & Student Terminal Gateway Suite', () => {
  it('01. Student Photos: getLiveSessionContext selects photo_url and attaches to expectedRoster and seatPlan', () => {
    const liveSessionPath = path.resolve(process.cwd(), 'app/actions/live-session.ts')
    const content = fs.readFileSync(liveSessionPath, 'utf8')

    assert.ok(content.includes('photo_url'), 'live-session.ts must select photo_url from students')
    assert.ok(content.includes('photoUrl?: string | null'), 'LiveSessionContext must type photoUrl')
    assert.ok(content.includes('photoUrl: e.students?.photo_url'), 'expectedRoster must map photoUrl')
    assert.ok(content.includes('photoUrl: student.photoUrl'), 'seatPlan must map photoUrl')
  })

  it('02. Prior Seat Vacation: Applying Tier 2 override vacates student from previous baseline workstation', () => {
    const liveSessionPath = path.resolve(process.cwd(), 'app/actions/live-session.ts')
    const content = fs.readFileSync(liveSessionPath, 'utf8')

    assert.ok(
      content.includes('delete effectiveSeatPlan[existingWsId]'),
      'getLiveSessionContext must delete prior workstation entry when override applies'
    )
    assert.ok(
      content.includes('neq(\'workstation_id\', params.workstationId)'),
      'assignSessionSeatOverride must delete prior overrides for this enrollment on this date'
    )
  })

  it('03. Displaced Student Triage Queue: Compact, sleek, high-density presentation without bulky box', () => {
    const triagePath = path.resolve(process.cwd(), 'components/computer-lab/displaced-students-queue.tsx')
    const content = fs.readFileSync(triagePath, 'utf8')

    assert.ok(content.includes('DisplacedStudentsQueue'), 'Component DisplacedStudentsQueue must be exported')
    assert.ok(content.includes('ArrowRightLeft'), 'Must use ArrowRightLeft icon for relocation')
    assert.ok(!content.includes('+ Relocate'), 'RULE 1: Must never have literal + in button labels')
    assert.ok(!content.includes('+ Assign'), 'RULE 1: Must never have literal + in button labels')
  })

  it('04. Workstation Node: Distinct UI elevation for temporarily relocated students', () => {
    const nodePath = path.resolve(process.cwd(), 'components/maintenance/workstations/workstation-node.tsx')
    const content = fs.readFileSync(nodePath, 'utf8')

    assert.ok(content.includes('isTemporary'), 'workstation-node must compute isTemporary')
    assert.ok(content.includes('TEMP'), 'Temporary relocated nodes must render TEMP badge')
    assert.ok(content.includes('absolute top-0.5 right-0.5'), 'TEMP badge must be placed in the top right corner')
    assert.ok(content.includes('student?.photo_url'), 'Avatar must render student photo_url')
  })

  it('05. Student Terminal Resolution: getTerminalContext checks Tier 2 session overrides and identifies temp student', () => {
    const terminalPath = path.resolve(process.cwd(), 'app/actions/terminal.ts')
    const content = fs.readFileSync(terminalPath, 'utf8')

    assert.ok(
      content.includes('session_seat_overrides'),
      'getTerminalContext must query session_seat_overrides'
    )
    assert.ok(
      content.includes('isTemporary: true'),
      'getTerminalContext must mark relocated students as isTemporary: true'
    )
    assert.ok(
      content.includes('originalWorkstationLabel'),
      'getTerminalContext must resolve originalWorkstationLabel'
    )
    assert.ok(
      content.includes('movedAwayQuery'),
      'getTerminalContext must check if baseline student was relocated away to another workstation'
    )
  })

  it('06. Student Terminal View: StudentTerminalView displays student photo and temp relocation badge', () => {
    const termViewPath = path.resolve(process.cwd(), 'components/terminal/student-terminal-view.tsx')
    const content = fs.readFileSync(termViewPath, 'utf8')

    assert.ok(content.includes('data.currentStudent?.photoUrl'), 'StudentTerminalView must display photoUrl')
    assert.ok(content.includes('data.currentStudent?.isTemporary'), 'StudentTerminalView must check isTemporary')
    assert.ok(content.includes('Temp Relocation'), 'StudentTerminalView must show Temp Relocation badge')
  })

  it('07. Seating Snapshot Integrity: practical-detail-modal renders original workstation relocation note', () => {
    const modalPath = path.resolve(process.cwd(), 'components/records/practical-detail-modal.tsx')
    const content = fs.readFileSync(modalPath, 'utf8')

    assert.ok(
      content.includes('station.original_workstation_label'),
      'practical-detail-modal must check station.original_workstation_label'
    )
    assert.ok(
      content.includes('from {station.original_workstation_label}'),
      'practical-detail-modal must display from <original_label>'
    )
  })
})
