import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Native environment variables loader
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}
process.env.LABSYNC_TEST_RUNNER = 'true'

test('Admin Console Configurable Options Management Test Suite', async (t) => {
  const {
    getMaintenanceRoutineTemplates,
    saveMaintenanceRoutineTemplate,
    deleteMaintenanceRoutineTemplate,
    reorderMaintenanceRoutineTemplates,
  } = await import('../app/actions/maintenance-templates.ts')

  const {
    getIssueCategories,
    manageIssueCategory,
    reorderIssueCategories,
  } = await import('../app/actions/workstations.ts')

  let createdTemplateId = null
  let createdCategoryId = null

  await t.test('1. getMaintenanceRoutineTemplates: Retrieves seeded institutional templates with parsed checklists', async () => {
    const res = await getMaintenanceRoutineTemplates()
    assert.equal(res.success, true, 'Querying routine templates should succeed')
    assert.ok(Array.isArray(res.data), 'Templates should be returned as an array')
    assert.ok(res.data.length >= 6, 'Should have at least 6 seeded templates')

    const biosTemplate = res.data.find((t) => t.title.toLowerCase().includes('bios'))
    assert.ok(biosTemplate, 'Should contain BIOS update template')
    assert.ok(Array.isArray(biosTemplate.checklist), 'Checklist should be an array')
    assert.ok(biosTemplate.checklist.length > 0, 'Checklist should contain steps')
  })

  await t.test('2. getMaintenanceRoutineTemplates: Filters templates by laboratory facility code', async () => {
    const compRes = await getMaintenanceRoutineTemplates('comp')
    assert.equal(compRes.success, true)
    assert.ok(compRes.data.every((t) => t.lab_id === 'comp' || t.lab_id === 'all'))
  })

  await t.test('3. saveMaintenanceRoutineTemplate: Creates new template with jsonb checklist', async () => {
    const newTemplate = {
      title: 'Network Switch Air Filter Clean',
      lab_id: 'comp',
      cadence: 'biweekly',
      interval_days: 14,
      severity: 'routine',
      category: 'Network Infrastructure',
      checklist: ['Power off switch auxiliary fans', 'Vacuum intake mesh', 'Inspect RJ45 patch cables'],
      sort_order: 99,
    }

    const createRes = await saveMaintenanceRoutineTemplate(newTemplate)
    assert.equal(createRes.success, true, `Failed to create template: ${createRes.error}`)
    assert.ok(createRes.data?.id, 'Created template should have a UUID')
    createdTemplateId = createRes.data.id
    assert.equal(createRes.data.title, newTemplate.title)
    assert.equal(createRes.data.interval_days, 14)
  })

  await t.test('4. saveMaintenanceRoutineTemplate: Updates existing template attributes', async () => {
    assert.ok(createdTemplateId, 'Template ID must exist for update test')

    const updateRes = await saveMaintenanceRoutineTemplate({
      id: createdTemplateId,
      title: 'Network Switch Air Filter & Cable Tidy',
      lab_id: 'comp',
      cadence: 'monthly',
      interval_days: 30,
      severity: 'critical',
      category: 'Network Care',
      checklist: ['Updated step 1', 'Updated step 2'],
    })

    assert.equal(updateRes.success, true, `Failed to update template: ${updateRes.error}`)
    assert.equal(updateRes.data?.title, 'Network Switch Air Filter & Cable Tidy')
    assert.equal(updateRes.data?.interval_days, 30)
    assert.equal(updateRes.data?.severity, 'critical')
  })

  await t.test('5. reorderMaintenanceRoutineTemplates: Updates sort order sequence', async () => {
    assert.ok(createdTemplateId, 'Template ID must exist for reorder test')

    const reorderRes = await reorderMaintenanceRoutineTemplates([
      { id: createdTemplateId, sort_order: 1 },
    ])
    assert.equal(reorderRes.success, true, `Failed to reorder templates: ${reorderRes.error}`)

    const listRes = await getMaintenanceRoutineTemplates()
    const updated = listRes.data.find((t) => t.id === createdTemplateId)
    assert.equal(updated?.sort_order, 1, 'Sort order should be updated to 1')
  })

  await t.test('6. deleteMaintenanceRoutineTemplate: Soft-deletes template (is_active = false)', async () => {
    assert.ok(createdTemplateId, 'Template ID must exist for delete test')

    const deleteRes = await deleteMaintenanceRoutineTemplate(createdTemplateId)
    assert.equal(deleteRes.success, true, `Failed to delete template: ${deleteRes.error}`)

    const listRes = await getMaintenanceRoutineTemplates()
    const found = listRes.data.find((t) => t.id === createdTemplateId)
    assert.equal(found, undefined, 'Soft-deleted template should not be returned in active list')
  })

  await t.test('7. getIssueCategories: Retrieves active fault categories with default_severity', async () => {
    const res = await getIssueCategories()
    assert.equal(res.success, true, 'Querying issue categories should succeed')
    assert.ok(Array.isArray(res.data), 'Categories should be an array')
    assert.ok(res.data.length >= 5, 'Should have initial active fault categories')

    const bootCategory = res.data.find((c) => c.name.toLowerCase().includes('boot'))
    assert.ok(bootCategory, 'Should contain OS boot failure category')
    assert.ok(bootCategory.default_severity, 'Category must have default_severity')
  })

  await t.test('8. manageIssueCategory: Creates and updates issue category', async () => {
    const createRes = await manageIssueCategory('create', {
      name: 'GPU Driver Artifacting',
      type: 'hardware',
      color: '#8b5cf6',
      icon: 'Monitor',
      default_severity: 'high',
      sort_order: 88,
    })

    assert.equal(createRes.success, true, `Failed to create issue category: ${createRes.error}`)
    assert.ok(createRes.data?.id, 'Category should have an ID')
    createdCategoryId = createRes.data.id

    // Update the category
    const updateRes = await manageIssueCategory('update', {
      id: createdCategoryId,
      name: 'GPU Thermal Throttling / Artifacting',
      color: '#ec4899',
      default_severity: 'critical',
    })

    assert.equal(updateRes.success, true, `Failed to update category: ${updateRes.error}`)
    assert.equal(updateRes.data?.name, 'GPU Thermal Throttling / Artifacting')
    assert.equal(updateRes.data?.default_severity, 'critical')
  })

  await t.test('9. reorderIssueCategories: Updates category sort ordering', async () => {
    assert.ok(createdCategoryId, 'Category ID must exist for reorder test')

    const reorderRes = await reorderIssueCategories([
      { id: createdCategoryId, sort_order: 1 },
    ])
    assert.equal(reorderRes.success, true, `Failed to reorder categories: ${reorderRes.error}`)

    const listRes = await getIssueCategories()
    const updated = listRes.data.find((c) => c.id === createdCategoryId)
    assert.equal(updated?.sort_order, 1, 'Sort order should be updated')
  })

  await t.test('10. manageIssueCategory (deactivate): Soft-archives issue category', async () => {
    assert.ok(createdCategoryId, 'Category ID must exist for deactivate test')

    const deleteRes = await manageIssueCategory('delete', {
      id: createdCategoryId,
    })
    assert.equal(deleteRes.success, true, `Failed to deactivate category: ${deleteRes.error}`)

    const activeList = await getIssueCategories()
    const found = activeList.data.find((c) => c.id === createdCategoryId)
    assert.equal(found, undefined, 'Deactivated category should not appear in active category list')
  })

  await t.test('11. Rule #1 Compliance: Zero literal "+" in button text across managers', () => {
    const filesToCheck = [
      'components/admin/maintenance-template-manager.tsx',
      'components/admin/workstation-fault-categories-manager.tsx',
      'components/admin/maintenance-routines-manager.tsx',
      'components/maintenance/create-plan-modal.tsx',
      'components/computer-lab/station-quick-popover.tsx',
    ]

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath)
      const content = fs.readFileSync(fullPath, 'utf8')

      const literalPlusMatches = content.match(/>\s*\+\s*[A-Za-z]/g)
      assert.equal(
        literalPlusMatches,
        null,
        `File ${relPath} contains prohibited literal '+' in button/action label: ${literalPlusMatches}`
      )
    }
  })

  await t.test('12. Rule #3 Compliance: Precaution Active safety lock guards mutations', () => {
    const templateMgrContent = fs.readFileSync(
      path.resolve(process.cwd(), 'components/admin/maintenance-template-manager.tsx'),
      'utf8'
    )
    assert.ok(
      templateMgrContent.includes('isEditModeUnlocked') &&
      templateMgrContent.includes('Precaution Active'),
      'MaintenanceTemplateManager must enforce Precaution Active safety lock'
    )

    const faultMgrContent = fs.readFileSync(
      path.resolve(process.cwd(), 'components/admin/workstation-fault-categories-manager.tsx'),
      'utf8'
    )
    assert.ok(
      faultMgrContent.includes('isEditModeUnlocked') &&
      faultMgrContent.includes('Precaution Active'),
      'WorkstationFaultCategoriesManager must enforce Precaution Active safety lock'
    )
  })

  await t.test('13. Dynamic Options Architecture: Dynamic props & queries wired into UI components', () => {
    const popoverContent = fs.readFileSync(
      path.resolve(process.cwd(), 'components/computer-lab/station-quick-popover.tsx'),
      'utf8'
    )
    assert.ok(
      popoverContent.includes('categories?: IssueCategoryRow[]'),
      'StationQuickPopover must accept dynamic categories prop'
    )
    assert.ok(
      popoverContent.includes('faultOptions'),
      'StationQuickPopover must calculate dynamic faultOptions'
    )

    const createPlanContent = fs.readFileSync(
      path.resolve(process.cwd(), 'components/maintenance/create-plan-modal.tsx'),
      'utf8'
    )
    assert.ok(
      createPlanContent.includes('getMaintenanceRoutineTemplates'),
      'CreatePlanModal must load dynamic routine presets'
    )
  })
})
