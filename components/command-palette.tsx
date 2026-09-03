'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Calendar,
  ClipboardList,
  Plus,
  Printer,
  Moon,
  Sun,
  Terminal,
  Atom,
  FlaskRound,
  X,
  Command,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { MASTER_ROUTINE } from '@/lib/master-data'

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { setTheme, theme } = useTheme()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isOpen) return null

  const filteredRoutines = MASTER_ROUTINE.filter(
    (item) =>
      item.subjectCode.toLowerCase().includes(query.toLowerCase()) ||
      item.subjectTitle.toLowerCase().includes(query.toLowerCase()) ||
      item.teacher.toLowerCase().includes(query.toLowerCase()) ||
      item.grade.toLowerCase().includes(query.toLowerCase()) ||
      item.lab.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5)

  const handleSelect = (action: () => void) => {
    action()
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col transition-all font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type command, faculty name, or subject code..."
            className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results / Command Items */}
        <div className="p-2 overflow-y-auto max-h-80 divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
          {/* Quick Actions */}
          <div className="py-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              System Operations
            </div>

            <button
              onClick={() => handleSelect(() => router.push('/logs/new'))}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Plus className="h-3.5 w-3.5 text-zinc-500" />
                <span>LOG // Record New Session</span>
              </div>
              <ArrowRight className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => handleSelect(() => router.push('/schedules'))}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                <span>ROUTINE // Master Schedule 2083</span>
              </div>
              <ArrowRight className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => handleSelect(() => window.print())}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <Printer className="h-3.5 w-3.5 text-zinc-500" />
                <span>PRINT // Daily Laboratory Register</span>
              </div>
              <ArrowRight className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => handleSelect(() => router.push('/incidents'))}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                <span>INCIDENT // Incident and Damage Workspace</span>
              </div>
              <ArrowRight className="h-3 w-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Search Results from Master Routine */}
          {filteredRoutines.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Matching Academic Sessions
              </div>

              {filteredRoutines.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(() => router.push('/schedules'))}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.subjectCode}
                      </span>{' '}
                      — <span className="text-zinc-500">{item.subjectTitle}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {item.day} • {item.timeSlot}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Theme & System Controls */}
          <div className="py-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              System Environment
            </div>

            <button
              onClick={() => handleSelect(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
              className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5 text-zinc-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-zinc-400" />
                )}
                <span>THEME // Toggle Dark / Light</span>
              </div>
              <span className="text-[10px] text-zinc-400">{theme?.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Footer Shortcut Guide */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
          <span>Navigate with arrows, Enter to select</span>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" /> + K
          </span>
        </div>
      </div>
    </div>
  )
}
