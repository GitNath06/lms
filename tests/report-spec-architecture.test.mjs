import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filtersToSearchParams,
  searchParamsToFilters,
  truncateAtWordBoundary,
  sanitizePostgrestSearch,
  resolveExportPrintScope,
} from '../lib/report-spec/filter-codec.ts'
import { practicalReportSpec, formatClassCode, sanitizeSubjectTitle } from '../lib/report-spec/practical-spec.ts'
import { incidentReportSpec } from '../lib/report-spec/incident-spec.ts'
import { maintenanceReportSpec } from '../lib/report-spec/maintenance-spec.ts'

test('Shared Record Report Specification & Filter Architecture Suite', async (t) => {

  await t.test('1. Filter Codec: Bidirectional Serialization & Zero Filter Drift', () => {
    const originalFilters = {
      lab_id: 'comp',
      date_from: '2026-03-01',
      date_to: '2026-03-31',
      status: 'skipped',
      search: 'Ohm',
      batch_group: 'Class 11 Science A',
      subject_name: 'Physics',
      teacher_id: 't-101',
      groupBy: 'batch_group',
      severity: 'major_critical',
      incident_type: 'breakage',
      asset_identifier: 'PC-14',
      plan_category: 'hardware',
      technician_id: 'tech-02',
      maintenance_status: 'completed',
      density: 'compact',
    }

    // 1. Encode to URLSearchParams
    const params = filtersToSearchParams(originalFilters)

    // Ensure NO filters were dropped (fixes the critical bug where status and search were dropped)
    assert.equal(params.get('lab_id'), 'comp')
    assert.equal(params.get('status'), 'skipped')
    assert.equal(params.get('search'), 'Ohm')
    assert.equal(params.get('batch_group'), 'Class 11 Science A')
    assert.equal(params.get('severity'), 'major_critical')
    assert.equal(params.get('incident_type'), 'breakage')
    assert.equal(params.get('asset_identifier'), 'PC-14')
    assert.equal(params.get('plan_category'), 'hardware')
    assert.equal(params.get('technician_id'), 'tech-02')
    assert.equal(params.get('maintenance_status'), 'completed')
    assert.equal(params.get('density'), 'compact')

    // 2. Decode back from URLSearchParams
    const roundtrip = searchParamsToFilters(params)
    assert.deepEqual(roundtrip, originalFilters)
  })

  await t.test('2. Word-Boundary Truncation: Never Cuts Mid-Word & Trims Trailing Punctuation', () => {
    const narrative = 'Workstation 14 SMPS power surge and capacitor burnout; quarantined on bench 4.'

    // Truncating at 40 chars:
    // Raw slice(0, 40) is "Workstation 14 SMPS power surge and capa"
    // Word boundary should cleanly cut before "capa" to "Workstation 14 SMPS power surge and"
    const res = truncateAtWordBoundary(narrative, 40)
    assert.equal(res.truncated, true)
    assert.equal(res.text, 'Workstation 14 SMPS power surge and')
    assert.ok(!res.text.endsWith('capa'), 'Must not truncate mid-word')

    // Clean trailing punctuation:
    const withPunct = 'Severe thermal throttle, overheating;'
    const punctRes = truncateAtWordBoundary(withPunct, 26) // "Severe thermal throttle,"
    assert.equal(punctRes.truncated, true)
    assert.equal(punctRes.text, 'Severe thermal throttle')
    assert.ok(!punctRes.text.endsWith(','), 'Must strip trailing comma')

    // Short text stays untruncated:
    const shortText = 'Normal routine check'
    const shortRes = truncateAtWordBoundary(shortText, 50)
    assert.equal(shortRes.truncated, false)
    assert.equal(shortRes.text, 'Normal routine check')
  })

  await t.test('3. Column Specification Constraints: Width Summation & Headroom Invariance', () => {
    // 1. practical_logs
    const practicalDetailedSum = practicalReportSpec.columns.reduce(
      (sum, col) => sum + col.print.detailed.widthPercent,
      0
    )
    const practicalCompactSum = practicalReportSpec.columns.reduce(
      (sum, col) => sum + col.print.compact.widthPercent,
      0
    )
    assert.ok(
      practicalDetailedSum <= 100,
      `practical_logs detailed sum (${practicalDetailedSum}%) must be <= 100% to avoid print page horizontal overflow`
    )
    assert.equal(practicalDetailedSum, 99, 'practical_logs detailed sum is calibrated to 99% (1% safety margin)')
    assert.ok(practicalCompactSum <= 100, 'practical_logs compact sum must be <= 100%')

    // 2. lab_incidents
    const incidentDetailedSum = incidentReportSpec.columns.reduce(
      (sum, col) => sum + col.print.detailed.widthPercent,
      0
    )
    const incidentCompactSum = incidentReportSpec.columns.reduce(
      (sum, col) => sum + col.print.compact.widthPercent,
      0
    )
    assert.ok(incidentDetailedSum <= 100, 'incident detailed sum must be <= 100%')
    assert.equal(incidentDetailedSum, 100, 'incident detailed sum must equal exactly 100%')
    assert.ok(incidentCompactSum <= 100, 'incident compact sum must be <= 100%')

    // 3. maintenance_logs
    const maintenanceDetailedSum = maintenanceReportSpec.columns.reduce(
      (sum, col) => sum + col.print.detailed.widthPercent,
      0
    )
    const maintenanceCompactSum = maintenanceReportSpec.columns.reduce(
      (sum, col) => sum + col.print.compact.widthPercent,
      0
    )
    assert.ok(maintenanceDetailedSum <= 100, 'maintenance detailed sum must be <= 100%')
    assert.ok(maintenanceCompactSum <= 100, 'maintenance compact sum must be <= 100%')

    // 4. Export alwaysFullText invariant
    for (const col of practicalReportSpec.columns) {
      assert.equal(col.export.alwaysFullText, true, `Column ${col.id} must have alwaysFullText: true`)
    }
    for (const col of incidentReportSpec.columns) {
      assert.equal(col.export.alwaysFullText, true, `Column ${col.id} must have alwaysFullText: true`)
    }
    for (const col of maintenanceReportSpec.columns) {
      assert.equal(col.export.alwaysFullText, true, `Column ${col.id} must have alwaysFullText: true`)
    }
  })

  await t.test('4. Footnote Allocation: Independent Sequential Numbering for Multiple Narrative Fields on Same Row', () => {
    // Simulate a record where BOTH topic_learned and remarks exceed the cutoff
    const row = {
      id: 'rec-001',
      date: '2026-03-12',
      labs: { name: 'Comp Lab 01' },
      topic_learned: 'Demonstrated advanced transistor biasing and circuit simulation on breadboards with multi-meter telemetry analysis.',
      remarks: 'Workstation 14 SMPS power surge and capacitor burnout; quarantined on bench 4 awaiting warranty replacement parts from vendor.',
    }

    const notes = []
    const rowId = `Row #1 (${row.date} | ${row.labs.name})`

    // Topic truncation
    const topicTrunc = truncateAtWordBoundary(row.topic_learned, 40)
    let topicIdx = null
    if (topicTrunc.truncated) {
      topicIdx = notes.length + 1
      notes.push({
        index: topicIdx,
        rowIdentifier: rowId,
        fieldName: 'Topic Learned',
        fullText: row.topic_learned,
      })
    }

    // Remarks truncation
    const remarksTrunc = truncateAtWordBoundary(row.remarks, 40)
    let remarksIdx = null
    if (remarksTrunc.truncated) {
      remarksIdx = notes.length + 1
      notes.push({
        index: remarksIdx,
        rowIdentifier: rowId,
        fieldName: 'Remarks',
        fullText: row.remarks,
      })
    }

    // Verify independent sequential numbers
    assert.equal(topicIdx, 1, 'First narrative on row gets index [1]')
    assert.equal(remarksIdx, 2, 'Second narrative on row gets index [2]')
    assert.equal(notes.length, 2)
    assert.equal(notes[0].fieldName, 'Topic Learned')
    assert.equal(notes[1].fieldName, 'Remarks')
    assert.equal(notes[0].rowIdentifier, rowId)
    assert.equal(notes[1].rowIdentifier, rowId)
    assert.equal(notes[0].fullText, row.topic_learned)
    assert.equal(notes[1].fullText, row.remarks)
  })

  await t.test('5. formatClassCode: Formats historical variants, canonical classes and guarantees verbatim fallback', () => {
    // Canonical Admin Panel classes
    assert.equal(formatClassCode('12 Eng'), '12 Eng')
    assert.equal(formatClassCode('12 Eng - Computer Engineering'), '12 Eng')
    assert.equal(formatClassCode('11 Eng - Computer Engineering'), '11 Eng')
    assert.equal(formatClassCode('12 Mgt - Management Stream'), '12 Mgt')
    assert.equal(formatClassCode('11 Mgt - General Science Stream'), '11 Mgt')
    assert.equal(formatClassCode('8A - General Science'), '8A')
    assert.equal(formatClassCode('8A'), '8A')

    // Historical variants
    assert.equal(formatClassCode('12B - Bio-Science Stream'), '12B')
    assert.equal(formatClassCode('12C - Tech Stream Sec A'), '12C-A')
    assert.equal(formatClassCode('11 Sc - Science Stream Sec B'), '11Sc-B')
    assert.equal(formatClassCode('Grade 11 - Sci A'), '11-SciA')
    assert.equal(formatClassCode('11C - Computer Tech Sec A'), '11C-A')
    assert.equal(formatClassCode('Class 10'), 'Class 10')
    assert.equal(formatClassCode('Class 11'), 'Class 11')
    assert.equal(formatClassCode('12C'), '12C')
    // Unrecognized pattern -> Verbatim fallback
    assert.equal(formatClassCode('Vocational Electrical Evening Section'), 'Vocational Electrical Evening Section')
    assert.equal(formatClassCode(''), '—')
    assert.equal(formatClassCode(null), '—')
    assert.equal(formatClassCode(undefined), '—')
  })

  await t.test('6. sanitizeSubjectTitle: Strips redundant stuttering course code prefixes', () => {
    assert.equal(
      sanitizeSubjectTitle('COMP-12 - COMP-12 — Data Structures & Algorithms Lab'),
      'COMP-12 — Data Structures & Algorithms Lab'
    )
    assert.equal(
      sanitizeSubjectTitle('PHY-11 - PHY-11 — Optics & Wave Mechanics'),
      'PHY-11 — Optics & Wave Mechanics'
    )
    assert.equal(sanitizeSubjectTitle('Physics'), 'Physics')
    assert.equal(sanitizeSubjectTitle(''), '—')
    assert.equal(sanitizeSubjectTitle(null), '—')
  })

  await t.test('7. sanitizePostgrestSearch: Strips grammar characters without breaking search intent', () => {
    assert.equal(sanitizePostgrestSearch('Smith, oxidation'), 'Smith oxidation')
    assert.equal(sanitizePostgrestSearch('Period 1 & 2 (10:10 - 11:45)'), 'Period 1 & 2 10:10 - 11:45')
    assert.equal(sanitizePostgrestSearch('100% "alcohol" *dry*'), '100 alcohol dry')
    assert.equal(sanitizePostgrestSearch(''), '')
    assert.equal(sanitizePostgrestSearch(null), '')
  })

  await t.test('8. resolveExportPrintScope: Validates precedence rules and audit traceability note formatting', () => {
    // 1. Explicit ID selection override
    const explicitScope = resolveExportPrintScope({
      selectedIds: ['p-1', 'p-2', 'p-3'],
      isAllMatchingSelected: false,
      totalCount: 45,
      filters: { lab_id: 'comp', status: 'completed' },
      sortKey: 'date',
      sortDirection: 'desc',
    })
    assert.equal(explicitScope.mode, 'SELECTED_EXPLICIT')
    assert.deepEqual(explicitScope.selectedIds, ['p-1', 'p-2', 'p-3'])
    assert.match(explicitScope.traceabilityNote, /3 selected records/)
    assert.match(explicitScope.traceabilityNote, /Sorted by: date \(desc\)/)

    // 2. Select-all matching filters override
    const allMatchingScope = resolveExportPrintScope({
      selectedIds: ['p-1', 'p-2'],
      isAllMatchingSelected: true,
      totalCount: 88,
      filters: { lab_id: 'phys', search: 'lens' },
      sortKey: 'facility',
      sortDirection: 'asc',
    })
    assert.equal(allMatchingScope.mode, 'ALL_MATCHING_EXPLICIT')
    assert.equal(allMatchingScope.selectedIds, undefined)
    assert.match(allMatchingScope.traceabilityNote, /88 records \(All Matching Selected\)/)
    assert.match(allMatchingScope.traceabilityNote, /Facility: PHYS/)
    assert.match(allMatchingScope.traceabilityNote, /Search: "lens"/)

    // 3. Normal unselected full dataset scope
    const normalScope = resolveExportPrintScope({
      selectedIds: [],
      isAllMatchingSelected: false,
      totalCount: 15,
      filters: { batch_group: 'Class 12 Sci B' },
    })
    assert.equal(normalScope.mode, 'FILTERED_DEFAULT')
    assert.match(normalScope.traceabilityNote, /15 records/)
    assert.match(normalScope.traceabilityNote, /Class: Class 12 Sci B/)
  })

  await t.test('9. WYSIWYG Transport Parameters: Bidirectional serialization of cols, selected, selKey, selectedAll', () => {
    const params = filtersToSearchParams({
      lab_id: 'chem',
      cols: 'date,period,facility,class_batch,subject',
      selected: 'id-1,id-2,id-3',
      selKey: 'psel_abc12345',
      selectedAll: true,
    })

    assert.equal(params.get('cols'), 'date,period,facility,class_batch,subject')
    assert.equal(params.get('selected'), 'id-1,id-2,id-3')
    assert.equal(params.get('selKey'), 'psel_abc12345')
    assert.equal(params.get('selectedAll'), 'true')

    const decoded = searchParamsToFilters(params)
    assert.equal(decoded.cols, 'date,period,facility,class_batch,subject')
    assert.equal(decoded.selected, 'id-1,id-2,id-3')
    assert.equal(decoded.selKey, 'psel_abc12345')
    assert.equal(decoded.selectedAll, true)
  })
})
