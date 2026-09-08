'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'

export interface SegmentedTab<T extends string = string> {
  id: T
  label: string
  badge?: number | string
  badgeVariant?: 'default' | 'alert' | 'success'
  hiddenOnMobile?: boolean
}

interface SlidingSegmentedTabsProps<T extends string = string> {
  tabs: SegmentedTab<T>[]
  activeTab: T
  onChange: (tabId: T) => void
  size?: 'sm' | 'md'
  className?: string
}

export function SlidingSegmentedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  size = 'md',
  className = '',
}: SlidingSegmentedTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonsRef = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  })

  const updateIndicator = useCallback(() => {
    const activeBtn = buttonsRef.current.get(activeTab)
    if (activeBtn && containerRef.current) {
      setIndicator({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        ready: true,
      })
    }
  }, [activeTab])

  useEffect(() => {
    updateIndicator()
  }, [updateIndicator, tabs])

  useEffect(() => {
    const handleResize = () => {
      updateIndicator()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateIndicator])

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
      role="tablist"
      className={`relative flex items-center p-1 bg-zinc-200/60 dark:bg-[#101726] border border-zinc-200/60 dark:border-white/[0.08] rounded-xl select-none ${className}`}
    >
      {/* Sliding Active Pill */}
      {indicator.ready && (
        <span
          className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-[#151E32] shadow-xs border border-zinc-200/80 dark:border-white/[0.12] transition-all duration-200 ease-out pointer-events-none motion-reduce:transition-none"
          style={{
            left: `${indicator.left}px`,
            width: `${indicator.width}px`,
          }}
        />
      )}

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) buttonsRef.current.set(tab.id, el)
              else buttonsRef.current.delete(tab.id)
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            suppressHydrationWarning
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } rounded-lg font-sans font-medium transition-all duration-150 active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none cursor-pointer ${
              tab.hiddenOnMobile ? 'hidden sm:flex' : 'flex'
            } ${
              isActive
                ? !indicator.ready
                  ? 'bg-white dark:bg-[#151E32] text-zinc-950 dark:text-white font-semibold shadow-xs'
                  : 'text-zinc-950 dark:text-white font-semibold'
                : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                suppressHydrationWarning
                className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold tabular-nums font-mono transition-colors ${
                  tab.badgeVariant === 'alert'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                    : 'bg-zinc-200/80 dark:bg-[#1A253D] text-zinc-700 dark:text-slate-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
