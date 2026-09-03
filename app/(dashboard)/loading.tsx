import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Top Header skeleton */}
      <div className="h-20 bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-5" />

      {/* KPI skeleton */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4"
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="h-64 bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60" />
    </div>
  )
}
