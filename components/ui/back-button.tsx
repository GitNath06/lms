'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  fallbackHref?: string
  title?: string
  className?: string
}

export function BackButton({
  fallbackHref = '/records',
  title = 'Return to previous page',
  className,
}: BackButtonProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleBack = () => {
    const from = searchParams.get('from')
    if (from && from.startsWith('/') && !from.startsWith('//')) {
      router.push(from)
    } else if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        'p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer shrink-0',
        className
      )}
      title={title}
      aria-label={title}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  )
}
