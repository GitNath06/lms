import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  getSlotRange,
  slotRangesOverlap,
  timeRangesOverlap,
  SLOT_ORDER,
} from '../lib/scheduling/conflict-engine.ts'

import {
  evaluateDateSuspension,
} from '../lib/calendar-policy.ts'

import {
  createHandshakeTicket,
  verifyHandshakeTicket,
  createTerminalSessionToken,
  verifyTerminalSessionToken,
} from '../lib/security/terminal-token.ts'

import {
  snapCoordinate,
  sortWorkstationsByLabel,
  deduplicateWorkstationCoordinates,
} from '../lib/workstations/layout-engine.ts'

describe('Tier 1: Pure Domain Invariants Suite (Zero-DB, In-Memory)', () => {
  // --------------------------------------------------------------------------
  // 1. Triple-Collision Defense Invariants
  // --------------------------------------------------------------------------
  describe('1. Timetable Conflict Engine Invariants', () => {
    it('getSlotRange maps single-slot and multi-slot spans correctly', () => {
      // SLOT_ORDER = ['t0', 'pre', 't1', 't2', 't3', 't4', 'break', 't5', 't6', 't7', 't8', 't9', 't10']
      const t1Range = getSlotRange('t1', 1)
      assert.deepEqual(t1Range, { start: 2, end: 2 })

      const t2Triple = getSlotRange('t2', 3)
      assert.deepEqual(t2Triple, { start: 3, end: 5 })

      const t8Double = getSlotRange('t8', 2)
      assert.deepEqual(t8Double, { start: 10, end: 11 })

      // Fallback on missing or invalid slot ID
      const invalid = getSlotRange(null, 1)
      assert.deepEqual(invalid, { start: 0, end: 0 })
    })

    it('slotRangesOverlap accurately detects boundary overlaps and adjacent slots', () => {
      // Overlapping: [0, 2] and [1, 3] overlap on 1 and 2
      assert.equal(slotRangesOverlap({ start: 0, end: 2 }, { start: 1, end: 3 }), true)

      // Exact match: [2, 2] and [2, 2]
      assert.equal(slotRangesOverlap({ start: 2, end: 2 }, { start: 2, end: 2 }), true)

      // Adjacent (touching edge): [0, 1] and [1, 2] overlap on 1
      assert.equal(slotRangesOverlap({ start: 0, end: 1 }, { start: 1, end: 2 }), true)

      // Disjoint: [0, 1] and [2, 3] do NOT overlap
      assert.equal(slotRangesOverlap({ start: 0, end: 1 }, { start: 2, end: 3 }), false)
      assert.equal(slotRangesOverlap({ start: 4, end: 6 }, { start: 0, end: 2 }), false)
    })

    it('timeRangesOverlap detects time window collisions in HH:MM format', () => {
      // 10:00 - 11:30 vs 11:00 - 12:30 -> Overlap between 11:00 and 11:30
      assert.equal(timeRangesOverlap('10:00', '11:30', '11:00', '12:30'), true)

      // Adjacent periods: 10:00 - 11:00 and 11:00 - 12:00 -> NO overlap
      assert.equal(timeRangesOverlap('10:00', '11:00', '11:00', '12:00'), false)

      // Completely disjoint
      assert.equal(timeRangesOverlap('08:00', '09:00', '13:00', '14:00'), false)

      // Afternoon (02:00 PM / 14:00) vs Morning class (10:10 - 11:00 AM) -> NO false overlap!
      assert.equal(timeRangesOverlap('14:00', '14:45', '10:10', '11:00'), false)
      assert.equal(timeRangesOverlap('02:00 PM', '02:45 PM', '10:10 AM', '11:00 AM'), false)
    })
  })

  // --------------------------------------------------------------------------
  // 2. Institutional Holiday & Recess Policy Invariants
  // --------------------------------------------------------------------------
  describe('2. Calendar Policy & Holiday Suspension Invariants', () => {
    it('evaluateDateSuspension detects Saturday statutory weekend in Nepal', () => {
      // 2026-11-07 is a standard Saturday outside holiday periods
      const saturdayStatus = evaluateDateSuspension('2026-11-07')
      assert.equal(saturdayStatus.isSuspended, true)
      assert.equal(saturdayStatus.type, 'recess')
      assert.ok(saturdayStatus.title?.includes('Saturday'))
    })

    it('evaluateDateSuspension returns nominal active state on standard academic days', () => {
      // 2026-11-04 is a regular Wednesday
      const weekdayStatus = evaluateDateSuspension('2026-11-04')
      assert.equal(weekdayStatus.isSuspended, false)
      assert.equal(weekdayStatus.type, undefined)
    })

    it('evaluateDateSuspension detects gazetted public holidays from master list (e.g. Bada Dashain)', () => {
      // 2026-10-14 falls inside Bada Dashain Vacation (Oct 10 - Oct 22)
      const holidayStatus = evaluateDateSuspension('2026-10-14')
      assert.equal(holidayStatus.isSuspended, true)
      assert.equal(holidayStatus.type, 'holiday')
      assert.ok(holidayStatus.title?.includes('Dashain'))
    })
  })

  // --------------------------------------------------------------------------
  // 3. Cryptographic Terminal Token & Session Security Invariants
  // --------------------------------------------------------------------------
  describe('3. Cryptographic Terminal Token Security Invariants', () => {
    const mockStation = {
      id: 'ws-test-uuid',
      label: 'PC-07',
      machine_guid: '550e8400-e29b-41d4-a716-446655440000',
    }

    it('createHandshakeTicket generates a verifiable HMAC-SHA256 token', () => {
      const ticket = createHandshakeTicket(mockStation)
      assert.ok(typeof ticket === 'string' && ticket.length > 20, 'Ticket must be a non-empty string')

      const verified = verifyHandshakeTicket(ticket)
      assert.equal(verified.valid, true)
      assert.equal(verified.payload?.stationId, mockStation.id)
      assert.equal(verified.payload?.stationCode, mockStation.label)
      assert.equal(verified.payload?.machineGuid, mockStation.machine_guid)
    })

    it('verifyHandshakeTicket rejects tampered tickets', () => {
      const validTicket = createHandshakeTicket(mockStation)
      const tamperedTicket = validTicket.slice(0, -4) + 'abcd'

      const verified = verifyHandshakeTicket(tamperedTicket)
      assert.equal(verified.valid, false)
      assert.ok(!verified.payload)
    })

    it('createTerminalSessionToken and verifyTerminalSessionToken round-trip cleanly', () => {
      const sessionToken = createTerminalSessionToken(mockStation)
      assert.ok(typeof sessionToken === 'string')

      const verified = verifyTerminalSessionToken(sessionToken)
      assert.equal(verified.valid, true)
      assert.equal(verified.payload?.stationId, mockStation.id)
      assert.equal(verified.payload?.stationCode, mockStation.label)
    })
  })

  // --------------------------------------------------------------------------
  // 4. CAD Floor Mathematical Layout Invariants
  // --------------------------------------------------------------------------
  describe('4. CAD Floor Mathematical Layout Invariants', () => {
    it('snapCoordinate snaps percentages to nearest grid increment and clamps between 2% and 98%', () => {
      // 2% grid snapping
      assert.equal(snapCoordinate(11.2, 2), 12)
      assert.equal(snapCoordinate(10.8, 2), 10)

      // Clamping limits
      assert.equal(snapCoordinate(-5, 2), 2, 'Must clamp lower bound at 2%')
      assert.equal(snapCoordinate(105, 2), 98, 'Must clamp upper bound at 98%')
    })

    it('sortWorkstationsByLabel naturally sorts labels PC-01, PC-02 through PC-10 and separates teacher nodes', () => {
      const unorderedNodes = [
        { label: 'PC-10' },
        { label: 'PC-02' },
        { label: 'Teacher Desk' },
        { label: 'PC-01' },
        { label: 'PC-03' },
      ]

      const sorted = sortWorkstationsByLabel(unorderedNodes)
      assert.equal(sorted.teacherNodes.length, 1)
      assert.equal(sorted.teacherNodes[0].label, 'Teacher Desk')

      const studentLabels = sorted.studentNodes.map((n) => n.label)
      assert.deepEqual(studentLabels, ['PC-01', 'PC-02', 'PC-03', 'PC-10'])
    })

    it('deduplicateWorkstationCoordinates automatically repositions overlapping ghost cards to unoccupied slots', () => {
      // Two workstations sharing the exact same coordinate (e.g. PC-20 and PC-21 stacked at 42, 70)
      const stackedStations = [
        { id: 'ws-20', label: 'PC-20', pos_x: 42, pos_y: 70, row_label: 'Row E' },
        { id: 'ws-21', label: 'PC-21', pos_x: 42, pos_y: 70, row_label: 'Row E' },
        { id: 'ws-22', label: 'PC-22', pos_x: 42, pos_y: 70, row_label: 'Row E' },
      ]

      const deduplicated = deduplicateWorkstationCoordinates(stackedStations)
      assert.equal(deduplicated.length, 3)

      // All 3 workstations must now have distinct coordinates (distance >= 3%)
      for (let i = 0; i < deduplicated.length; i++) {
        for (let j = i + 1; j < deduplicated.length; j++) {
          const dist = Math.hypot(
            deduplicated[i].pos_x - deduplicated[j].pos_x,
            deduplicated[i].pos_y - deduplicated[j].pos_y
          )
          assert.ok(dist >= 3, `Workstations ${deduplicated[i].label} and ${deduplicated[j].label} must not collide (dist=${dist})`)
        }
      }
    })
  })
})
