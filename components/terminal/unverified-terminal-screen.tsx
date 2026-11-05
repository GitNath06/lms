import React from 'react'
import Link from 'next/link'
import { ShieldAlert, Terminal, ArrowRight } from 'lucide-react'
import { INSTITUTION_NAME } from '@/lib/institution'
import ThemeToggle from '@/components/ui/theme-toggle'

interface UnverifiedTerminalScreenProps {
  requestedCode: string
  reason?: string
}

export function UnverifiedTerminalScreen({ requestedCode, reason }: UnverifiedTerminalScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <header className="max-w-xl mx-auto w-full pt-8 text-center space-y-2">
        <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-lg">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-zinc-900 dark:text-white tracking-tight">
          Physical Workstation Authentication Required
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Academic Computer Laboratory Anti-Spoofing &amp; Hardware Lock Active
        </p>
      </header>

      <main className="max-w-lg mx-auto w-full space-y-6 my-auto py-6">
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden text-zinc-900 dark:text-zinc-100">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                Requested Terminal
              </span>
              <div className="text-xl font-extrabold font-heading text-zinc-900 dark:text-white">
                {requestedCode || 'Workstation'}
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400">
              Unverified Hardware
            </div>
          </div>

          <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p>
              {reason ||
                'To prevent prank reporting and ensure that attendance and assistance requests match your actual physical desk, this terminal portal must be launched via the LabSync Hardware Agent.'}
            </p>

            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-[#0E1524] border border-indigo-200 dark:border-indigo-500/20 space-y-2">
              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-heading">
                <Terminal className="h-3.5 w-3.5" />
                <span>How to Open on Your Desk:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300 pl-1">
                <li>Minimize your browser and look at your Windows Desktop.</li>
                <li>
                  Double-click the shortcut named{' '}
                  <strong className="text-zinc-900 dark:text-white">&ldquo;LabSync Student Portal&rdquo;</strong>.
                </li>
                <li>
                  The agent will verify your workstation hardware in 1.5 seconds and launch your authenticated session.
                </li>
              </ol>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
              If your computer does not have this shortcut installed, please notify the Lab In-Charge or Faculty Instructor.
            </p>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-4 flex items-center justify-end">
            <Link
              href="/terminal"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors flex items-center gap-1"
            >
              <span>Terminal Gateway</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-xl mx-auto w-full pb-4 text-center text-xs text-zinc-500 font-mono">
        {INSTITUTION_NAME} · LabSync LIMS Academic Laboratory System
      </footer>
    </div>
  )
}

