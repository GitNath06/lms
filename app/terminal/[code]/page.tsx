import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Monitor, AlertTriangle } from 'lucide-react'
import { getActiveTerminalSession, getTerminalContext } from '@/app/actions/terminal'
import { StudentTerminalView } from '@/components/terminal/student-terminal-view'
import { UnverifiedTerminalScreen } from '@/components/terminal/unverified-terminal-screen'
import TerminalSimulatorController from '@/components/dev/terminal-simulator-controller'

interface PageProps {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const decodedCode = decodeURIComponent(code || '').trim()
  return {
    title: `Terminal ${decodedCode} | LabSync LIMS`,
    description: `Zero-login student self-reporting interface for terminal ${decodedCode}`,
  }
}

export default async function TerminalPage({ params }: PageProps) {
  const { code } = await params
  const decodedCode = decodeURIComponent(code || '').trim()
  const isDev = process.env.NODE_ENV !== 'production'

  // 1. Verify Active Hardware Session Cookie
  const session = await getActiveTerminalSession()

  // Strict Hardware Session Guard:
  // Must have a valid HMAC session cookie matching the requested terminal code
  const isSessionValidForCode =
    Boolean(session.authenticated) &&
    typeof session.stationCode === 'string' &&
    session.stationCode.toLowerCase() === decodedCode.toLowerCase()

  if (!isSessionValidForCode) {
    const reason =
      session.authenticated && session.stationCode
        ? `Session Mismatch: Your workstation session is authenticated for terminal "${session.stationCode}", but you attempted to open "${decodedCode}". Cross-terminal access is strictly blocked.`
        : undefined

    return (
      <>
        <UnverifiedTerminalScreen requestedCode={decodedCode} reason={reason} />
        {isDev && <TerminalSimulatorController />}
      </>
    )
  }

  // 2. Resolve Workstation Context from Database
  const res = await getTerminalContext(decodedCode)

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold font-heading text-zinc-900 dark:text-white">Workstation Not Recognized</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {res.error || `Could not find workstation "${decodedCode}" in the laboratory database.`}
          </p>
          <div className="pt-2">
            <Link
              href="/terminal"
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
            >
              <Monitor className="w-4 h-4" />
              <span>Select Lab Terminal</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Double-Check Physical Silicon GUID Alignment against DB
  if (res.data.machineGuid && session.machineGuid && res.data.machineGuid !== session.machineGuid) {
    return (
      <>
        <UnverifiedTerminalScreen
          requestedCode={decodedCode}
          reason="Physical Hardware Silicon Mismatch: The cryptographic identity of your computer does not match the bound hardware for this desk."
        />
        {isDev && <TerminalSimulatorController />}
      </>
    )
  }

  return (
    <>
      <StudentTerminalView initialData={res.data} isSessionAuthenticated={true} />
      {isDev && <TerminalSimulatorController />}
    </>
  )
}
