import { Skeleton } from '@/components/ui/skeleton'

export default function PracticalRecordsLoading() {
  return (
    <div className="space-y-6 w-full pb-16 font-mono animate-pulse select-none">
      {/* Page Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-64 rounded-lg" />
            <Skeleton className="h-3.5 w-96 rounded" />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Analytics Summary Strip Skeleton (4 KPI Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-7 w-20 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Filter and Grouping Bar Skeleton */}
      <div className="p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Records Table Skeleton */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-3.5 px-4 flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <div className="space-y-1.5 flex-1 max-w-sm">
                <Skeleton className="h-4 w-44 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
              </div>
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
