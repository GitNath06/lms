'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Monitor, ArrowRight, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TerminalEntryPage() {
  const router = useRouter()
  const [stationInput, setStationInput] = useState('')

  useEffect(() => {
    // Check if browser has a saved paired terminal
    if (typeof window !== 'undefined') {
      const savedStation = localStorage.getItem('labsync_paired_station')
      if (savedStation) {
        router.replace(`/terminal/${encodeURIComponent(savedStation)}`)
      }
    }
  }, [router])

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = stationInput.trim()
    if (trimmed) {
      router.push(`/terminal/${encodeURIComponent(trimmed)}`)
    }
  }

  const quickStations = [
    'PC-01', 'PC-02', 'PC-03', 'PC-04', 'PC-05',
    'PC-06', 'PC-07', 'PC-08', 'PC-09', 'PC-10',
    'PC-11', 'PC-12', 'PC-13', 'PC-14', 'PC-15',
  ]

  return (
    <div className="min-h-screen bg-[#0B0F19] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <header className="max-w-xl mx-auto w-full pt-8 text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center shadow-lg">
          <Monitor className="h-6 w-6" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-white tracking-tight">
          Student Terminal Help Portal
        </h1>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Report workstation issues, missing software, or request assistance from the lab in-charge.
        </p>
      </header>

      <main className="max-w-md mx-auto w-full space-y-6 my-auto py-6">
        <form onSubmit={handleGo} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <label className="block text-xs font-semibold text-zinc-300">
            Enter Your Computer / Desk Label
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g. PC-12 or A4"
              value={stationInput}
              onChange={(e) => setStationInput(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-sm font-mono tracking-wider uppercase text-zinc-100 focus:border-indigo-500"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!stationInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 text-xs font-semibold rounded-xl"
            >
              Open
            </Button>
          </div>
        </form>

        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">
            Common Laboratory Terminals
          </div>
          <div className="grid grid-cols-5 gap-2">
            {quickStations.map((code) => (
              <button
                key={code}
                onClick={() => router.push(`/terminal/${encodeURIComponent(code)}`)}
                className="py-2 px-1 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-indigo-500/60 hover:bg-zinc-800/80 text-xs font-mono font-medium text-zinc-300 transition-all text-center"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="max-w-xl mx-auto w-full pb-4 text-center text-xs text-zinc-500 font-mono">
        LabSync LIMS · Academic Computer Laboratory
      </footer>
    </div>
  )
}
