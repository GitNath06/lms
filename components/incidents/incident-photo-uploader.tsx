'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Camera, Trash2, Maximize2, X, AlertCircle, Loader2 } from 'lucide-react'
import { compressImage, revokePreviewUrl, CompressedImageResult } from '@/lib/image-compression'

export interface UploadedPhoto {
  id: string
  file: File
  previewUrl: string
  originalSize: number
  compressedSize: number
}

interface IncidentPhotoUploaderProps {
  photos: UploadedPhoto[]
  onChange: (photos: UploadedPhoto[]) => void
  maxPhotos?: number
  disabled?: boolean
}

export function IncidentPhotoUploader({
  photos,
  onChange,
  maxPhotos = 4,
  disabled = false,
}: IncidentPhotoUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up object URLs on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((photo) => {
        revokePreviewUrl(photo.previewUrl)
      })
    }
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setErrorMessage(null)
    setIsProcessing(true)

    const remainingSlots = maxPhotos - photos.length
    if (remainingSlots <= 0) {
      setErrorMessage(`Maximum limit of ${maxPhotos} photos reached.`)
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots)
    const newPhotos: UploadedPhoto[] = []

    for (const file of filesToProcess) {
      try {
        const result: CompressedImageResult = await compressImage(file)
        newPhotos.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file: result.file,
          previewUrl: result.previewUrl,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
        })
      } catch (err: any) {
        console.warn('Failed to compress image:', err)
        setErrorMessage(err.message || 'Failed to process image.')
      }
    }

    if (newPhotos.length > 0) {
      onChange([...photos, ...newPhotos])
    }

    setIsProcessing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemovePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = photos.find((p) => p.id === id)
    if (target) {
      revokePreviewUrl(target.previewUrl)
    }
    onChange(photos.filter((p) => p.id !== id))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-2.5 font-sans">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-zinc-500" />
          <span>Evidence Photos / Damage Documentation</span>
        </label>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-sans font-medium tabular-nums">
          {photos.length}/{maxPhotos} Photos
        </span>
      </div>

      {/* Hidden Native File Input: Supports both mobile camera and photo library multi-select */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled || isProcessing || photos.length >= maxPhotos}
        onChange={handleFileSelect}
        className="sr-only"
        id="incident-photo-upload"
      />

      {/* Photo Preview Grid & Upload Trigger */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {photos.map((photo) => {
          const reduction = Math.round(
            ((photo.originalSize - photo.compressedSize) / photo.originalSize) * 100
          )

          return (
            <div
              key={photo.id}
              onClick={() => setLightboxUrl(photo.previewUrl)}
              className="group relative aspect-4/3 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 cursor-pointer shadow-2xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt="Incident Evidence"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />

              {/* Overlay with size badges */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-90 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans font-semibold tabular-nums text-white/95 bg-black/50 backdrop-blur-xs px-1.5 py-0.5 rounded-md">
                    {formatSize(photo.compressedSize)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleRemovePhoto(photo.id, e)}
                    className="p-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                    title="Remove Photo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] font-sans text-white/90 font-medium">
                  <span className="text-emerald-400 font-semibold tabular-nums">
                    {reduction > 0 ? `-${reduction}%` : 'Optimized'}
                  </span>
                  <Maximize2 className="h-3.5 w-3.5 text-white/80" />
                </div>
              </div>
            </div>
          )
        })}

        {/* Add Photo Action Card */}
        {photos.length < maxPhotos && (
          <label
            htmlFor="incident-photo-upload"
            className={`aspect-4/3 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/70 dark:bg-zinc-900/40 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 flex flex-col items-center justify-center gap-1.5 p-3 cursor-pointer transition-all ${
              disabled || isProcessing ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                <span className="text-xs font-medium text-zinc-500 font-sans">Compressing...</span>
              </>
            ) : (
              <>
                <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  <Camera className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 text-center font-sans">
                  Attach Photo
                </span>
                <span className="text-[10.5px] text-zinc-400 text-center font-sans">
                  Camera or Library
                </span>
              </>
            )}
          </label>
        )}
      </div>

      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5 font-sans">
          <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black text-white transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Full Preview"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
