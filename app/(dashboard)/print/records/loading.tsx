import { Skeleton } from '@/components/ui/skeleton'

export default function PrintRecordsLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-mono animate-pulse select-none">
      {/* Interactive Controls Bar Skeleton */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex justify-between items-center">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-60 rounded-lg" />
          <Skeleton className="h-3.5 w-96 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Formal Printable Document Skeleton */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
        {/* Letterhead Header Skeleton */}
        <div className="text-center pb-5 border-b-2 border-zinc-900 space-y-2">
          <Skeleton className="h-3 w-44 mx-auto rounded" />
          <Skeleton className="h-8 w-96 mx-auto rounded-lg" />
          <Skeleton className="h-3.5 w-64 mx-auto rounded" />
          <Skeleton className="h-6 w-80 mx-auto rounded-md mt-2" />
        </div>

        {/* Metadata Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="border border-zinc-300 rounded-md overflow-hidden">
          <div className="p-3 bg-zinc-100 border-b border-zinc-300">
            <Skeleton className="h-4 w-full rounded" />
          </div>
          <div className="divide-y divide-zinc-200 p-2 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-56 rounded flex-1" />
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Dual Signatures Skeleton */}
        <div className="grid grid-cols-2 gap-12 pt-10 px-8">
          <div className="text-center space-y-1">
            <Skeleton className="h-0.5 w-48 mx-auto" />
            <Skeleton className="h-3.5 w-40 mx-auto rounded" />
            <Skeleton className="h-2.5 w-32 mx-auto rounded" />
          </div>
          <div className="text-center space-y-1">
            <Skeleton className="h-0.5 w-48 mx-auto" />
            <Skeleton className="h-3.5 w-40 mx-auto rounded" />
            <Skeleton className="h-2.5 w-32 mx-auto rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
