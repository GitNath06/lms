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
    <button
      type="button"
      onClick={open}
      className="h-9 w-9 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/70 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs group shrink-0"
      title={`Search (${shortcutLabel})`}
      aria-label="Search command palette"
    >
      <Search className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
    </button>
  )
}
