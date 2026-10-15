'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Camera, Trash2, Maximize2, X, AlertCircle, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react'
import { compressImage, revokePreviewUrl, fileToBase64, CompressedImageResult } from '@/lib/image-compression'

export interface UploadedPhoto {
  id: string
  file: File
  previewUrl: string
  dataUrl?: string
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
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up object URLs on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((photo) => {
        revokePreviewUrl(photo.previewUrl)
      })
    }
  }, [])

  const processSelectedFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return

    setErrorMessage(null)
    setIsProcessing(true)

    const remainingSlots = maxPhotos - photos.length
    if (remainingSlots <= 0) {
      setErrorMessage(`Maximum limit of ${maxPhotos} photos reached.`)
      setIsProcessing(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const filesToProcess = Array.from(fileList).slice(0, remainingSlots)
    const newPhotos: UploadedPhoto[] = []

    for (const file of filesToProcess) {
      try {
        const result: CompressedImageResult = await compressImage(file, {
          maxDimension: 1280,
          quality: 0.72,
          maxFileSize: 3 * 1024 * 1024,
        })
        const dataUrl = await fileToBase64(result.file)
        newPhotos.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file: result.file,
          previewUrl: result.previewUrl,
          dataUrl,
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
    if (cameraInputRef.current) cameraInputRef.current.value = ''
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
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-sans flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-indigo-500" />
          <span>Evidence Photos / Damage Documentation</span>
        </label>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-sans font-medium tabular-nums">
          {photos.length}/{maxPhotos} Attached
        </span>
      </div>

      {/* Hidden Native Inputs: Camera Quick-Snap + File Selector */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled || isProcessing || photos.length >= maxPhotos}
        onChange={(e) => processSelectedFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || isProcessing || photos.length >= maxPhotos}
        onChange={(e) => processSelectedFiles(e.target.files)}
      />

      {/* Dual Tactile Triggers for Mobile / Desktop */}
      {photos.length < maxPhotos && (
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Mobile Camera Quick Snap */}
          <button
            type="button"
            disabled={disabled || isProcessing}
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-400/50 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 sm:p-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-all hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 hover:border-indigo-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Camera className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            )}
            <span>Quick Snap Camera</span>
          </button>

          {/* 2. Photo Gallery / File Picker */}
          <button
            type="button"
            disabled={disabled || isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 sm:p-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:border-zinc-400 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <ImageIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span>Upload Photo</span>
          </button>
        </div>
      )}

      {/* Photo Preview Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-0.5">
          {photos.map((photo) => {
            const reduction = Math.round(
              ((photo.originalSize - photo.compressedSize) / photo.originalSize) * 100
            )

            return (
              <div
                key={photo.id}
                onClick={() => setLightboxUrl(photo.dataUrl || photo.previewUrl)}
                className="group relative aspect-4/3 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 cursor-pointer shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl || photo.previewUrl}
                  alt="Incident Evidence"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                {/* Overlay with size badges */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 opacity-90 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-semibold tabular-nums text-white/95 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-md">
                      {formatSize(photo.compressedSize)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleRemovePhoto(photo.id, e)}
                      className="p-1 rounded-md bg-rose-600/85 hover:bg-rose-600 text-white transition-colors cursor-pointer"
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
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5 font-sans">
          <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors z-10 cursor-pointer"
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
