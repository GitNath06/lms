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
      {/* Desktop & Tablet Search Pill */}
      <button
        type="button"
        onClick={open}
        className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-850 hover:border-indigo-400/60 dark:hover:border-indigo-600/60 shadow-2xs text-xs font-sans transition-all cursor-pointer group text-left select-none"
        title={`Search sessions, labs, faculty, or actions (${shortcutLabel})`}
      >
        <Search className="h-3.5 w-3.5 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors pr-2">
          Search sessions, rooms, faculty...
        </span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold border border-zinc-300/60 dark:border-zinc-700/60 shadow-2xs shrink-0">
          {shortcutLabel}
        </kbd>
      </button>

      {/* Mobile Icon Button */}
      <button
        type="button"
        onClick={open}
        className="flex md:hidden h-8 w-8 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-zinc-900/60 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 items-center justify-center transition-colors cursor-pointer shadow-2xs"
        title={`Search (${shortcutLabel})`}
      >
        <Search className="h-4 w-4" />
      </button>
    </>
  )
}
