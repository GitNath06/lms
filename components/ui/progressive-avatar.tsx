'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useDeferredAvatar, queueAvatarFetch } from '@/hooks/use-deferred-avatars'

export interface ProgressiveAvatarProps {
  studentId?: string | null
  name?: string | null
  hasPhoto?: boolean
  photoUrl?: string | null
  className?: string
  imageClassName?: string
  isAbsent?: boolean
  isUnderRepair?: boolean
  fallbackGradient?: string
  alt?: string
  children?: React.ReactNode
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic pleasing gradient for initials
const GRADIENTS = [
  'from-indigo-600 to-violet-800',
  'from-blue-600 to-indigo-800',
  'from-emerald-600 to-teal-800',
  'from-amber-600 to-orange-800',
  'from-rose-600 to-pink-800',
  'from-cyan-600 to-blue-800',
]

function getGradient(name?: string | null): string {
  if (!name) return GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % GRADIENTS.length
  return GRADIENTS[idx]
}

export function ProgressiveAvatar({
  studentId,
  name,
  hasPhoto = false,
  photoUrl,
  className = 'w-9 sm:w-10 h-10 sm:h-11 rounded-md',
  imageClassName = '',
  isAbsent = false,
  isUnderRepair = false,
  fallbackGradient,
  alt,
  children,
}: ProgressiveAvatarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use deferred avatar hook only when element is visible or photoUrl provided
  const { avatarUrl } = useDeferredAvatar(
    isVisible ? studentId : null,
    hasPhoto
  )

  const effectivePhotoUrl = photoUrl || avatarUrl

  // IntersectionObserver to fetch avatars only when scrolled into view
  useEffect(() => {
    if (effectivePhotoUrl) {
      setIsVisible(true)
      return
    }

    const elem = containerRef.current
    if (!elem) return

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          if (studentId && hasPhoto) {
            queueAvatarFetch(studentId)
          }
          observer.disconnect()
        }
      },
      { rootMargin: '150px' }
    )

    observer.observe(elem)
    return () => observer.disconnect()
  }, [studentId, hasPhoto, effectivePhotoUrl])

  const initials = getInitials(name)
  const gradient = fallbackGradient || getGradient(name)

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden border flex items-center justify-center shrink-0 select-none shadow-xs transition-all duration-150 ${
        isAbsent
          ? 'border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 filter grayscale contrast-75 brightness-75 opacity-60'
          : isUnderRepair
          ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
          : 'border-zinc-200 dark:border-white/20 bg-slate-100 dark:bg-slate-800'
      } ${className}`}
    >
      {effectivePhotoUrl ? (
        <img
          src={effectivePhotoUrl}
          alt={alt || name || 'Student'}
          className={`h-full w-full object-cover object-top transition-opacity duration-200 animate-in fade-in ${
            isAbsent ? 'grayscale contrast-75 brightness-75 opacity-60' : ''
          } ${imageClassName}`}
          loading="lazy"
        />
      ) : (
        <div
          className={`h-full w-full flex items-center justify-center font-heading font-bold text-xs tracking-wider text-white ${
            isAbsent
              ? 'bg-slate-300 dark:bg-slate-700 opacity-60'
              : `bg-gradient-to-br ${gradient}`
          }`}
        >
          <span>{initials}</span>
        </div>
      )}
      {children}
    </div>
  )
}

export default ProgressiveAvatar
