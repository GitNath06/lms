/**
 * Client-Side Image Compression Utility
 * Prevents Base64 payload bloat by resizing and converting images to lightweight WebP (< 20KB).
 */

export interface CompressImageOptions {
  maxWidth?: number // default 256
  maxHeight?: number // default 256
  quality?: number // default 0.75
  format?: 'image/webp' | 'image/jpeg'
}

export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 256,
    maxHeight = 256,
    quality = 0.75,
    format = 'image/webp',
  } = options

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('compressImage can only run in browser environment.'))
    }

    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate aspect-ratio preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return reject(new Error('Failed to get canvas 2d context'))
        }

        // High quality bicubic downscaling
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        try {
          const dataUrl = canvas.toDataURL(format, quality)
          resolve(dataUrl)
        } catch (e) {
          // Fallback to jpeg if webp unsupported
          const fallbackDataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(fallbackDataUrl)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(fileOrBlob)
  })
}

