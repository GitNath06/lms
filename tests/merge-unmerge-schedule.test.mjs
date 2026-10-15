import test from 'node:test'
import assert from 'node:assert/strict'
import { computeCombinedTimeRange } from '../lib/master-data.ts'
import { parseSlotTimeRange } from '../lib/utils.ts'

test('Schedule Merge & Unmerge Engine Invariants', async (t) => {
  await t.test('1. Time Span Calculation: Merging slot t2 (10:10 - 11:00) with span 2 computes end_time 11:45', () => {
    const range = computeCombinedTimeRange('t2', 2)
    assert.equal(range, '10:10 - 11:45', 'Combined time range must cover both periods')
    const { startTime, endTime } = parseSlotTimeRange(range)
    assert.equal(startTime, '10:10')
    assert.equal(endTime, '11:45')
  })

  await t.test('2. Title Deduplication: Merging identical subjects deduplicates title and code', () => {
    function cleanMergedSubjectName(name, fallbackPrimary, fallbackSecondary) {
      if (name) {
        const trimmed = name.trim()
        const parts = trimmed.split(/\s*(?:&|\+)\s*/).map((p) => p.trim()).filter(Boolean)
        if (parts.length > 1 && new Set(parts).size === 1) {
          return parts[0]
        }
        return trimmed
      }
      if (fallbackPrimary && fallbackSecondary) {
        if (fallbackPrimary.trim() === fallbackSecondary.trim()) {
          return fallbackPrimary.trim()
        }
        return `${fallbackPrimary.trim()} & ${fallbackSecondary.trim()}`
      }
      return fallbackPrimary || ''
    }

    const test1 = cleanMergedSubjectName('CHEM-12 - Chemistry Lab & CHEM-12 - Chemistry Lab')
    assert.equal(test1, 'CHEM-12 - Chemistry Lab', 'Should deduplicate concatenated identical names')

    const test2 = cleanMergedSubjectName(undefined, 'CHEM-12 - Chemistry Lab', 'CHEM-12 - Chemistry Lab')
    assert.equal(test2, 'CHEM-12 - Chemistry Lab', 'Should not join duplicate fallback names')

    const test3 = cleanMergedSubjectName('COMP-11 - Programming & DDMP-10 - Digital Design')
    assert.equal(test3, 'COMP-11 - Programming & DDMP-10 - Digital Design', 'Should preserve distinct subject names')
  })
})
