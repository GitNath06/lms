/**
 * String normalization and fuzzy comparison utilities for student names,
 * abbreviations, and Nepali naming conventions.
 */

/**
 * Normalizes a student name for deduplication and matching:
 * - Strips all non-alphanumeric characters (periods, commas, dashes, quotes)
 * - Collapses repeated whitespace
 * - Standardizes common abbreviations (e.g., 'k.c.' -> 'kc', 'b.k.' -> 'bk')
 * - Converts to lowercase trimmed string
 *
 * Example:
 * normalizeStudentName("  Ram  K.C.  ") === "ram kc"
 * normalizeStudentName("Sita B.K.") === "sita bk"
 * normalizeStudentName("Bikash Shrestha-Magar") === "bikash shresthamagar"
 */
export function normalizeStudentName(name: string | null | undefined): string {
  if (!name) return ''

  return name
    .toLowerCase()
    .trim()
    // Remove periods inside abbreviations: k.c. -> kc, b.k. -> bk
    .replace(/([a-z])\./gi, '$1')
    // Remove non-alphanumeric characters except single space
    .replace(/[^a-z0-9\s]/gi, '')
    // Collapse multiple spaces into a single space
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Capitalizes a student name nicely into Title Case for presentation.
 * Example: "RAM BAHADUR K.C." -> "Ram Bahadur K.C."
 */
export function formatStudentDisplayName(name: string | null | undefined): string {
  if (!name) return ''

  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return ''
      // If it looks like an acronym/abbreviation with dots (e.g., K.C.), uppercase it
      if (word.includes('.')) {
        return word.toUpperCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0))

  for (let i = 0; i <= an; i++) matrix[0][i] = i
  for (let j = 0; j <= bn; j++) matrix[j][0] = j

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,       // insertion
        matrix[j - 1][i] + 1,       // deletion
        matrix[j - 1][i - 1] + cost // substitution
      )
    }
  }

  return matrix[bn][an]
}

/**
 * Returns string similarity score from 0.0 (completely different) to 1.0 (exact match)
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeStudentName(nameA)
  const normB = normalizeStudentName(nameB)

  if (normA === normB) return 1.0
  if (!normA || !normB) return 0.0

  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 1.0

  const distance = levenshteinDistance(normA, normB)
  return Math.max(0, 1.0 - distance / maxLen)
}

/**
 * Checks if two student names can be safely considered the same person (>= 85% match or exact token match)
 */
export function isNameMatch(nameA: string, nameB: string, threshold = 0.85): boolean {
  const normA = normalizeStudentName(nameA)
  const normB = normalizeStudentName(nameB)

  if (normA === normB) return true

  // Check token permutation (e.g., "Sharma Ram" vs "Ram Sharma")
  const tokensA = normA.split(' ').sort().join(' ')
  const tokensB = normB.split(' ').sort().join(' ')
  if (tokensA === tokensB) return true

  return calculateNameSimilarity(normA, normB) >= threshold
}
