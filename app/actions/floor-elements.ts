'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import type { LabFloorElementRow } from '@/types/database'
import type { LabFloorElementInput } from '@/lib/floor-elements'
import { validateFloorCoordinates, clampFloorCoordinates } from '@/lib/floor-elements'

export type { LabFloorElementRow, LabFloorElementInput }

/**
 * Returns all active physical floor landmarks (whiteboards, doors, podiums, racks) for a room.
 */
export async function getLabFloorElements(
  labId: string
): Promise<{ success: boolean; data: LabFloorElementRow[]; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged && !scope.assignedLabIds.includes(labId)) {
      return { success: false, data: [], error: 'Access denied: You do not have permission to view this lab floor layout.' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lab_floor_elements')
      .select('*')
      .eq('lab_id', labId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching lab floor elements:', error)
      return { success: false, data: [], error: 'Failed to retrieve floor landmarks.' }
    }

    return { success: true, data: (data || []) as LabFloorElementRow[] }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, data: [], error: msg }
  }
}

/**
 * Saves/updates physical floor landmarks in batch. Privileged users only.
 */
export async function saveLabFloorElements(
  labId: string,
  elements: LabFloorElementInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return { success: false, error: 'Access denied: Only administrators can modify physical room landmarks.' }
    }

    // Validate coordinates
    for (const el of elements) {
      if (!validateFloorCoordinates(el.pos_x, el.pos_y)) {
        return { success: false, error: `Invalid coordinates for landmark "${el.label}": positions must be between 0% and 100%.` }
      }
    }

    const supabase = await createClient()

    // Upsert elements
    for (const el of elements) {
      const { x, y } = clampFloorCoordinates(el.pos_x, el.pos_y)

      if (el.id) {
        await supabase
          .from('lab_floor_elements')
          .update({
            element_type: el.element_type,
            label: el.label.trim(),
            pos_x: x,
            pos_y: y,
            width: el.width || 12.0,
            height: el.height || 4.0,
            rotation: el.rotation || 0,
            metadata: el.metadata || {},
            is_active: el.is_active !== undefined ? el.is_active : true,
          })
          .eq('id', el.id)
      } else {
        await supabase
          .from('lab_floor_elements')
          .insert({
            lab_id: labId,
            element_type: el.element_type,
            label: el.label.trim(),
            pos_x: x,
            pos_y: y,
            width: el.width || 12.0,
            height: el.height || 4.0,
            rotation: el.rotation || 0,
            metadata: el.metadata || {},
            is_active: true,
          })
      }
    }

    revalidatePath('/maintenance', 'layout')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

/**
 * Removes or deactivates a floor landmark. Privileged users only.
 */
export async function deleteLabFloorElement(
  elementId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const scope = await getServerUserScope()
    if (!scope.isPrivileged) {
      return { success: false, error: 'Access denied: Only administrators can delete floor landmarks.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('lab_floor_elements')
      .update({ is_active: false })
      .eq('id', elementId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/maintenance', 'layout')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: msg }
  }
}
