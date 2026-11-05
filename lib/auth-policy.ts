/**
 * Institutional Authentication & Password Security Policy
 * Single Source of Truth for Password Complexity, Strength Scoring & Pre-OTP Validation.
 */

export interface PasswordCriteriaResult {
  minLength: boolean // 8+ characters
  hasUpper: boolean // at least 1 uppercase letter
  hasLower: boolean // at least 1 lowercase letter
  hasNumber: boolean // at least 1 digit
  hasSpecial: boolean // at least 1 special character
}

export interface PasswordValidationResult {
  isValid: boolean
  score: number // 0 to 5
  strength: 'weak' | 'fair' | 'good' | 'strong'
  criteria: PasswordCriteriaResult
  errors: string[]
}

/**
 * Validates password against institutional security standards.
 * Used client-side for real-time feedback and server-side before OTP generation and account creation.
 */
export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const p = password || ''

  const criteria: PasswordCriteriaResult = {
    minLength: p.length >= 8,
    hasUpper: /[A-Z]/.test(p),
    hasLower: /[a-z]/.test(p),
    hasNumber: /[0-9]/.test(p),
    hasSpecial: /[^A-Za-z0-9]/.test(p),
  }

  const errors: string[] = []
  if (!criteria.minLength) errors.push('At least 8 characters long')
  if (!criteria.hasUpper) errors.push('At least 1 uppercase letter (A-Z)')
  if (!criteria.hasLower) errors.push('At least 1 lowercase letter (a-z)')
  if (!criteria.hasNumber) errors.push('At least 1 numeric digit (0-9)')
  if (!criteria.hasSpecial) errors.push('At least 1 special symbol (!@#$%^&*)')

  let score = 0
  if (criteria.minLength) score++
  if (criteria.hasUpper) score++
  if (criteria.hasLower) score++
  if (criteria.hasNumber) score++
  if (criteria.hasSpecial) score++

  let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak'
  if (score >= 5) {
    strength = 'strong'
  } else if (score >= 4) {
    strength = 'good'
  } else if (score >= 3) {
    strength = 'fair'
  }

  return {
    isValid: score === 5,
    score,
    strength,
    criteria,
    errors,
  }
}
