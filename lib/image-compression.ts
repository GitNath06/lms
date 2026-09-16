/**
 * Client-side Image Compression with EXIF Orientation Preservation
 * 
 * Uses createImageBitmap with { imageOrientation: 'from-image' }
 * to ensure portrait photos taken on mobile devices are correctly
 * oriented on canvas before being converted to JPEG blobs.
 */

export interface CompressedImageResult {
  file: File
  previewUrl: string
  originalSize: number
  compressedSize: number
  width: number
  height: number
}

export interface CompressionOptions {
  maxDimension?: number // Max width or height in pixels (default: 1600px)
  quality?: number // JPEG compression quality 0-1 (default: 0.75)
  maxFileSize?: number // Max file size in bytes (default: 5MB)
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 1600,
  quality: 0.75,
  maxFileSize: 5 * 1024 * 1024, // 5MB post-compression ceiling
}

/**
 * Compresses an image File while respecting EXIF orientation.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Verify mime type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimeTypes.includes(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Unsupported image format. Please upload JPEG, PNG, or WebP.')
  }

  // 1. Decode bitmap with EXIF orientation preservation
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (err) {
    // Fallback if browser doesn't support createImageBitmap with imageOrientation
    bitmap = await createImageBitmap(file)
  }

  const origWidth = bitmap.width
  const origHeight = bitmap.height

  // 2. Calculate scaled dimensions keeping aspect ratio
  let targetWidth = origWidth
  let targetHeight = origHeight

  if (origWidth > opts.maxDimension || origHeight > opts.maxDimension) {
    if (origWidth >= origHeight) {
      targetWidth = opts.maxDimension
      targetHeight = Math.round((origHeight * opts.maxDimension) / origWidth)
    } else {
      targetHeight = opts.maxDimension
      targetWidth = Math.round((origWidth * opts.maxDimension) / origHeight)
    }
  }

  // 3. Draw onto HTML5 Canvas
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Failed to obtain 2D canvas context for image compression.')
  }

  // High quality interpolation
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
  bitmap.close()

  // 4. Export as compressed JPEG blob
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      'image/jpeg',
      opts.quality
    )
  })

  if (!blob) {
    throw new Error('Failed to generate compressed image blob.')
  }

  if (blob.size > opts.maxFileSize) {
    throw new Error(
      `Image size (${(blob.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed limit of ${(
        opts.maxFileSize /
        1024 /
        1024
      ).toFixed(0)}MB.`
    )
  }

  // 5. Generate secure, clean file name
  const originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const compressedFileName = `${originalBaseName || 'photo'}_compressed.jpg`

  const compressedFile = new File([blob], compressedFileName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  const previewUrl = URL.createObjectURL(blob)

  return {
    file: compressedFile,
    previewUrl,
    originalSize: file.size,
    compressedSize: blob.size,
    width: targetWidth,
    height: targetHeight,
  }
}

/**
 * Safely revokes a preview URL to prevent memory leaks in the browser.
 */
export function revokePreviewUrl(url?: string | null) {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch {}
  }
}
