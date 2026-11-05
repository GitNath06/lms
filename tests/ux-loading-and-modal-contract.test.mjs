import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Task 73: UX Loading, Skeleton & Modal Feedback Contract Verification Suite', async (t) => {
  const rootDir = process.cwd()

  // --------------------------------------------------------------------------
  // Subtest 1: Rule 3 - Purged Files & Zero INITIAL_MOCK_*
  // --------------------------------------------------------------------------
  await t.test('Rule 3: Dead mock files are permanently deleted and zero INITIAL_MOCK_* exist', async () => {
    // Assert dead files are gone
    const deadFiles = [
      'app/(dashboard)/schedules/routine-matrix.tsx',
      'lib/baseline-routines.ts',
      'lib/context/institutional-relationships.ts',
    ]

    for (const file of deadFiles) {
      const fullPath = path.resolve(rootDir, file)
      assert.equal(fs.existsSync(fullPath), false, `Deleted mock file must not exist: ${file}`)
    }

    // Scan directories for any INITIAL_MOCK_*
    const searchDirs = ['app', 'components', 'hooks', 'lib']
    const mockPattern = /INITIAL_MOCK_[A-Z_0-9]*/g

    function scanDir(dir) {
      const fullDir = path.resolve(rootDir, dir)
      if (!fs.existsSync(fullDir)) return []
      const entries = fs.readdirSync(fullDir, { withFileTypes: true })
      let matches = []
      for (const entry of entries) {
        const fullEntry = path.join(fullDir, entry.name)
        if (entry.isDirectory()) {
          matches = matches.concat(scanDir(path.join(dir, entry.name)))
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullEntry, 'utf8')
          const found = content.match(mockPattern)
          if (found) {
            matches.push({ file: path.join(dir, entry.name), matches: found })
          }
        }
      }
      return matches
    }

    let allMockMatches = []
    for (const dir of searchDirs) {
      allMockMatches = allMockMatches.concat(scanDir(dir))
    }

    assert.equal(
      allMockMatches.length,
      0,
      `Found residual INITIAL_MOCK_* references: ${JSON.stringify(allMockMatches)}`
    )
  })

  // --------------------------------------------------------------------------
  // Subtest 2: Rule 3 - lib/master-data.ts exports matchesGrade and no localStorage fallback
  // --------------------------------------------------------------------------
  await t.test('Rule 3: lib/master-data.ts correctly exports matchesGrade and has no localStorage fallbacks', async () => {
    const masterData = await import('../lib/master-data.ts')
    assert.equal(typeof masterData.matchesGrade, 'function', 'matchesGrade must be exported as a function')
    assert.equal(masterData.matchesGrade('Grade 11 Science', '11'), true)
    assert.equal(masterData.matchesGrade('Class 12 - Physics', '12'), true)
    assert.equal(masterData.matchesGrade('Class 11 - Computer', '12'), false)

    const masterDataContent = fs.readFileSync(path.resolve(rootDir, 'lib/master-data.ts'), 'utf8')
    assert.equal(
      masterDataContent.includes("localStorage.getItem('infrastructure_periods')"),
      false,
      'master-data.ts must not reference localStorage for infrastructure_periods'
    )
  })

  // --------------------------------------------------------------------------
  // Subtest 3: Rule 1 - Hooks Loading State Initialization & hasFetchedOnce
  // --------------------------------------------------------------------------
  await t.test('Rule 1: Custom hooks initialize isLoading to true and export hasFetchedOnce', async () => {
    // 1. use-logs-state.ts
    const logsHookContent = fs.readFileSync(path.resolve(rootDir, 'hooks/use-logs-state.ts'), 'utf8')
    assert.match(logsHookContent, /isLoading,\s*setIsLoading\]\s*=\s*useState<boolean>\(true\)/, 'useLogsState must initialize isLoading to true')
    assert.match(logsHookContent, /hasFetchedOnce,\s*setHasFetchedOnce\]\s*=\s*useState<boolean>\(false\)/, 'useLogsState must initialize hasFetchedOnce to false')
    assert.match(logsHookContent, /hasFetchedOnce/, 'useLogsState must export hasFetchedOnce')

    // 2. use-routine-state.ts
    const routineHookContent = fs.readFileSync(path.resolve(rootDir, 'hooks/use-routine-state.ts'), 'utf8')
    assert.match(routineHookContent, /isLoading,\s*setIsLoading\]\s*=\s*useState<boolean>\(true\)/, 'useRoutineState must initialize isLoading to true')
    assert.match(routineHookContent, /hasFetchedOnce,\s*setHasFetchedOnce\]\s*=\s*useState<boolean>\(false\)/, 'useRoutineState must initialize hasFetchedOnce to false')
    assert.match(routineHookContent, /hasFetchedOnce/, 'useRoutineState must export hasFetchedOnce')

    // 3. use-incident-state.ts
    const incidentHookContent = fs.readFileSync(path.resolve(rootDir, 'hooks/use-incident-state.ts'), 'utf8')
    assert.match(incidentHookContent, /isLoading,\s*setIsLoading\]\s*=\s*useState<boolean>\(true\)/, 'useIncidentState must initialize isLoading to true')
    assert.match(incidentHookContent, /hasFetchedOnce,\s*setHasFetchedOnce\]\s*=\s*useState<boolean>\(false\)/, 'useIncidentState must initialize hasFetchedOnce to false')
    assert.match(incidentHookContent, /hasFetchedOnce/, 'useIncidentState must export hasFetchedOnce')

    // 4. use-infrastructure-state.ts
    const infraHookContent = fs.readFileSync(path.resolve(rootDir, 'hooks/use-infrastructure-state.ts'), 'utf8')
    assert.match(infraHookContent, /hasFetchedOnce,\s*setHasFetchedOnce\]\s*=\s*useState<boolean>\(false\)/, 'useInfrastructureState must initialize hasFetchedOnce to false')
    assert.match(infraHookContent, /hasFetchedOnce/, 'useInfrastructureState must export hasFetchedOnce')
  })

  // --------------------------------------------------------------------------
  // Subtest 4: Rule 1 - Empty Flash Elimination in Key Views
  // --------------------------------------------------------------------------
  await t.test('Rule 1: Empty state flash is eliminated across tables and rosters', async () => {
    // 1. components/records/practical-records-table.tsx mobile stack guard
    const practicalTableContent = fs.readFileSync(path.resolve(rootDir, 'components/records/practical-records-table.tsx'), 'utf8')
    assert.match(practicalTableContent, /isLoading\s*\?[\s\S]*?animate-spin[\s\S]*?:\s*sections\.length\s*===\s*0/, 'Mobile view must be guarded by isLoading')

    // 2. components/roster/class-roster-view.tsx classes loading guard
    const rosterContent = fs.readFileSync(path.resolve(rootDir, 'components/roster/class-roster-view.tsx'), 'utf8')
    assert.match(rosterContent, /isClassesLoading[\s\S]*?Loading student rosters and classes/, 'Class roster must guard initial classes loading')
    assert.match(rosterContent, /!isClassesLoading\s*&&\s*classes\.length\s*===\s*0/, 'Empty state rendered only when not loading classes')

    // 3. app/(dashboard)/admin/page.tsx classes and subjects loading states
    const adminContent = fs.readFileSync(path.resolve(rootDir, 'app/(dashboard)/admin/page.tsx'), 'utf8')
    assert.match(adminContent, /isLoadingClasses,\s*setIsLoadingClasses\]\s*=\s*useState\(true\)/, 'Admin must initialize isLoadingClasses to true')
    assert.match(adminContent, /isLoadingSubjects,\s*setIsLoadingSubjects\]\s*=\s*useState\(true\)/, 'Admin must initialize isLoadingSubjects to true')
  })

  // --------------------------------------------------------------------------
  // Subtest 5: Rule 2 - Floating Toast Z-Index Contract (z-[100] instead of z-50)
  // --------------------------------------------------------------------------
  await t.test('Rule 2: Floating notification toasts use z-[100] to prevent modal backdrop collisions', async () => {
    const toastFiles = [
      'app/(dashboard)/admin/page.tsx',
      'app/(dashboard)/incidents/page.tsx',
      'app/(dashboard)/page.tsx',
      'components/admin/routine-manager.tsx',
      'components/computer-lab/computer-lab-workspace.tsx',
      'components/layout/notification-bell.tsx',
      'components/maintenance/maintenance-ledger-table.tsx',
      'components/records/incident-records-table.tsx',
      'components/records/practical-records-table.tsx',
    ]

    for (const relPath of toastFiles) {
      const fullPath = path.resolve(rootDir, relPath)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8')
        // Check for z-[100] near toast or fixed bottom
        const hasZ100Toast = /fixed[\s\S]{1,60}z-\[100\][\s\S]{1,120}(toast|notification|alert|Notice)/i.test(content) ||
          content.includes('z-[100]')
        assert.equal(hasZ100Toast, true, `${relPath} must use z-[100] for floating toasts/notifications`)
      }
    }
  })

  // --------------------------------------------------------------------------
  // Subtest 6: Rule 2 - Modal Submit Invariant & Loading Feedback
  // --------------------------------------------------------------------------
  await t.test('Rule 2: Modals implement isSubmitting disabled state and Loading indicators', async () => {
    // 1. app/(dashboard)/admin/page.tsx
    const adminContent = fs.readFileSync(path.resolve(rootDir, 'app/(dashboard)/admin/page.tsx'), 'utf8')
    assert.match(adminContent, /disabled=\{isSubmittingClass\}/, 'Admin class modal must disable submit button while submitting')
    assert.match(adminContent, /isSubmittingClass\s*\?[\s\S]*?Saving\.\.\./, 'Admin class modal must show Saving... when submitting')
    assert.match(adminContent, /disabled=\{isSubmittingSubject\}/, 'Admin subject modal must disable submit button while submitting')
    assert.match(adminContent, /isSubmittingSubject\s*\?[\s\S]*?Saving\.\.\./, 'Admin subject modal must show Saving... when submitting')

    // 2. components/schedules/session-action-modal.tsx
    const sessionModalContent = fs.readFileSync(path.resolve(rootDir, 'components/schedules/session-action-modal.tsx'), 'utf8')
    assert.match(sessionModalContent, /Saving\.\.\./, 'SessionActionModal must show Saving... during submission')

    // 3. components/dashboard/report-incident-modal.tsx
    const incidentModalContent = fs.readFileSync(path.resolve(rootDir, 'components/dashboard/report-incident-modal.tsx'), 'utf8')
    assert.match(incidentModalContent, /Saving\.\.\./, 'ReportIncidentModal must show Saving... during submission')

    // 4. components/maintenance/log-maintenance-modal.tsx
    const maintenanceModalContent = fs.readFileSync(path.resolve(rootDir, 'components/maintenance/log-maintenance-modal.tsx'), 'utf8')
    assert.match(maintenanceModalContent, /Saving\.\.\./, 'LogMaintenanceModal must show Saving... during submission')

    // 5. components/roster/class-roster-view.tsx
    const rosterContent = fs.readFileSync(path.resolve(rootDir, 'components/roster/class-roster-view.tsx'), 'utf8')
    assert.match(rosterContent, /isSubmittingAdd\s*\?[\s\S]*?Saving\.\.\./, 'Roster add student must show Saving...')
    assert.match(rosterContent, /isSubmittingTransfer\s*\?[\s\S]*?Saving\.\.\./, 'Roster transfer student must show Saving...')
    assert.match(rosterContent, /isSubmittingEdit\s*\?[\s\S]*?Saving\.\.\./, 'Roster edit student must show Saving...')
  })
})
