'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, Home, LucideIcon } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  breadcrumbs?: BreadcrumbItem[]
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-800/60',
  breadcrumbs = [],
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`space-y-2 mb-6 ${className}`}>
      {/* Institutional Breadcrumb Trail with Mobile Truncation */}
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
          <Link
            href="/"
            className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 shrink-0"
            title="Dashboard Home"
          >
            <Home className="h-3 w-3" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            const isIntermediate = idx > 0 && !isLast

            return (
              <React.Fragment key={crumb.label + idx}>
                <ChevronRight className="h-3 w-3 text-zinc-300 dark:text-zinc-700 shrink-0" />

                {isLast ? (
                  <span
                    className="font-bold text-zinc-800 dark:text-slate-200 truncate max-w-[160px] sm:max-w-none"
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                ) : crumb.href ? (
                  <Link
                    href={crumb.href}
                    className={`hover:text-zinc-700 dark:hover:text-white transition-colors truncate max-w-[110px] sm:max-w-none ${
                      isIntermediate ? 'hidden sm:inline' : ''
                    }`}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`truncate max-w-[110px] sm:max-w-none ${
                      isIntermediate ? 'hidden sm:inline' : ''
                    }`}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            )
          })}
        </nav>
      )}

      {/* Main Title Row & Actions Bay */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className={`h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center border shadow-xs shrink-0 ${iconColor}`}
            >
              <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-zinc-950 dark:text-white tracking-tight truncate">
                {title}
              </h1>
              {badge}
            </div>

            {subtitle && (
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-slate-400 font-sans mt-0.5 leading-normal truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Contextual Action Dock */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap pt-1 sm:pt-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
