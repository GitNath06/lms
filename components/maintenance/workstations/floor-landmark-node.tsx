'use client'

import React from 'react'
import {
  Presentation,
  Tv,
  DoorOpen,
  Maximize2,
  Box,
  Archive,
  Server,
  Flame,
  Tag,
  RotateCw,
  Trash2,
} from 'lucide-react'
import type { LabFloorElementRow } from '@/types/database'
import { FLOOR_ELEMENT_CATALOG } from '@/lib/floor-elements'

interface FloorLandmarkNodeProps {
  element: LabFloorElementRow
  isLayoutMode?: boolean
  isSelected?: boolean
  onDragStart?: (e: React.PointerEvent, el: LabFloorElementRow) => void
  onRotate?: (el: LabFloorElementRow) => void
  onDelete?: (el: LabFloorElementRow) => void
  onClick?: () => void
}

function getLandmarkIcon(type: string) {
  switch (type) {
    case 'teacher_desk':
      return Presentation
    case 'whiteboard':
    case 'projector_screen':
      return Tv
    case 'door':
      return DoorOpen
    case 'window':
      return Maximize2
    case 'pillar':
      return Box
    case 'storage_rack':
      return Archive
    case 'network_rack':
      return Server
    case 'fire_extinguisher':
      return Flame
    default:
      return Tag
  }
}

export function FloorLandmarkNode({
  element,
  isLayoutMode = false,
  isSelected = false,
  onDragStart,
  onRotate,
  onDelete,
  onClick,
}: FloorLandmarkNodeProps) {
  const Icon = getLandmarkIcon(element.element_type)
  const meta = FLOOR_ELEMENT_CATALOG[element.element_type] || {
    color: '#6366F1',
    category: 'teaching',
  }

  // Visual styling variants based on landmark category & type
  const isTeaching = element.element_type === 'teacher_desk' || element.element_type === 'whiteboard' || element.element_type === 'projector_screen'
  const isDoor = element.element_type === 'door'
  const isSafety = element.element_type === 'fire_extinguisher'

  let containerStyle = 'border-slate-700/60 bg-[#151E32]/70 text-slate-300'
  let accentColor = meta.color

  if (element.element_type === 'whiteboard') {
    containerStyle = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
  } else if (element.element_type === 'teacher_desk') {
    containerStyle = 'border-indigo-500/40 bg-indigo-950/30 text-indigo-200 shadow-md'
  } else if (isDoor) {
    containerStyle = 'border-amber-500/40 bg-amber-950/20 text-amber-200'
  } else if (isSafety) {
    containerStyle = 'border-rose-500/40 bg-rose-950/30 text-rose-200'
  }

  return (
    <div
      style={{
        left: `${element.pos_x}%`,
        top: `${element.pos_y}%`,
        width: isTeaching ? 'auto' : undefined,
        transform: `translate(-50%, -50%) rotate(${element.rotation || 0}deg)`,
      }}
      onPointerDown={isLayoutMode ? (e) => onDragStart?.(e, element) : undefined}
      onClick={onClick}
      className={`group absolute select-none transition-shadow ${
        isLayoutMode
          ? 'cursor-grab active:cursor-grabbing hover:scale-105 z-20 ring-1 ring-amber-400/40'
          : 'cursor-default z-0'
      }`}
    >
      <div
        className={`relative flex items-center gap-1.5 rounded-xl border px-3 py-1.5 backdrop-blur-md shadow-xs transition-all ${containerStyle} ${
          isSelected ? 'ring-2 ring-indigo-400 border-indigo-400' : ''
        }`}
      >
        <div
          className="flex h-5 w-5 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
        >
          <Icon className="h-3 w-3" />
        </div>

        <span className="text-[10px] sm:text-xs font-bold tracking-tight whitespace-nowrap">
          {element.label}
        </span>

        {/* Layout Mode Controls: Rotate & Delete */}
        {isLayoutMode && (
          <div className="flex items-center gap-1 ml-1.5 pl-1.5 border-l border-white/10">
            {onRotate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRotate(element)
                }}
                className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white"
                title="Rotate 90°"
              >
                <RotateCw className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(element)
                }}
                className="p-1 rounded hover:bg-rose-500/20 text-rose-400 hover:text-rose-300"
                title="Remove landmark"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Coordinate pip in layout mode */}
      {isLayoutMode && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-slate-400 bg-slate-900/90 px-1 rounded whitespace-nowrap">
          {Math.round(element.pos_x)}%, {Math.round(element.pos_y)}% ({element.rotation || 0}°)
        </div>
      )}
    </div>
  )
}
