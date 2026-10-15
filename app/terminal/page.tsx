import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Monitor, ShieldAlert, AlertTriangle, ArrowRight, RefreshCw, Terminal, Laptop } from 'lucide-react'
import { getActiveTerminalSession, getTerminalContext } from '@/app/actions/terminal'
import { StudentTerminalView } from '@/components/terminal/student-terminal-view'

export const metadata: Metadata = {
  title: 'Student Terminal Portal | LabSync LIMS',
  description: 'Physical workstation self-reporting interface for academic computer laboratories',
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TerminalEntryPage({ searchParams }: PageProps) {
  const query = await searchParams
  const authError = typeof query.auth_error === 'string' ? query.auth_error : null
  const devStation = typeof query.dev_station === 'string' ? query.dev_station.trim() : null

  // 1. Check for Active Cryptographic Session Cookie
  const session = await getActiveTerminalSession()

  // 2. Resolve Station Code: Session cookie prioritized, fallback to dev_station in development
  const isDev = process.env.NODE_ENV !== 'production'
  const activeStationCode = session.authenticated && session.stationCode ? session.stationCode : devStation

  if (activeStationCode) {
    const res = await getTerminalContext(activeStationCode)
    if (res.success && res.data) {
      return (
        <StudentTerminalView
          initialData={res.data}
          isSessionAuthenticated={Boolean(session.authenticated)}
        />
      )
    }
  }

  // 3. Unauthorized State: Direct access without agent handshake
  const commonStations = [
    'PC-01', 'PC-02', 'PC-03', 'PC-04', 'PC-05',
    'PC-06', 'PC-07', 'PC-08', 'PC-09', 'PC-10',
    'PC-11', 'PC-12', 'PC-13', 'PC-14', 'PC-15',
  ]

  return (
    <div className="min-h-screen bg-[#0B0F19] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <header className="max-w-xl mx-auto w-full pt-8 text-center space-y-2">
        <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center shadow-lg">
          <Monitor className="h-7 w-7" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-white tracking-tight">
          LabSync Student Terminal Gateway
        </h1>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Academic Computer Laboratory Operational Help &amp; Diagnostic Reporting System
        </p>
      </header>

      <main className="max-w-lg mx-auto w-full space-y-6 my-auto py-6">
        {authError && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Authentication Ticket Failed</div>
              <p className="text-rose-300/90 mt-0.5">{authError}</p>
            </div>
          </div>
        )}

        {/* Physical Desktop Shortcut Instructions */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading">
                Physical Workstation Authentication Required
              </h2>
              <p className="text-[11px] text-zinc-400">
                Anti-Spoofing Security Policy Enforced
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
            <p>
              To prevent prank reporting and guarantee that assistance requests match your actual desk, this student portal must be launched directly from your physical lab computer.
            </p>

            <div className="p-3.5 rounded-xl bg-[#0E1524] border border-indigo-500/20 space-y-2">
              <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-heading">
                <Terminal className="h-3.5 w-3.5" />
                <span>How to Open on Your Desk:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-300 pl-1">
                <li>Minimize your browser and look at your Windows Desktop.</li>
                <li>Double-click the shortcut named <strong className="text-white">&ldquo;LabSync Student Portal&rdquo;</strong>.</li>
                <li>The agent will automatically verify your workstation hardware and open this portal.</li>
              </ol>
            </div>

            <p className="text-[11px] text-zinc-400 italic">
              If your desktop does not have this shortcut or if Ethernet is unplugged, please notify the Lab In-Charge or Instructor verbally.
            </p>
          </div>

          <div className="border-t border-zinc-800/80 pt-4 flex items-center justify-between">
            <Link
              href="/computer-lab"
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Faculty / In-Charge View &rarr;
            </Link>
            <span className="text-[11px] font-mono text-zinc-500">
              Station Lock: Inactive
            </span>
          </div>
        </div>

        {/* Development Environment Bypass (Only shown in local dev mode) */}
        {isDev && (
          <div className="space-y-2.5 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider text-center flex items-center justify-center gap-1.5 font-heading">
              <Laptop className="h-3.5 w-3.5" />
              <span>Dev Environment Simulation Override</span>
            </div>
            <p className="text-[10px] text-zinc-500 text-center">
              Simulate launching from physical lab PC nodes (available in local dev mode only):
            </p>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {commonStations.map((code) => (
                <Link
                  key={code}
                  href={`/terminal?dev_station=${encodeURIComponent(code)}`}
                  className="py-2 px-1 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-indigo-500/60 hover:bg-zinc-800/80 text-xs font-mono font-medium text-zinc-300 transition-all text-center"
                >
                  {code}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-xl mx-auto w-full pb-4 text-center text-xs text-zinc-500 font-mono">
        LabSync LIMS · Secondary &amp; Higher Secondary Academic Laboratory System
      </footer>
    </div>
  )
}
