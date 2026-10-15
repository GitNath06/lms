'use client'

import React, { useRef, useState } from 'react'
import { Camera, Image as ImageIcon, X, Loader2, ZoomIn } from 'lucide-react'
import { compressImage } from '@/lib/image-compression'
import type { WorkstationPhoto } from '@/types/workstations'

interface WorkstationPhotoCaptureProps {
  photos: WorkstationPhoto[]
  onChange: (photos: WorkstationPhoto[]) => void
  maxPhotos?: number
  disabled?: boolean
}

export function WorkstationPhotoCapture({
  photos,
  onChange,
  maxPhotos = 3,
  disabled = false,
}: WorkstationPhotoCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [compressing, setCompressing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    if (photos.length >= maxPhotos) {
      setErrorMsg(`Maximum of ${maxPhotos} photos reached.`)
      return
    }

    setErrorMsg(null)
    setCompressing(true)

    try {
      const remainingSlots = maxPhotos - photos.length
      const filesToProcess = Array.from(fileList).slice(0, remainingSlots)
      const newPhotos: WorkstationPhoto[] = []

      for (const file of filesToProcess) {
        // Compress using client-side canvas utility
        const result = await compressImage(file, {
          maxDimension: 1200,
          quality: 0.72,
          maxFileSize: 2 * 1024 * 1024,
        })

        // Convert blob to base64 data URL for direct jsonb persistence
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(result.file)
        })

        newPhotos.push({
          url: base64Url,
          name: result.file.name,
          size: result.compressedSize,
          thumbnailUrl: base64Url,
        })
      }

      onChange([...photos, ...newPhotos])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compress image'
      setErrorMsg(msg)
    } finally {
      setCompressing(false)
      // Reset inputs so user can pick the same file again if desired
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Photo Evidence (Optional, Max {maxPhotos})
        </label>
        <span className="text-[11px] tabular-nums text-slate-500">
          {photos.length} / {maxPhotos}
        </span>
      </div>

      {/* Hidden Native Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || compressing || photos.length >= maxPhotos}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        disabled={disabled || compressing || photos.length >= maxPhotos}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Action Buttons */}
      {photos.length < maxPhotos && (
        <div className="grid grid-cols-2 gap-2">
          {/* Mobile Camera Button */}
          <button
            type="button"
            disabled={disabled || compressing}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 px-3 py-2.5 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/80 hover:bg-indigo-500/10 active:scale-[0.98] disabled:opacity-50"
          >
            {compressing ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            ) : (
              <Camera className="h-4 w-4 text-indigo-400" />
            )}
            <span>Snap Camera</span>
          </button>

          {/* Gallery / File Picker */}
          <button
            type="button"
            disabled={disabled || compressing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-3 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span>Upload File</span>
          </button>
        </div>
      )}

      {/* Error Notice */}
      {errorMsg && (
        <p className="text-[11px] text-rose-400">{errorMsg}</p>
      )}

      {/* Preview Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {photos.map((photo, idx) => (
            <div
              key={idx}
              className="group relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.name || `Evidence ${idx + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />

              {/* View / Zoom Overlay */}
              <button
                type="button"
                onClick={() => setLightboxUrl(photo.url)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <ZoomIn className="h-4 w-4 text-white drop-shadow" />
              </button>

              {/* Remove Button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePhoto(idx)
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/75 p-1 text-slate-300 backdrop-blur-sm transition-colors hover:bg-rose-600 hover:text-white"
                  title="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* Size Badge */}
              {photo.size && (
                <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-mono text-slate-300">
                  {(photo.size / 1024).toFixed(0)} KB
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Simple Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Evidence Full View"
              className="max-h-[85vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -right-3 -top-3 rounded-full bg-slate-800 p-2 text-white shadow-lg hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
