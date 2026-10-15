import type { LabFloorElementRow } from '@/types/database'

export interface FloorElementDefinition {
  type: string
  label: string
  defaultWidth: number
  defaultHeight: number
  icon: string
  category: 'teaching' | 'boundary' | 'storage' | 'safety' | 'infrastructure'
  color: string
}

export const FLOOR_ELEMENT_CATALOG: Record<string, FloorElementDefinition> = {
  teacher_desk: {
    type: 'teacher_desk',
    label: 'Teacher Podium / Master Console',
    defaultWidth: 16.0,
    defaultHeight: 6.0,
    icon: 'Presentation',
    category: 'teaching',
    color: '#6366F1', // Indigo
  },
  whiteboard: {
    type: 'whiteboard',
    label: 'Interactive Whiteboard',
    defaultWidth: 32.0,
    defaultHeight: 3.5,
    icon: 'Square',
    category: 'teaching',
    color: '#10B981', // Emerald
  },
  projector_screen: {
    type: 'projector_screen',
    label: 'Projector Screen',
    defaultWidth: 24.0,
    defaultHeight: 3.0,
    icon: 'Tv',
    category: 'teaching',
    color: '#3B82F6', // Blue
  },
  door: {
    type: 'door',
    label: 'Corridor Entrance Door',
    defaultWidth: 6.0,
    defaultHeight: 10.0,
    icon: 'DoorOpen',
    category: 'boundary',
    color: '#F59E0B', // Amber
  },
  window: {
    type: 'window',
    label: 'Ventilation Window',
    defaultWidth: 14.0,
    defaultHeight: 2.5,
    icon: 'Maximize2',
    category: 'boundary',
    color: '#06B6D4', // Cyan
  },
  pillar: {
    type: 'pillar',
    label: 'Structural Concrete Pillar',
    defaultWidth: 5.0,
    defaultHeight: 5.0,
    icon: 'Box',
    category: 'infrastructure',
    color: '#64748B', // Slate
  },
  storage_rack: {
    type: 'storage_rack',
    label: 'Hardware Storage Rack',
    defaultWidth: 12.0,
    defaultHeight: 8.0,
    icon: 'Archive',
    category: 'storage',
    color: '#8B5CF6', // Purple
  },
  network_rack: {
    type: 'network_rack',
    label: 'Network Switch & Server Rack',
    defaultWidth: 8.0,
    defaultHeight: 8.0,
    icon: 'Server',
    category: 'infrastructure',
    color: '#EC4899', // Pink
  },
  fire_extinguisher: {
    type: 'fire_extinguisher',
    label: 'CO2 Fire Extinguisher Station',
    defaultWidth: 4.0,
    defaultHeight: 4.0,
    icon: 'Flame',
    category: 'safety',
    color: '#EF4444', // Red
  },
  custom_label: {
    type: 'custom_label',
    label: 'Floor Marker / Label',
    defaultWidth: 10.0,
    defaultHeight: 4.0,
    icon: 'Tag',
    category: 'infrastructure',
    color: '#94A3B8', // Gray
  },
}

export interface LabFloorElementInput {
  id?: string
  lab_id: string
  element_type: string
  label: string
  pos_x: number
  pos_y: number
  width?: number
  height?: number
  rotation?: number
  metadata?: Record<string, any>
  is_active?: boolean
}

/**
 * Validates coordinate bounds: must be between 0.0 and 100.0 percentage.
 */
export function validateFloorCoordinates(x: number, y: number): boolean {
  return typeof x === 'number' && !isNaN(x) && x >= 0 && x <= 100 &&
         typeof y === 'number' && !isNaN(y) && y >= 0 && y <= 100
}

/**
 * Clamps coordinates safely inside canvas borders
 */
export function clampFloorCoordinates(x: number, y: number, min = 0, max = 100): { x: number; y: number } {
  const clampedX = Math.max(min, Math.min(max, Math.round(x * 10) / 10))
  const clampedY = Math.max(min, Math.min(max, Math.round(y * 10) / 10))
  return { x: clampedX, y: clampedY }
}
