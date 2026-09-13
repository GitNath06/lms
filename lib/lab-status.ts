export const VALID_LAB_STATUSES = ['Operational', 'Under Maintenance', 'Inactive'] as const
export type LabFacilityStatus = (typeof VALID_LAB_STATUSES)[number]

/**
 * Validates untrusted input strings against the known LabFacilityStatus domain.
 * Throws a descriptive Error if the status string is unrecognized.
 */
export function validateLabStatus(status: unknown): LabFacilityStatus {
  if (typeof status === 'string' && (VALID_LAB_STATUSES as readonly string[]).includes(status)) {
    return status as LabFacilityStatus
  }
  throw new Error(`Invalid lab status: "${status}". Must be one of: ${VALID_LAB_STATUSES.join(', ')}`)
}

/**
 * Type guard for LabFacilityStatus.
 */
export function isValidLabStatus(status: unknown): status is LabFacilityStatus {
  return typeof status === 'string' && (VALID_LAB_STATUSES as readonly string[]).includes(status)
}

/**
 * Derives the boolean lifecycle flag (is_active) from a facility operational status.
 * Both 'Operational' and 'Under Maintenance' represent active facilities.
 * Throws if the input status is invalid (hardened runtime defense-in-depth).
 */
export function deriveLabIsActive(status: unknown): boolean {
  const validated = validateLabStatus(status)
  return validated !== 'Inactive'
}

export interface LabFacilityPayload {
  id: string
  name: string
  code: string
  capacity: number
  type: string
  status: LabFacilityStatus | string
}
