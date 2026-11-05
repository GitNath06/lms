'use client'

import React, { useState } from 'react'
import {
  Plus,
  Minus,
  RotateCcw,
  Maximize2,
  Hand,
  Compass,
  Monitor,
  Grid,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

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
  terminalScale = 1.0,
  onSetTerminalScale,
  snapGrid,
  onSetSnapGrid,
}: CanvasControlsHudProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const zoomPercent = Math.round(zoom * 100)
  const scalePercent = Math.round(terminalScale * 100)

  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5 select-none font-sans">
      {/* 1. Sleek Compact Toggle Trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        title={isExpanded ? 'Collapse Canvas Controls Dock' : 'Expand Canvas Controls Dock'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-[#101726]/90 border border-zinc-200 dark:border-white/[0.08] shadow-md backdrop-blur-md text-zinc-700 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        <span className="text-[11px] font-mono font-extrabold tabular-nums">
          {zoomPercent}%
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 text-zinc-400" />
        ) : (
          <ChevronDown className="h-3 w-3 text-zinc-400" />
        )}
      </button>

      {/* 2. Collapsible Vertical Control Strip */}
      {isExpanded && (
        <div className="flex flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-[#101726]/95 border border-zinc-200 dark:border-white/[0.08] shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Zoom Section */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onZoomIn}
              title="Zoom In (Ctrl +)"
              aria-label="Zoom In"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onResetZoom}
              title="Click to reset zoom to 100%"
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold text-zinc-800 dark:text-slate-200 hover:bg-zinc-100 dark:hover:bg-white/5 tabular-nums transition-colors cursor-pointer"
            >
              {zoomPercent}%
            </button>

            <button
              type="button"
              onClick={onZoomOut}
              title="Zoom Out (Ctrl -)"
              aria-label="Zoom Out"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-px w-6 bg-zinc-200 dark:bg-white/10" />

          {/* Fit & 1:1 Reset */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onFitToScreen}
              title="Fit entire floor to screen"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onResetZoom}
              title="Reset view to 1:1 (100%)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-px w-6 bg-zinc-200 dark:bg-white/10" />

          {/* Pan & Radar Tools */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onTogglePanTool}
              title={isPanToolActive ? 'Disable Pan Tool' : 'Enable Pan Tool (Space+Drag)'}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                isPanToolActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleMinimap}
              title={isMinimapVisible ? 'Hide Minimap Radar' : 'Show Minimap Radar'}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                isMinimapVisible
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30'
                  : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Variable PC Node Size Stepper (75% to 130%, step 5%) */}
          {onSetTerminalScale && (
            <>
              <div className="h-px w-6 bg-zinc-200 dark:bg-white/10" />
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <span
                  className="flex items-center justify-center text-zinc-500 dark:text-slate-400"
                  title="PC Card Display Scale (75% to 130%)"
                >
                  <Monitor className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onSetTerminalScale(
                      Math.min(1.3, Math.round((terminalScale + 0.05) * 100) / 100)
                    )
                  }
                  disabled={terminalScale >= 1.3}
                  title="Increase PC Card Size (+5%)"
                  className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>

                <span className="font-mono text-[9px] font-bold text-zinc-700 dark:text-slate-300 tabular-nums">
                  {scalePercent}%
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onSetTerminalScale(
                      Math.max(0.75, Math.round((terminalScale - 0.05) * 100) / 100)
                    )
                  }
                  disabled={terminalScale <= 0.75}
                  title="Decrease PC Card Size (-5%)"
                  className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            </>
          )}

          {/* Optional Snap Grid Selector */}
          {snapGrid !== undefined && onSetSnapGrid && (
            <>
              <div className="h-px w-6 bg-zinc-200 dark:bg-white/10" />
              <div className="flex flex-col items-center gap-1">
                <span
                  className="text-zinc-500 dark:text-slate-400"
                  title="Snap to Grid"
                >
                  <Grid className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                </span>
                {[0, 2, 4].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onSetSnapGrid(g)}
                    className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                      snapGrid === g
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {g === 0 ? 'Off' : `${g}%`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
