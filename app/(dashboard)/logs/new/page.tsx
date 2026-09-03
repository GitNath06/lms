import Link from 'next/link'
import { ArrowLeft, ClipboardList, ShieldCheck } from 'lucide-react'
import LogForm from './log-form'
import { getActiveLabs, getTeachers } from '@/app/actions/logs'
import { Badge } from '@/components/ui/badge'

export default async function NewLogPage() {
  const [labs, teachers] = await Promise.all([
    getActiveLabs(),
    getTeachers(),
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-300 select-none">
      {/* Sleek Top Navigation Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-zinc-900/80 p-3.5 px-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/logs"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            title="Return to Practical Logs Register"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2 font-mono">
                <ClipboardList className="h-4 w-4 text-indigo-500" />
                Practical Session Endorsement Entry
              </h2>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-[10px]">
                Session 2083
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              Record experiment syllabus, apparatus status, and student attendance tallies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Audit Synchronized</span>
          </span>
        </div>
      </div>

      {/* Main Form Body */}
      <LogForm labs={labs} teachers={teachers} />
    </div>
  )
}
