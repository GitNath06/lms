/**
 * Client-side auto-crop & compression pipeline for student avatars.
 * Center-crops to 1:1 square, clamps to 256x256, and outputs lightweight base64 Data URL (~15-25 KB).
 */

export interface CompressedAvatarResult {
  dataUrl: string
  sizeBytes: number
  width: number
  height: number
}

export async function compressStudentAvatar(
  file: File | Blob,
  targetSize = 256,
  quality = 0.75
): Promise<CompressedAvatarResult> {
  return new Promise((resolve, reject) => {
    // If not running in a browser environment, reject safely
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('compressStudentAvatar must be executed in a browser environment.'))
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read photo file.'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to decode image.'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = targetSize
          canvas.height = targetSize
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            return reject(new Error('Failed to get 2D canvas context.'))
          }

          // Calculate center square crop coordinates
          const srcWidth = img.naturalWidth || img.width
          const srcHeight = img.naturalHeight || img.height
          const minDim = Math.min(srcWidth, srcHeight)

          const srcX = (srcWidth - minDim) / 2
          const srcY = (srcHeight - minDim) / 2

          // Smooth rendering
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          // Draw center-cropped square resized to targetSize
          ctx.drawImage(img, srcX, srcY, minDim, minDim, 0, 0, targetSize, targetSize)

          // Encode to JPEG data URL
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          // Estimate byte size from base64 string
          const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1)
          const sizeBytes = Math.round((base64Length * 3) / 4)

          resolve({
            dataUrl,
            sizeBytes,
            width: targetSize,
            height: targetSize,
          })
        } catch (err) {
          reject(err)
        }
      }
      img.src = e.target?.result as string
    }

    reader.readAsDataURL(file)
  })
}

/** Alias for general user/staff profile avatar compression */
export const compressAvatar = compressStudentAvatar

