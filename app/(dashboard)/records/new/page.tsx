import { ClipboardList, ShieldCheck } from 'lucide-react'
import { BackButton } from '@/components/ui/back-button'
import LogForm from './log-form'
import { getActiveLabs, getTeachers, getScopedLogFormOptions } from '@/app/actions/logs'
import { Badge } from '@/components/ui/badge'

export default async function NewLogPage() {
  const [labs, teachers, scopedOptions] = await Promise.all([
    getActiveLabs(),
    getTeachers(),
    getScopedLogFormOptions(),
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-300 select-none">
      {/* Sleek Top Navigation Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-zinc-900/80 p-3.5 px-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/records" title="Return to Practical Records" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-heading font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
                <ClipboardList className="h-4.5 w-4.5 text-indigo-500" />
                New Practical Session Log
              </h2>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-sans font-semibold text-[10px]">
                Session 2083
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
              Record experiment syllabus, equipment status, and student attendance tallies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs text-zinc-500">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Audit Synchronized</span>
          </span>
        </div>
      </div>

      {/* Main Form Body */}
      <LogForm labs={labs} teachers={teachers} scopedOptions={scopedOptions} />
    </div>
  )
}
