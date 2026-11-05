import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  cleanSubjectTitle,
  formatSubjectHeading,
  computeMultiPeriodLabel,
  formatClassBatchLabel,
} from '../lib/master-data.ts'

test('Practical Log Form & Subject Clean Display Suite', async (t) => {
  await t.test('1. cleanSubjectTitle strips redundant subject code prefixes', () => {
    assert.equal(
      cleanSubjectTitle('BIO-12', 'BIO-12 – Cell Biology & Genetics Lab'),
      'Cell Biology & Genetics Lab'
    )
    assert.equal(
      cleanSubjectTitle('BIO-12', 'BIO-12 - Cell Biology & Genetics Lab'),
      'Cell Biology & Genetics Lab'
    )
    assert.equal(
      cleanSubjectTitle('BIO-12', 'BIO-12 — Cell Biology & Genetics Lab'),
      'Cell Biology & Genetics Lab'
    )
    assert.equal(
      cleanSubjectTitle('COMP-12', 'COMP-12: Data Structures Lab'),
      'Data Structures Lab'
    )
    assert.equal(
      cleanSubjectTitle('BIO-12', 'Cell Biology & Genetics Lab'),
      'Cell Biology & Genetics Lab'
    )
  })

  await t.test('2. formatSubjectHeading formats clean non-repeating headings', () => {
    assert.equal(
      formatSubjectHeading('BIO-12', 'BIO-12 – Cell Biology & Genetics Lab'),
      'BIO-12 — Cell Biology & Genetics Lab'
    )
    assert.equal(
      formatSubjectHeading('BIO-12', 'Cell Biology & Genetics Lab'),
      'BIO-12 — Cell Biology & Genetics Lab'
    )
    assert.equal(
      formatSubjectHeading('COMP-12', 'Data Structures & Algorithms Lab'),
      'COMP-12 — Data Structures & Algorithms Lab'
    )
    assert.equal(
      formatSubjectHeading('BIO-12', 'BIO-12'),
      'BIO-12'
    )
  })

  await t.test('3. computeMultiPeriodLabel computes single period dynamically from slot list', () => {
    const mockSlots = [
      { id: 't1', name: 'Period 1', label: '10:00 - 10:45 AM' },
      { id: 't2', name: 'Period 2', label: '10:45 - 11:30 AM' },
      { id: 't3', name: 'Period 3', label: '11:30 - 12:15 PM' },
    ]
    const p1 = computeMultiPeriodLabel(['t1'], mockSlots)
    assert.equal(p1.timeRange, '10:00 - 10:45 AM')
    assert.equal(p1.label, 'Period 1 (10:00 - 10:45 AM)')

    const p2 = computeMultiPeriodLabel(['t2'], mockSlots)
    assert.equal(p2.timeRange, '10:45 - 11:30 AM')

    const p1p2 = computeMultiPeriodLabel(['t1', 't2'], mockSlots)
    assert.equal(p1p2.timeRange, '10:00 - 11:30 AM')
  })

  await t.test('4. log-form.tsx contains zero hardcoded absent rolls, mock topics, or remarks', () => {
    const logFormPath = path.resolve('app/(dashboard)/records/new/log-form.tsx')
    const content = fs.readFileSync(logFormPath, 'utf8')

    // Must not have [14, 28] as default absent rolls
    assert.equal(content.includes('useState<number[]>([14, 28])'), false)
    assert.equal(content.includes('useState<number[]>([])'), true)

    // Must not have absent count default to 2
    assert.equal(content.includes('useState<number>(2)'), false)

    // Must not have hardcoded binary search tree topic or mock remarks as values
    assert.equal(content.includes("initialSub.defaultTopic || 'Verification of Binary Search Tree"), false)
    assert.equal(content.includes("'Workstations functioning normally. Equipment cleaned and restored after practical.'"), false)

    // Must start practicalTitle and remarks as empty strings
    assert.equal(content.includes("const [practicalTitle, setPracticalTitle] = useState<string>('')"), true)
    assert.equal(content.includes("const [remarks, setRemarks] = useState<string>('')"), true)

    // Default periods must be single period ['t1']
    assert.equal(content.includes("const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['t1'])"), true)
  })

  await t.test('5. formatClassBatchLabel strictly outputs clean grade and section with zero "Section" word and zero fake capacity', () => {
    // 1. Where name already contains section
    assert.equal(formatClassBatchLabel({ name: '12 Eng', section: 'Eng' }), '12 Eng')
    assert.equal(formatClassBatchLabel({ name: '12 Mgt', section: 'Mgt' }), '12 Mgt')
    assert.equal(formatClassBatchLabel({ name: '11 Eng', section: 'Eng' }), '11 Eng')
    assert.equal(formatClassBatchLabel({ name: '8A', section: 'A' }), '8A')
    assert.equal(formatClassBatchLabel({ name: '7B', section: 'B' }), '7B')

    // 2. Where name is just grade and section is separate
    assert.equal(formatClassBatchLabel({ name: '12', section: 'Eng' }), '12 Eng')
    assert.equal(formatClassBatchLabel({ name: '8', section: 'A' }), '8 A')

    // 3. Where section has "Section" or "Sec" prefix - must be stripped
    assert.equal(formatClassBatchLabel({ name: '12', section: 'Section Eng' }), '12 Eng')
    assert.equal(formatClassBatchLabel({ name: '11', section: 'Sec B' }), '11 B')

    // 4. Missing inputs handled gracefully
    assert.equal(formatClassBatchLabel({ name: '10 Eng', section: null }), '10 Eng')
    assert.equal(formatClassBatchLabel(null), '')
  })

  await t.test('6. log-form.tsx dropdown does not display deceptive capacity counts or stream names', () => {
    const logFormPath = path.resolve('app/(dashboard)/records/new/log-form.tsx')
    const content = fs.readFileSync(logFormPath, 'utf8')

    // Must not have deceptive capacity pattern like ({c.capacity || c.strength || 36} Students)
    assert.equal(content.includes(' Students)'), false)
    assert.equal(content.includes('c.stream ?'), false)

    // Must use formatClassBatchLabel(c) for options
    assert.equal(content.includes('{formatClassBatchLabel(c)}'), true)
  })

  await t.test('7. log-form.tsx strictly uses NepaliDatePicker for session date and eliminates native type="date"', () => {
    const logFormPath = path.resolve('app/(dashboard)/records/new/log-form.tsx')
    const logFormContent = fs.readFileSync(logFormPath, 'utf8')

    // Must import and render NepaliDatePicker
    assert.equal(logFormContent.includes("import { NepaliDatePicker } from '@/components/ui/nepali-date-picker'"), true)
    assert.equal(logFormContent.includes('<NepaliDatePicker'), true)

    // Must have zero instances of native type="date"
    assert.equal(logFormContent.includes('type="date"'), false)

    const incidentsPath = path.resolve('app/(dashboard)/incidents/page.tsx')
    const incidentsContent = fs.readFileSync(incidentsPath, 'utf8')
    assert.equal(incidentsContent.includes('type="date"'), false)
    assert.equal(incidentsContent.includes('<NepaliDatePicker'), true)
  })
})
