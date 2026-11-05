'use client'

import React from 'react'
import { Check, X } from 'lucide-react'
import { validatePasswordPolicy, type PasswordValidationResult } from '@/lib/auth-policy'

interface PasswordRequirementsChecklistProps {
  password: string
  confirmPassword?: string
  showConfirmMatch?: boolean
  className?: string
}

export default function PasswordRequirementsChecklist({
  password,
  confirmPassword,
  showConfirmMatch = false,
  className = '',
}: PasswordRequirementsChecklistProps) {
  const result: PasswordValidationResult = React.useMemo(() => {
    return validatePasswordPolicy(password)
  }, [password])

  const { criteria, score } = result

  const isMatching = React.useMemo(() => {
    if (!showConfirmMatch || confirmPassword === undefined) return null
    if (!password || !confirmPassword) return null
    return password === confirmPassword
  }, [password, confirmPassword, showConfirmMatch])

  // Don't show if user hasn't started typing
  if (!password && !confirmPassword) {
    return null
  }

  const strengthColor =
    score >= 5
      ? 'bg-emerald-500'
      : score >= 4
      ? 'bg-teal-500'
      : score >= 3
      ? 'bg-amber-500'
      : 'bg-rose-500'

  const strengthLabel =
    score >= 5
      ? 'Institutional Grade (Strong)'
      : score >= 4
      ? 'Good Security'
      : score >= 3
      ? 'Moderate'
      : 'Weak'

  return (
    <div className={`space-y-2.5 p-3 rounded-2xl bg-zinc-50 dark:bg-surface-2 border border-zinc-200/80 dark:border-white/[0.08] text-left animate-in fade-in-50 duration-200 ${className}`}>
      {/* Strength Bar & Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Password Strength</span>
          <span
            className={`font-bold ${
              score >= 5
                ? 'text-emerald-600 dark:text-emerald-400'
                : score >= 3
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {strengthLabel}
          </span>
        </div>

        {/* 5-Segment Progress Bar */}
        <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full">
          {[1, 2, 3, 4, 5].map((seg) => (
            <div
              key={seg}
              className={`h-full rounded-full transition-all duration-300 ${
                score >= seg ? strengthColor : 'bg-zinc-200 dark:bg-zinc-700/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 5 Criteria Badges Grid */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10.5px] font-sans">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
            criteria.minLength
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
              : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {criteria.minLength ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
          <span>8+ Characters</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
            criteria.hasUpper
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
              : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {criteria.hasUpper ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
          <span>Uppercase (A-Z)</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
            criteria.hasLower
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
              : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {criteria.hasLower ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
          <span>Lowercase (a-z)</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
            criteria.hasNumber
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
              : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {criteria.hasNumber ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
          <span>Number (0-9)</span>
        </div>

        <div
          className={`col-span-2 flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
            criteria.hasSpecial
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
              : 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {criteria.hasSpecial ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-40" />}
          <span>Special Symbol (!@#$%^&*)</span>
        </div>
      </div>

      {/* Password Match Indicator (if enabled) */}
      {showConfirmMatch && confirmPassword !== undefined && confirmPassword.length > 0 && (
        <div
          className={`mt-1.5 p-2 rounded-xl text-xs font-mono flex items-center gap-2 border transition-all ${
            isMatching
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {isMatching ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
          <span>{isMatching ? 'Passwords match' : 'Passwords do not match'}</span>
        </div>
      )}
    </div>
  )
}
