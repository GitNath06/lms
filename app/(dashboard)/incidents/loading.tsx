import { Skeleton } from '@/components/ui/skeleton'

export default function IncidentsLoading() {
  return (
    <div className="space-y-6 w-full pb-12 font-mono animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-3.5 w-80 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-44 rounded-xl" />
          <Skeleton className="h-9 w-48 rounded-lg" />
        </div>
      </div>

      {/* Helper Banner Skeleton */}
      <Skeleton className="h-11 w-full rounded-xl" />

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-8 w-12 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
        <Skeleton className="h-4 w-36 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-52 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
