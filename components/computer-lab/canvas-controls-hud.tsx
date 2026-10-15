'use client'

import React from 'react'
import {
  Plus,
  Minus,
  RotateCcw,
  Maximize2,
  Hand,
  Compass,
  Monitor,
  Grid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CanvasControlsHudProps {
  zoom: number
  isPanToolActive: boolean
  isMinimapVisible: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onFitToScreen: () => void
  onTogglePanTool: () => void
  onToggleMinimap: () => void
  terminalScale?: number
  onSetTerminalScale?: (scale: number) => void
  snapGrid?: number
  onSetSnapGrid?: (grid: number) => void
}

export function CanvasControlsHud({
  zoom,
  isPanToolActive,
  isMinimapVisible,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  onTogglePanTool,
  onToggleMinimap,
  terminalScale,
  onSetTerminalScale,
  snapGrid,
  onSetSnapGrid,
}: CanvasControlsHudProps) {
  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="absolute top-3 right-3 z-30 flex items-center gap-1 p-1 rounded-xl bg-[#101726]/90 border border-white/[0.08] shadow-xl backdrop-blur-md select-none">
      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom Out (Ctrl -)"
        aria-label="Zoom Out"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      {/* Dynamic Zoom Percentage Pill */}
      <button
        type="button"
        onClick={onResetZoom}
        title="Click to reset to 100%"
        className="px-2 py-0.5 rounded-lg text-[11px] font-heading font-extrabold text-slate-200 hover:text-white hover:bg-white/5 tabular-nums transition-colors"
      >
        {zoomPercent}%
      </button>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom In (Ctrl +)"
        aria-label="Zoom In"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Fit to Screen */}
      <button
        type="button"
        onClick={onFitToScreen}
        title="Fit floor to screen"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Maximize2 className="h-3 w-3" />
        <span className="hidden sm:inline">Fit</span>
      </button>

      {/* Reset 1:1 */}
      <button
        type="button"
        onClick={onResetZoom}
        title="Reset zoom to 100%"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        <span className="hidden sm:inline">1:1</span>
      </button>

      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Pan Tool Toggle */}
      <button
        type="button"
        onClick={onTogglePanTool}
        title={isPanToolActive ? 'Disable Pan Tool (Space+Drag)' : 'Enable Pan Tool'}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
          isPanToolActive
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-slate-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <Hand className="h-3 w-3" />
        <span className="hidden sm:inline">Pan</span>
      </button>

      {/* Minimap Toggle */}
      <button
        type="button"
        onClick={onToggleMinimap}
        title={isMinimapVisible ? 'Hide Minimap Radar' : 'Show Minimap Radar'}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
          isMinimapVisible
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            : 'text-slate-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <Compass className="h-3 w-3" />
        <span className="hidden sm:inline">Radar</span>
      </button>

      {/* Optional Terminal Scale Selector inside HUD */}
      {terminalScale !== undefined && onSetTerminalScale && (
        <>
          <div className="h-4 w-px bg-white/10 mx-0.5" />
          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/5 text-[10px]">
            <span className="px-1 text-slate-400 font-semibold flex items-center gap-1" title="Terminal Node Size Scale">
              <Monitor className="h-3 w-3 text-indigo-400" />
            </span>
            {[
              { label: '80%', val: 0.8 },
              { label: '100%', val: 1.0 },
              { label: '120%', val: 1.2 },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onSetTerminalScale(s.val)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  terminalScale === s.val
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Optional Snap Grid Selector inside HUD */}
      {snapGrid !== undefined && onSetSnapGrid && (
        <>
          <div className="h-4 w-px bg-white/10 mx-0.5" />
          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/5 text-[10px]">
            <span className="px-1 text-slate-400 font-semibold flex items-center gap-1" title="Snap to Grid (2% or 4%)">
              <Grid className="h-3 w-3 text-indigo-400" />
            </span>
            {[0, 2, 4].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onSetSnapGrid(g)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  snapGrid === g
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {g === 0 ? 'Off' : `${g}%`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
