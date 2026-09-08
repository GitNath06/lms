import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-5 w-full animate-pulse select-none pb-12 font-mono">
      {/* Header Banner Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/60">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="h-3.5 w-80 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-8 w-36 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 p-4 space-y-3 bg-white/60 dark:bg-zinc-900/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-xl" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="space-y-1 py-1">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-between">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Hero Banner Skeleton */}
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-3 w-64 rounded" />
              </div>
            </div>
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>

          {/* Session Feed Skeleton */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden">
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex gap-2">
                <Skeleton className="h-7 w-36 rounded-md" />
                <Skeleton className="h-7 w-24 rounded-md" />
                <Skeleton className="h-7 w-28 rounded-md" />
              </div>
              <Skeleton className="h-6 w-24 rounded" />
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-20 rounded" />
                      <Skeleton className="h-3.5 w-16 rounded" />
                      <Skeleton className="h-3.5 w-24 rounded" />
                    </div>
                    <Skeleton className="h-4 w-52 rounded" />
                    <Skeleton className="h-3 w-40 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-16 rounded" />
                    <Skeleton className="h-7 w-20 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-4 bg-white dark:bg-zinc-900/60">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-12 rounded" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-3 w-10 rounded" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-4 bg-white dark:bg-zinc-900/60">
            <Skeleton className="h-4 w-36 rounded" />
            <div className="space-y-2.5">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
