'use client'

import React, { useRef, useCallback } from 'react'
import { X, Compass } from 'lucide-react'
import type { WorkstationWithIssues } from '@/types/workstations'

interface CanvasMinimapRadarProps {
  workstations: Array<WorkstationWithIssues & { isPresent?: boolean | null }>
  zoom: number
  pan: { x: number; y: number }
  containerWidth: number
  containerHeight: number
  onPanChange: (newPan: { x: number; y: number }) => void
  onClose: () => void
}

export function CanvasMinimapRadar({
  workstations,
  zoom,
  pan,
  containerWidth,
  containerHeight,
  onPanChange,
  onClose,
}: CanvasMinimapRadarProps) {
  const radarRef = useRef<HTMLDivElement | null>(null)

  // Minimap dimensions: 176px x 99px (16:9 ratio)
  const mapW = 176
  const mapH = 99

  // In the main canvas:
  // Visible viewport in canvas coordinates:
  // X range: -pan.x / zoom to (-pan.x + containerWidth) / zoom
  // Y range: -pan.y / zoom to (-pan.y + containerHeight) / zoom
  // The full canvas has width `containerWidth` and height `containerHeight`
  const boxW = Math.min(mapW, Math.max(16, (containerWidth / (containerWidth * zoom)) * mapW))
  const boxH = Math.min(mapH, Math.max(12, (containerHeight / (containerHeight * zoom)) * mapH))

  // Box position in minimap coordinates:
  const boxX = Math.max(0, Math.min(mapW - boxW, ((-pan.x / (containerWidth * zoom)) * mapW)))
  const boxY = Math.max(0, Math.min(mapH - boxH, ((-pan.y / (containerHeight * zoom)) * mapH)))

  // Click on minimap to jump pan
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = radarRef.current?.getBoundingClientRect()
      if (!rect) return
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Map click ratio (0 to 1)
      const ratioX = clickX / mapW
      const ratioY = clickY / mapH

      // Center the viewport on this ratio
      // Target point in canvas: ratioX * containerWidth, ratioY * containerHeight
      // pan.x = containerWidth / 2 - (ratioX * containerWidth) * zoom
      const newPanX = containerWidth / 2 - ratioX * containerWidth * zoom
      const newPanY = containerHeight / 2 - ratioY * containerHeight * zoom

      onPanChange({
        x: Math.round(newPanX),
        y: Math.round(newPanY),
      })
    },
    [containerWidth, containerHeight, zoom, onPanChange]
  )

  return (
    <div className="absolute bottom-3 right-3 z-30 flex flex-col rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white/90 dark:bg-[#101726]/90 backdrop-blur-md shadow-xl p-2 select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-zinc-200 dark:border-white/[0.06] text-[10px] font-bold text-zinc-700 dark:text-slate-300">
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <Compass className="h-3 w-3" />
          <span>Floor Radar</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white p-0.5 rounded transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Radar Map Viewport */}
      <div
        ref={radarRef}
        onClick={handleMinimapClick}
        style={{ width: `${mapW}px`, height: `${mapH}px` }}
        className="relative rounded-lg bg-slate-50 dark:bg-[#0B0F19] border border-zinc-200 dark:border-white/10 overflow-hidden cursor-crosshair shadow-inner"
      >
        {/* Architectural grid micro-lines */}
        <div
          className="absolute inset-0 opacity-15 dark:opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* Workstation Micro-dots */}
        {workstations.map((ws) => {
          let dotColor = 'bg-emerald-500'
          if (ws.status === 'flagged' || (ws.active_issues?.length || 0) > 0) {
            dotColor = 'bg-rose-500'
          } else if (ws.status === 'under_repair') {
            dotColor = 'bg-amber-500'
          } else if (ws.isPresent === false) {
            dotColor = 'bg-rose-400'
          }

          return (
            <div
              key={ws.id}
              style={{
                left: `${ws.pos_x}%`,
                top: `${ws.pos_y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title={ws.label}
              className={`absolute h-1.5 w-1.5 rounded-full ${dotColor} pointer-events-none shadow-xs`}
            />
          )
        })}

        {/* Viewport Focus Bounding Box */}
        <div
          style={{
            left: `${boxX}px`,
            top: `${boxY}px`,
            width: `${boxW}px`,
            height: `${boxH}px`,
          }}
          className="absolute border border-indigo-500 bg-indigo-500/20 rounded-xs shadow-[0_0_8px_rgba(99,102,241,0.4)] pointer-events-none"
        />
      </div>
    </div>
  )
}
