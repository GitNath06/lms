'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  Printer,
  ArrowLeft,
  LucideIcon,
  Stamp,
  Check,
  RotateCcw,
  Shield,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { INSTITUTION_CONFIG } from '@/lib/institution'
import { FootnoteEntry, PrintDensityMode } from '@/types/report-spec'

export interface SignatoryItem {
  title: string
  subtitle: string
}

export type SignatoryRoleKey = 'teacher' | 'incharge' | 'hod' | 'principal'

export const STANDARD_SIGNATORIES: Record<SignatoryRoleKey, SignatoryItem> = {
  teacher: {
    title: 'SUBJECT INSTRUCTOR / TEACHER',
    subtitle: 'Practical Session & Syllabus Endorsement',
  },
  incharge: {
    title: 'LABORATORY IN-CHARGE',
    subtitle: 'Technical Verification & Attendance Audit',
  },
  hod: {
    title: 'HEAD OF DEPARTMENT (HOD)',
    subtitle: 'Academic Oversight & Curricular Verification',
  },
  principal: {
    title: 'CAMPUS CHIEF / PRINCIPAL',
    subtitle: 'Institutional Certification & Endorsement',
  },
}

export interface PrintLayoutProps {
  // Top control bar (hidden during print)
  icon?: LucideIcon
  title: string
  subtitle: string
  backHref: string
  backLabel: string
  printButtonLabel?: string
  printButtonColorClass?: string

  // Density mode controls
  densityMode?: PrintDensityMode
  onDensityModeChange?: (mode: PrintDensityMode) => void
  showDensityToggle?: boolean

  // Letterhead configuration
  documentTitleBadge: string
  headerSubtitle?: string
  nepaliName?: string
  headerFacilityName?: string
  headerAcademicYear?: string

  // Metadata / Summary section (placed above main data table)
  metadataGrid?: React.ReactNode

  // Scope / Summary bar right under header
  subHeaderBanner?: React.ReactNode

  // Main domain-specific records / table content
  children: React.ReactNode

  // Audit Footnotes Annex
  footnotes?: FootnoteEntry[]

  // Signatures configuration
  signatories?: SignatoryItem[]
  signatureTier?: '2-tier' | '3-tier'

  // Footer note
  footerNote?: string

  // Optional serif styling for inner sheet
  fontSerif?: boolean
}

export default function PrintLayout({
  icon: Icon = Printer,
  title,
  subtitle,
  backHref,
  backLabel,
  printButtonLabel = 'Print / Save to PDF',
  printButtonColorClass = 'bg-indigo-600 hover:bg-indigo-700',
  densityMode,
  onDensityModeChange,
  showDensityToggle = true,
  documentTitleBadge,
  headerSubtitle,
  nepaliName,
  headerFacilityName,
  headerAcademicYear,
  metadataGrid,
  subHeaderBanner,
  children,
  footnotes,
  signatories,
  signatureTier = '2-tier',
  footerNote = 'Certified Institutional Audit Copy',
  fontSerif = false,
}: PrintLayoutProps) {
  // Refinement #4: Deterministic SSR hydration
  const [internalDensity, setInternalDensity] = useState<PrintDensityMode>(densityMode || 'detailed')

  useEffect(() => {
    if (!densityMode && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lmr_print_density_mode') as PrintDensityMode | null
        if (saved === 'compact' || saved === 'detailed') {
          setInternalDensity(saved)
        }
      } catch {}
    }
  }, [densityMode])

  useEffect(() => {
    if (densityMode && densityMode !== internalDensity) {
      setInternalDensity(densityMode)
    }
  }, [densityMode, internalDensity])

  const activeDensity = densityMode ?? internalDensity

  const handleDensityChange = (mode: PrintDensityMode) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lmr_print_density_mode', mode)
      } catch {}
    }
    setInternalDensity(mode)
    onDensityModeChange?.(mode)
  }

  // Dual orientation switch
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')

  // Configurable Signatories State
  const [selectedSignatoryKeys, setSelectedSignatoryKeys] = useState<SignatoryRoleKey[]>(() => {
    if (signatureTier === '3-tier') return ['teacher', 'incharge', 'hod']
    return ['incharge', 'hod']
  })
  const [isSignatoryMenuOpen, setIsSignatoryMenuOpen] = useState<boolean>(false)

  const toggleSignatory = (key: SignatoryRoleKey) => {
    setSelectedSignatoryKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  // Resolved Signatories List
  const resolvedSignatories: SignatoryItem[] =
    signatories && signatories.length > 0 && selectedSignatoryKeys.length === 0
      ? signatories
      : selectedSignatoryKeys.map((k) => STANDARD_SIGNATORIES[k])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 font-sans print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-0">
      {/* Universal Dynamic Print CSS for Orientation & Register Density */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 ${orientation};
              margin: ${orientation === 'landscape' ? '6mm 8mm' : '8mm 8mm'};
            }
            @media print {
              html, body {
                height: auto !important;
                min-height: 100% !important;
                overflow: visible !important;
                background: #ffffff !important;
                color: #000000 !important;
                color-scheme: light !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .h-screen,
              [class*="h-screen"],
              .overflow-hidden,
              .overflow-y-auto,
              main {
                height: auto !important;
                overflow: visible !important;
                max-height: none !important;
              }
              :root,
              .dark,
              html.dark {
                --bg-canvas: #ffffff !important;
                --background: #ffffff !important;
                --foreground: #000000 !important;
                --color-surface-elevated: #ffffff !important;
                --color-surface-sunken: #f8fafc !important;
                --color-border: #cbd5e1 !important;
                --color-text-main: #000000 !important;
                --color-text-sub: #334155 !important;
                --color-text-muted: #64748b !important;
              }
              .print-dense-table table {
                border-collapse: collapse !important;
                width: 100% !important;
              }
              .print-dense-table th,
              .print-dense-table td {
                border-color: #94a3b8 !important;
              }
              .print-dense-table th {
                background-color: #f1f5f9 !important;
                color: #0f172a !important;
              }
              /* Compact Ledger Density Mode */
              .print-mode-compact table th,
              .print-mode-compact table td {
                padding-top: 2px !important;
                padding-bottom: 2px !important;
                padding-left: 4px !important;
                padding-right: 4px !important;
                font-size: 7.5pt !important;
                line-height: 1.15 !important;
              }
              /* Detailed Audit Density Mode */
              .print-mode-detailed table th,
              .print-mode-detailed table td {
                padding-top: 5px !important;
                padding-bottom: 5px !important;
                padding-left: 6px !important;
                padding-right: 6px !important;
                font-size: 8.5pt !important;
                line-height: 1.35 !important;
              }
              .break-inside-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `,
        }}
      />

      {/* Interactive Controls Bar (Hidden during window.print()) */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <Icon className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold font-heading text-zinc-900 dark:text-zinc-50 tracking-tight">
              {title}
            </h1>
          </div>
          <p className="text-xs text-subtext text-zinc-500 dark:text-slate-300 mt-0.5">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Orientation Switcher */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white'
              }`}
              title="A4 Landscape Orientation"
            >
              Landscape
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white'
              }`}
              title="A4 Portrait Orientation"
            >
              Portrait
            </button>
          </div>

          {/* Density Mode Switcher */}
          {showDensityToggle && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => handleDensityChange('detailed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeDensity === 'detailed'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Detailed (Audit)
              </button>
              <button
                type="button"
                onClick={() => handleDensityChange('compact')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeDensity === 'compact'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Compact Ledger
              </button>
            </div>
          )}

          {/* Signatories Configurator Popover */}
          <PopoverPrimitive.Root open={isSignatoryMenuOpen} onOpenChange={setIsSignatoryMenuOpen}>
            <PopoverPrimitive.Trigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs gap-1.5 rounded-xl cursor-pointer border-zinc-200 dark:border-zinc-700"
              >
                <Shield className="h-3.5 w-3.5 text-indigo-500" />
                <span>Signatures ({selectedSignatoryKeys.length})</span>
              </Button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="end"
                sideOffset={6}
                className="z-50 w-72 p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl space-y-3 text-xs font-sans animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-indigo-500" />
                    <span className="font-bold text-zinc-900 dark:text-white font-heading">
                      Signatory Blocks
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">NEB Official</span>
                </div>

                {/* Checkbox Options */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selectedSignatoryKeys.includes('teacher')}
                      onChange={() => toggleSignatory('teacher')}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Subject Teacher / Instructor</span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selectedSignatoryKeys.includes('incharge')}
                      onChange={() => toggleSignatory('incharge')}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Laboratory In-Charge</span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selectedSignatoryKeys.includes('hod')}
                      onChange={() => toggleSignatory('hod')}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Head of Department (HOD)</span>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selectedSignatoryKeys.includes('principal')}
                      onChange={() => toggleSignatory('principal')}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Campus Chief / Principal</span>
                  </label>
                </div>

                {/* Preset shortcuts */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSignatoryKeys(['teacher', 'incharge', 'hod', 'principal'])
                    }}
                    className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium"
                  >
                    All 4 (Complete)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSignatoryKeys(['incharge', 'hod'])
                    }}
                    className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium"
                  >
                    2-Tier (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSignatoryKeys([])
                    }}
                    className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer font-medium"
                  >
                    None (Draft)
                  </button>
                </div>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>

          <Link href={backHref}>
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 rounded-xl cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{backLabel}</span>
            </Button>
          </Link>

          <Button
            onClick={() => window.print()}
            className={`h-9 px-4 rounded-xl text-white text-xs font-mono font-bold shadow-xs gap-2 cursor-pointer ${printButtonColorClass}`}
          >
            <Printer className="h-4 w-4" />
            <span>{printButtonLabel}</span>
          </Button>
        </div>
      </div>

      {/* Printable Sheet Viewport */}
      {/* Printable Sheet Viewport Canvas (WYSIWYG on-screen dimensions matching A4) */}
      <div className="flex justify-center w-full overflow-x-auto pb-12 pt-2 print:p-0 print:m-0 print:overflow-visible">
        <div
          className={`bg-white text-zinc-950 p-6 sm:p-8 rounded-xl shadow-2xl transition-all duration-300 print:p-0 print:shadow-none print:rounded-none border border-zinc-200/80 print:border-none ${
            orientation === 'portrait'
              ? 'w-full max-w-[794px] min-h-[1122px]'
              : 'w-full max-w-[1122px] min-h-[794px]'
          } ${activeDensity === 'compact' ? 'print-mode-compact' : 'print-mode-detailed'} ${fontSerif ? 'font-serif' : 'font-sans'}`}
        >
          {/* Official Institutional Letterhead */}
          <div className="text-center pb-3 border-b-2 border-zinc-900 mb-3 print:pb-2 print:mb-2 font-sans">
            {nepaliName ? (
              <h2 className="text-base font-extrabold font-heading text-zinc-800 uppercase tracking-wide">
                {nepaliName}
              </h2>
            ) : (
              <h2 className="text-base font-extrabold font-heading text-zinc-800 uppercase tracking-wide">
                {INSTITUTION_CONFIG.nameNepali}
              </h2>
            )}
            <h1 className="text-xl sm:text-2xl font-black font-heading text-zinc-950 uppercase tracking-wider mt-0.5">
              {INSTITUTION_CONFIG.name}
            </h1>
            <p className="text-xs text-zinc-600 font-medium mt-0.5">
              {INSTITUTION_CONFIG.department}
            </p>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              {INSTITUTION_CONFIG.location}
            </p>

            <div className="mt-2.5 inline-block px-4 py-1.5 bg-zinc-900 text-white text-[11px] font-mono font-bold uppercase tracking-widest rounded-sm print:bg-zinc-950 print:text-[8pt]">
              {documentTitleBadge}
            </div>

            {headerAcademicYear && (
              <div className="text-[10px] font-mono text-zinc-600 mt-1 print:text-[7pt]">
                Academic Cycle: <span className="font-semibold text-zinc-900">{headerAcademicYear}</span>
              </div>
            )}
          </div>

          {/* Optional Scope / Filter Banner */}
          {subHeaderBanner && <div className="mb-4 print:mb-2">{subHeaderBanner}</div>}

          {/* Optional Summary Metric Grid */}
          {metadataGrid && <div className="mb-4 print:mb-2">{metadataGrid}</div>}

          {/* Main Records Content (Table / Routine Grid / Incidents) */}
          <div className="w-full">{children}</div>

          {/* Audit Footnotes Annex (Rendered if any footnotes exist) */}
          {footnotes && footnotes.length > 0 && (
            <div className="mt-4 pt-3 border-t-2 border-zinc-800 break-inside-avoid print:break-inside-avoid print:mt-2 print:pt-2 font-sans footnotes-block">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-900">
                  Audit Trail Footnotes &amp; Extended Narrative Notes
                </h3>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {footnotes.length} Annotated {footnotes.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-zinc-700">
                {footnotes.map((fn) => (
                  <div key={fn.index} className="flex items-start gap-1.5">
                    <span className="font-mono font-bold text-indigo-700 print:text-zinc-950 text-xs shrink-0">
                      [{fn.index}]
                    </span>
                    <div className="text-[10px] print:text-[8pt] leading-relaxed">
                      <strong className="text-zinc-900 font-semibold">{fn.rowIdentifier} — {fn.fieldName}:</strong>{' '}
                      <span className="text-zinc-700 italic font-serif">"{fn.fullText}"</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Institutional Signatures Block (Full-Width Justified) */}
          {resolvedSignatories.length > 0 && (
            <div className="pt-6 px-2 mt-6 font-sans signature-block break-inside-avoid print:break-inside-avoid print:pt-4 print:mt-4 border-t border-zinc-200">
              <div
                className={`grid gap-6 print:gap-3 w-full ${
                  resolvedSignatories.length === 1
                    ? 'grid-cols-1 max-w-xs mx-auto'
                    : resolvedSignatories.length === 2
                    ? 'grid-cols-2 justify-between'
                    : resolvedSignatories.length === 3
                    ? 'grid-cols-3 justify-between'
                    : 'grid-cols-2 sm:grid-cols-4 justify-between'
                }`}
              >
                {resolvedSignatories.map((sig, idx) => (
                  <div key={idx} className="text-center w-full px-2">
                    <div className="border-t-2 border-zinc-900 pt-1.5 w-full max-w-[200px] mx-auto">
                      <p className="text-[11px] print:text-[8pt] font-bold uppercase tracking-wider text-zinc-900 leading-tight">
                        {sig.title}
                      </p>
                      <p className="text-[9px] print:text-[7pt] text-zinc-500 mt-0.5 leading-tight">
                        {sig.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Footer */}
          <div
            suppressHydrationWarning
            className="text-center mt-6 pt-2 border-t border-zinc-200 text-[10px] print:text-[8px] text-zinc-400 font-mono print:mt-2 print:pt-1"
          >
            {INSTITUTION_CONFIG.systemTitle} • {footerNote} • Generated:{' '}
            {new Date().toISOString().split('T')[0]}
          </div>
        </div>
      </div>
    </div>
  )
}
