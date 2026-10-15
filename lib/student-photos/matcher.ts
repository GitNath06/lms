/**
 * Deterministic Two-Factor Student Photo Matcher.
 * Matches filenames such as "8_kaustuv_thapa.jpg", "08-kaustuv-thapa.png",
 * "14_aarav_sharma.jpeg", "8.jpg", or "ADM-042.jpg" against active class roster records.
 */

export interface StudentPhotoCandidate {
  student_id: string
  full_name: string
  roll_number: number
  admission_no: string | null
  registration_no: string | null
  photo_url?: string | null
}

export type PhotoMatchConfidence = 'high' | 'medium' | 'unmatched'

export interface ParsedPhotoFilename {
  rawFilename: string
  basename: string
  extension: string
  extractedRoll: number | null
  extractedNameCandidate: string | null
}

export interface MatchedStudentPhoto {
  file: File
  filename: string
  previewUrl: string
  dataUrl?: string
  extractedRoll: number | null
  extractedName: string | null
  matchedStudentId: string | null
  matchedStudentName: string | null
  matchedRollNumber: number | null
  confidence: PhotoMatchConfidence
  matchReason: string
}

/**
 * Normalizes a name string for fuzzy token comparison.
 * "kaustuv_thapa" -> ["kaustuv", "thapa"]
 * "Aarav Sharma (Sci)" -> ["aarav", "sharma", "sci"]
 */
export function tokenizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[._\-+,/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/**
 * Checks if two names have significant token overlap or fuzzy similarity.
 */
export function doNamesMatch(nameA: string, nameB: string): boolean {
  const tokensA = tokenizeName(nameA)
  const tokensB = tokenizeName(nameB)
  if (tokensA.length === 0 || tokensB.length === 0) return false

  // Exact token match
  const common = tokensA.filter((t) => tokensB.includes(t))
  if (common.length >= 1 && (common.some((t) => t.length >= 3) || common.length >= Math.min(tokensA.length, tokensB.length))) {
    return true
  }

  // 1-character typo tolerance on tokens of length >= 4 (e.g. kaustuv vs kaustav)
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a === b) return true
      if (a.length >= 4 && b.length >= 4 && Math.abs(a.length - b.length) <= 1) {
        let diffs = 0
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (a[i] !== b[i]) diffs++
        }
        if (diffs <= 1) return true
      }
    }
  }

  return false
}

/**
 * Parses raw photo filename into roll and name candidates.
 * Supports:
 * - "8_kaustuv_thapa.jpg"
 * - "08-kaustuv-thapa.png"
 * - "14 aarav sharma.jpeg"
 * - "8.jpg", "roll-8.jpg"
 * - "kaustuv_thapa.jpg"
 */
export function parsePhotoFilename(filename: string): ParsedPhotoFilename {
  const lastDot = filename.lastIndexOf('.')
  const basename = lastDot !== -1 ? filename.slice(0, lastDot) : filename
  const extension = lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : ''

  // Pattern 1: Leading roll followed by separator and name: "8_kaustuv_thapa", "08-kaustuv-thapa", "14 aarav sharma"
  const rollAndNameMatch = basename.match(/^(\d+)[\s_\-]+(.+)$/)
  if (rollAndNameMatch) {
    const roll = parseInt(rollAndNameMatch[1], 10)
    const namePart = rollAndNameMatch[2].replace(/[_\-]+/g, ' ').trim()
    return {
      rawFilename: filename,
      basename,
      extension,
      extractedRoll: Number.isFinite(roll) ? roll : null,
      extractedNameCandidate: namePart || null,
    }
  }

  // Pattern 2: Roll number only: "8", "08", "roll-8", "roll_08"
  const rollOnlyMatch = basename.match(/^(?:roll[\s_\-]*)?(\d+)$/i)
  if (rollOnlyMatch) {
    const roll = parseInt(rollOnlyMatch[1], 10)
    return {
      rawFilename: filename,
      basename,
      extension,
      extractedRoll: Number.isFinite(roll) ? roll : null,
      extractedNameCandidate: null,
    }
  }

  // Pattern 3: Name only or alphanumeric ID (e.g. "kaustuv_thapa" or "ADM-042")
  return {
    rawFilename: filename,
    basename,
    extension,
    extractedRoll: null,
    extractedNameCandidate: basename.replace(/[_\-]+/g, ' ').trim(),
  }
}

/**
 * Matches a list of photo files against a class roster using the deterministic 2-factor ladder.
 */
export function matchPhotosToStudents(
  files: File[],
  students: StudentPhotoCandidate[]
): MatchedStudentPhoto[] {
  // Index students by roll number
  const rollMap = new Map<number, StudentPhotoCandidate>()
  // Index students by normalized admission/registration number
  const idMap = new Map<string, StudentPhotoCandidate>()

  for (const s of students) {
    rollMap.set(s.roll_number, s)
    if (s.admission_no) idMap.set(s.admission_no.toLowerCase().trim(), s)
    if (s.registration_no) idMap.set(s.registration_no.toLowerCase().trim(), s)
  }

  return files.map((file) => {
    const parsed = parsePhotoFilename(file.name)
    let previewUrl = ''
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined' && file instanceof Blob) {
        previewUrl = URL.createObjectURL(file)
      }
    } catch {
      previewUrl = ''
    }

    // Strategy 1: Check exact institutional ID match (e.g. "ADM-2083-014.jpg" or "1641052469.jpg")
    const cleanedBase = parsed.basename.toLowerCase().trim()
    const studentById = idMap.get(cleanedBase)
    if (studentById) {
      return {
        file,
        filename: file.name,
        previewUrl,
        extractedRoll: parsed.extractedRoll,
        extractedName: parsed.extractedNameCandidate,
        matchedStudentId: studentById.student_id,
        matchedStudentName: studentById.full_name,
        matchedRollNumber: studentById.roll_number,
        confidence: 'high',
        matchReason: `✓ Matched by Institutional ID (${studentById.admission_no || studentById.registration_no})`,
      }
    }

    // Strategy 2: Two-Factor Roll + Name Ladder
    if (parsed.extractedRoll !== null) {
      const studentByRoll = rollMap.get(parsed.extractedRoll)

      if (studentByRoll) {
        // If we also extracted a candidate name, cross-verify
        if (parsed.extractedNameCandidate) {
          const namesMatch = doNamesMatch(parsed.extractedNameCandidate, studentByRoll.full_name)
          if (namesMatch) {
            return {
              file,
              filename: file.name,
              previewUrl,
              extractedRoll: parsed.extractedRoll,
              extractedName: parsed.extractedNameCandidate,
              matchedStudentId: studentByRoll.student_id,
              matchedStudentName: studentByRoll.full_name,
              matchedRollNumber: studentByRoll.roll_number,
              confidence: 'high',
              matchReason: `✓ Matched (Roll ${studentByRoll.roll_number} + Name Verified)`,
            }
          } else {
            // Roll matched, but name differed (possible roll shift or typo)
            return {
              file,
              filename: file.name,
              previewUrl,
              extractedRoll: parsed.extractedRoll,
              extractedName: parsed.extractedNameCandidate,
              matchedStudentId: studentByRoll.student_id,
              matchedStudentName: studentByRoll.full_name,
              matchedRollNumber: studentByRoll.roll_number,
              confidence: 'medium',
              matchReason: `Roll ${studentByRoll.roll_number} matched, but name differs ("${parsed.extractedNameCandidate}")`,
            }
          }
        }

        // Just roll number provided (e.g. "8.jpg")
        return {
          file,
          filename: file.name,
          previewUrl,
          extractedRoll: parsed.extractedRoll,
          extractedName: null,
          matchedStudentId: studentByRoll.student_id,
          matchedStudentName: studentByRoll.full_name,
          matchedRollNumber: studentByRoll.roll_number,
          confidence: 'high',
          matchReason: `✓ Matched by Roll Number (${studentByRoll.roll_number})`,
        }
      }
    }

    // Strategy 3: Name-only matching if roll was absent or not found in class
    if (parsed.extractedNameCandidate) {
      const candidates = students.filter((s) =>
        doNamesMatch(parsed.extractedNameCandidate!, s.full_name)
      )

      if (candidates.length === 1) {
        const student = candidates[0]
        return {
          file,
          filename: file.name,
          previewUrl,
          extractedRoll: parsed.extractedRoll,
          extractedName: parsed.extractedNameCandidate,
          matchedStudentId: student.student_id,
          matchedStudentName: student.full_name,
          matchedRollNumber: student.roll_number,
          confidence: 'medium',
          matchReason: `Matched by Student Name (Current Roll: ${student.roll_number})`,
        }
      }
    }

    // Fallback: Unmatched
    return {
      file,
      filename: file.name,
      previewUrl,
      extractedRoll: parsed.extractedRoll,
      extractedName: parsed.extractedNameCandidate,
      matchedStudentId: null,
      matchedStudentName: null,
      matchedRollNumber: null,
      confidence: 'unmatched',
      matchReason: 'Unmatched file — select student manually from dropdown',
    }
  })
}
