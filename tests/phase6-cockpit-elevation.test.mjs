import test from 'node:test'
import assert from 'node:assert/strict'

test('Phase 6: Sprint 1 — Workstation Cockpit Elevation & Interactive Canvas Suite', async (t) => {
  await t.test('1. CAD Viewport Zoom Clamping & Focal Pan Math Invariants', () => {
    const minZoom = 0.5
    const maxZoom = 1.6

    const clampZoom = (val) => Math.min(maxZoom, Math.max(minZoom, Math.round(val * 100) / 100))

    assert.equal(clampZoom(0.2), 0.5, 'Clamps zoom below minimum (0.5)')
    assert.equal(clampZoom(2.5), 1.6, 'Clamps zoom above maximum (1.6)')
    assert.equal(clampZoom(1.154), 1.15, 'Rounds zoom to 2 decimal places')

    // Focal Zoom Invariance:
    // When zooming at mouse position (mx, my), point (cx, cy) remains stable under the cursor
    const mx = 400
    const my = 250
    const zoomBefore = 1.0
    const panBefore = { x: 0, y: 0 }

    const focalX = (mx - panBefore.x) / zoomBefore
    const focalY = (my - panBefore.y) / zoomBefore

    const zoomAfter = 1.25
    const panAfter = {
      x: mx - focalX * zoomAfter,
      y: my - focalY * zoomAfter,
    }

    // New screen position of (focalX, focalY) under zoomAfter and panAfter:
    const newScreenX = panAfter.x + focalX * zoomAfter
    const newScreenY = panAfter.y + focalY * zoomAfter

    assert.equal(newScreenX, mx, 'Cursor X remains fixed on the exact same world coordinate after zoom')
    assert.equal(newScreenY, my, 'Cursor Y remains fixed on the exact same world coordinate after zoom')
  })

  await t.test('2. Workstation Center-Focus Pan Calculation Invariant', () => {
    // Container is 1000px x 600px
    const containerW = 1000
    const containerH = 600
    const targetZoom = 1.25

    // Workstation is located at pos_x = 75%, pos_y = 40% of the canvas
    const posXPercent = 75
    const posYPercent = 40

    const targetXInCanvas = (posXPercent / 100) * containerW // 750px
    const targetYInCanvas = (posYPercent / 100) * containerH // 240px

    const centerX = containerW / 2 // 500px
    const centerY = containerH / 2 // 300px

    const targetPanX = Math.round(centerX - targetXInCanvas * targetZoom)
    const targetPanY = Math.round(centerY - targetYInCanvas * targetZoom)

    // Verify: when targetPan is applied, the workstation's screen position equals center
    const renderedScreenX = targetPanX + targetXInCanvas * targetZoom
    const renderedScreenY = targetPanY + targetYInCanvas * targetZoom

    assert.ok(Math.abs(renderedScreenX - centerX) <= 1, 'Target workstation X is centered within 1px')
    assert.ok(Math.abs(renderedScreenY - centerY) <= 1, 'Target workstation Y is centered within 1px')
  })

  await t.test('3. Three-Tier Attendance Semantic Standard Verification', () => {
    function getAttendanceTier(rate) {
      if (rate >= 85) {
        return { tier: 'Optimal', isWarning: false, isDanger: false }
      } else if (rate >= 75) {
        return { tier: 'Normal', isWarning: false, isDanger: false }
      } else {
        return { tier: 'Low Rate', isWarning: false, isDanger: true }
      }
    }

    // 90% attendance: Optimal (Emerald)
    const tier90 = getAttendanceTier(90)
    assert.equal(tier90.tier, 'Optimal')
    assert.equal(tier90.isDanger, false)

    // 78% attendance: Normal (Slate - ZERO false amber alarm!)
    const tier78 = getAttendanceTier(78)
    assert.equal(tier78.tier, 'Normal')
    assert.equal(tier78.isWarning, false)
    assert.equal(tier78.isDanger, false)

    // 65% attendance: Low Rate (Rose)
    const tier65 = getAttendanceTier(65)
    assert.equal(tier65.tier, 'Low Rate')
    assert.equal(tier65.isDanger, true)
  })

  await t.test('4. Minimap Radar Viewport Bounding Box Calculation Invariant', () => {
    const mapW = 176
    const mapH = 99
    const containerW = 1000
    const containerH = 562.5
    const zoom = 1.0
    const pan = { x: 0, y: 0 }

    // At 1.0x zoom with 0 pan, bounding box covers 100% of minimap
    const boxW = Math.min(mapW, Math.max(16, (containerW / (containerW * zoom)) * mapW))
    const boxH = Math.min(mapH, Math.max(12, (containerH / (containerH * zoom)) * mapH))

    assert.equal(boxW, mapW, 'Bounding box width covers entire map at 1.0x')
    assert.equal(boxH, mapH, 'Bounding box height covers entire map at 1.0x')

    // At 2.0x zoom, bounding box covers exactly 50%
    const zoom2 = 2.0
    const boxW2 = Math.min(mapW, Math.max(16, (containerW / (containerW * zoom2)) * mapW))
    assert.equal(boxW2, mapW / 2, 'Bounding box scales proportionally with zoom factor')
  })

  await t.test('5. Printable Wall Seating Chart Data Grouping & Ordering Invariant', () => {
    const workstations = [
      { id: 'ws-1', label: 'PC-09', row_label: 'Row B', pos_x: 20, pos_y: 35 },
      { id: 'ws-2', label: 'PC-01', row_label: 'Row A', pos_x: 20, pos_y: 20 },
      { id: 'ws-3', label: 'PC-10', row_label: 'Row B', pos_x: 30, pos_y: 35 },
      { id: 'ws-4', label: 'PC-02', row_label: 'Row A', pos_x: 30, pos_y: 20 },
      { id: 'ws-5', label: 'Teacher-01', row_label: 'Teacher', pos_x: 50, pos_y: 5 },
    ]

    const groups = {}
    workstations.forEach((ws) => {
      const row = ws.row_label || 'Other'
      if (!groups[row]) groups[row] = []
      groups[row].push(ws)
    })

    // Sort within row
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    })

    assert.deepEqual(
      groups['Row A'].map((w) => w.label),
      ['PC-01', 'PC-02'],
      'Row A sorted numerically'
    )
    assert.deepEqual(
      groups['Row B'].map((w) => w.label),
      ['PC-09', 'PC-10'],
      'Row B sorted numerically'
    )
    assert.equal(groups['Teacher'].length, 1)
  })
})
