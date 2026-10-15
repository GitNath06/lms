import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Monitor, AlertTriangle } from 'lucide-react'
import { getTerminalContext } from '@/app/actions/terminal'
import { StudentTerminalView } from '@/components/terminal/student-terminal-view'

interface PageProps {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const decodedCode = decodeURIComponent(code || '')
  return {
    title: `Terminal ${decodedCode} | LabSync LIMS`,
    description: `Zero-login student self-reporting interface for terminal ${decodedCode}`,
  }
}

export default async function TerminalPage({ params }: PageProps) {
  const { code } = await params
  const decodedCode = decodeURIComponent(code || '')

  const res = await getTerminalContext(decodedCode)

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-zinc-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold font-heading text-white">Workstation Not Recognized</h1>
          <p className="text-xs text-zinc-400">
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

  return <StudentTerminalView initialData={res.data} />
}
