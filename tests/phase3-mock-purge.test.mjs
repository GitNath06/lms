import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Phase 3: Compiler-Driven Mock Purge Test Suite', async (t) => {
  await t.test('1. lib/master-data.ts does not export any of the 6 prototype mocks', async () => {
    const masterData = await import('../lib/master-data.ts')

    assert.equal(masterData.DEFAULT_SUBJECTS, undefined, 'DEFAULT_SUBJECTS must not be exported')
    assert.equal(masterData.DEFAULT_CLASSES, undefined, 'DEFAULT_CLASSES must not be exported')
    assert.equal(masterData.MASTER_ROUTINE, undefined, 'MASTER_ROUTINE must not be exported')
    assert.equal(masterData.INITIAL_FACULTY, undefined, 'INITIAL_FACULTY must not be exported')
    assert.equal(masterData.LAB_ROOMS, undefined, 'LAB_ROOMS must not be exported')
    assert.equal(masterData.MASTER_TIME_SLOTS, undefined, 'MASTER_TIME_SLOTS must not be exported')
  })

  await t.test('2. lib/baseline-routines.ts and institutional-relationships.ts are permanently purged', async () => {
    assert.equal(fs.existsSync(path.resolve(process.cwd(), 'lib/baseline-routines.ts')), false, 'lib/baseline-routines.ts must be deleted')
    assert.equal(fs.existsSync(path.resolve(process.cwd(), 'lib/context/institutional-relationships.ts')), false, 'lib/context/institutional-relationships.ts must be deleted')
  })

  await t.test('3. computeCombinedTimeRange works autonomously without MASTER_TIME_SLOTS', async () => {
    const { computeCombinedTimeRange } = await import('../lib/master-data.ts')

    const mockSlots = [
      { id: 't2', label: '10:10 - 11:00', name: 'Period 1' },
      { id: 't3', label: '11:00 - 11:45', name: 'Period 2' },
      { id: 't4', label: '11:45 - 12:30', name: 'Period 3' },
    ]

    const singleSpan = computeCombinedTimeRange('t2', 1, mockSlots)
    assert.equal(singleSpan, '10:10 - 11:00')

    const doubleSpan = computeCombinedTimeRange('t2', 2, mockSlots)
    assert.equal(doubleSpan, '10:10 - 11:45')
  })

  await t.test('4. computeMultiPeriodLabel works autonomously without MASTER_TIME_SLOTS', async () => {
    const { computeMultiPeriodLabel } = await import('../lib/master-data.ts')

    const mockSlots = [
      { id: 't2', label: '10:10 - 11:00', name: 'Period 1' },
      { id: 't3', label: '11:00 - 11:45', name: 'Period 2' },
    ]

    const result = computeMultiPeriodLabel(['t2', 't3'], mockSlots)
    assert.equal(result.label, 'Period 1 & Period 2 (10:10 - 11:45)')
    assert.equal(result.timeRange, '10:10 - 11:45')
  })

  await t.test('5. getOccupiedLabsInSlot operates accurately without MASTER_TIME_SLOTS', async () => {
    const { getOccupiedLabsInSlot } = await import('../lib/master-data.ts')

    const mockRoutine = [
      {
        id: 'sess-1',
        dayKey: 'sun',
        slotId: 't2',
        span: 2,
        labKey: 'comp',
        status: 'confirmed',
      },
      {
        id: 'sess-2',
        dayKey: 'sun',
        slotId: 't3',
        span: 1,
        labKey: 'phys',
        status: 'confirmed',
      },
    ]

    const occupiedT2 = getOccupiedLabsInSlot(mockRoutine, 'sun', 't2')
    assert.ok(occupiedT2.has('comp'), 'Lab comp should be occupied in t2')
    assert.ok(!occupiedT2.has('phys'), 'Lab phys should not be occupied in t2')

    const occupiedT3 = getOccupiedLabsInSlot(mockRoutine, 'sun', 't3')
    assert.ok(occupiedT3.has('comp'), 'Lab comp should remain occupied in t3 due to span 2')
    assert.ok(occupiedT3.has('phys'), 'Lab phys should be occupied in t3')
  })

  await t.test('6. Static analysis verifies zero mock imports in hooks and context modules', () => {
    const filesToCheck = [
      'hooks/use-routine-state.ts',
      'hooks/use-infrastructure-state.ts',
      'hooks/use-live-schedule.ts',
      'lib/context/cascading-filters.ts',
      'lib/context/user-scope.ts',
      'app/actions/schedules.ts',
    ]

    const forbiddenSymbols = [
      'DEFAULT_SUBJECTS',
      'DEFAULT_CLASSES',
      'MASTER_ROUTINE',
      'INITIAL_FACULTY',
      'LAB_ROOMS',
      'MASTER_TIME_SLOTS',
    ]

    for (const file of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), file)
      const content = fs.readFileSync(fullPath, 'utf8')

      // Check for forbidden imports from master-data
      for (const symbol of forbiddenSymbols) {
        const importPattern = new RegExp(`\\b${symbol}\\b.*from\\s+['"][^'"]*master-data`, 'i')
        assert.equal(
          importPattern.test(content),
          false,
          `File ${file} must NOT import ${symbol} from master-data`
        )
      }
    }
  })
})
