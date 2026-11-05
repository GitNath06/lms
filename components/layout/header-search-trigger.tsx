'use client'

import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useCommandPalette } from '@/hooks/use-command-palette'

export default function HeaderSearchTrigger() {
  const { open } = useCommandPalette()
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K')

  useEffect(() => {
    const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
    setShortcutLabel(isMac ? '⌘K' : 'Ctrl K')
  }, [])

  return (
    <>
      {/* Desktop Ultra-Compact Search Pill (Large Screens) */}
      <button
        type="button"
        onClick={open}
        className="hidden lg:flex items-center gap-2 h-9 px-2.5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/60 dark:bg-white/[0.04] hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer shadow-2xs group hover:border-indigo-400/60 select-none"
        title={`Search sessions, labs, faculty, or actions (${shortcutLabel})`}
      >
        <Search className="h-4 w-4 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium group-hover:text-zinc-800 dark:group-hover:text-zinc-200">
          Search
        </span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 font-semibold border border-zinc-300/60 dark:border-white/10 shadow-2xs">
          {shortcutLabel}
        </kbd>
      </button>

      {/* Sleek Compact Search Icon Button (Mobile & Tablet) */}
      <button
        type="button"
        onClick={open}
        className="flex lg:hidden h-9 w-9 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/60 dark:bg-white/[0.04] hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 items-center justify-center transition-all cursor-pointer shadow-2xs hover:border-indigo-400/60"
        title={`Search (${shortcutLabel})`}
        aria-label="Search command palette"
      >
        <Search className="h-4 w-4" />
      </button>
    </>
  )
}
