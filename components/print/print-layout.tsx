'use client'

import React from 'react'
import Link from 'next/link'
import { Printer, ArrowLeft, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { INSTITUTION_CONFIG } from '@/lib/institution'

import { FootnoteEntry, PrintDensityMode } from '@/types/report-spec'

export interface SignatoryItem {
  title: string
  subtitle: string
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
  const [internalDensity, setInternalDensity] = React.useState<PrintDensityMode>(() => {
    if (densityMode) return densityMode
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lmr_print_density_mode') as PrintDensityMode | null
        if (saved === 'compact' || saved === 'detailed') return saved
      } catch {}
    }
    return 'detailed'
  })

  // Synchronize internal density when controlled densityMode changes
  React.useEffect(() => {
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

  // Determine default signatories if not explicitly passed
  const resolvedSignatories: SignatoryItem[] =
    signatories && signatories.length > 0
      ? signatories
      : signatureTier === '3-tier'
      ? [
          {
            title: 'LABORATORY IN-CHARGE',
            subtitle: 'Technical Verification & Servicing Audit',
          },
          {
            title: 'ACADEMIC COORDINATOR',
            subtitle: 'Curricular Oversight & Schedule Verification',
          },
          {
            title: 'CAMPUS CHIEF / PRINCIPAL',
            subtitle: 'Institutional Endorsement & Certification',
          },
        ]
      : [
          {
            title: INSTITUTION_CONFIG.signatures.left.title.toUpperCase(),
            subtitle: INSTITUTION_CONFIG.signatures.left.subtitle,
          },
          {
            title: INSTITUTION_CONFIG.signatures.right.title.toUpperCase(),
            subtitle: INSTITUTION_CONFIG.signatures.right.subtitle,
          },
        ]

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 font-sans print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-0">
      {/* Universal Print CSS for Landscape A4 & Register Density */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 landscape;
              margin: 6mm 8mm;
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
                --surface-1: #ffffff !important;
                --surface-2: #ffffff !important;
                --surface-3: #ffffff !important;
                --foreground: #000000 !important;
                color-scheme: light !important;
              }
              html,
              body,
              main,
              .bg-canvas,
              [class*="bg-canvas"],
              .dark,
              .dark body,
              .dark main,
              .dark [class*="bg-canvas"],
              .dark div {
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
              }
              main {
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                height: auto !important;
                overflow: visible !important;
                max-height: none !important;
              }
              thead {
                display: table-header-group !important;
              }
              tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .signature-block,
              .footnotes-block,
              .break-inside-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }

              /* Compact Ledger Density Mode */
              .print-mode-compact table th,
              .print-mode-compact table td {
                padding-top: 1.5px !important;
                padding-bottom: 1.5px !important;
                padding-left: 3.5px !important;
                padding-right: 3.5px !important;
                font-size: 7.5pt !important;
                line-height: 1.15 !important;
              }
              .print-mode-compact .subtext-line {
                font-size: 6.8pt !important;
              }

              /* Detailed Audit Density Mode */
              .print-mode-detailed table th,
              .print-mode-detailed table td {
                padding-top: 3.5px !important;
                padding-bottom: 3.5px !important;
                padding-left: 5px !important;
                padding-right: 5px !important;
                font-size: 8.5pt !important;
                line-height: 1.25 !important;
              }
            }
          `,
        }}
      />

      {/* Interactive Controls Bar (Hidden during window.print()) */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2 font-mono">
            <Icon className="h-5 w-5 text-indigo-500" />
            {title}
          </h2>
          <p className="text-xs text-subtext text-zinc-500 dark:text-slate-300 mt-0.5">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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

      {/* Formal Printable Document Body */}
      <div
        className={`bg-white text-zinc-950 p-6 sm:p-10 rounded-2xl border border-zinc-200/90 shadow-xs print-sheet print-light-surface print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full ${
          activeDensity === 'compact' ? 'print-mode-compact' : 'print-mode-detailed'
        } ${fontSerif ? 'font-serif' : 'font-sans'}`}
      >
        {/* Unified Institutional Letterhead Header (Single Source of Truth) */}
        <div className="text-center border-b-2 border-zinc-900 pb-5 mb-5 print:pb-2 print:mb-2">
          <div className="text-[11px] uppercase tracking-widest font-bold text-zinc-600 mb-1 font-sans print:text-[7pt] print:mb-0.5">
            {headerSubtitle || INSTITUTION_CONFIG.systemSubtitle}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-zinc-950 font-serif print:text-[13pt] print:leading-tight">
            {INSTITUTION_CONFIG.name}
          </h1>
          {nepaliName && (
            <div className="text-sm font-serif text-zinc-800 font-bold mt-0.5 print:text-[8pt] print:mt-0">
              {nepaliName}
            </div>
          )}
          <p className="text-xs text-zinc-600 mt-1 font-sans print:text-[7.5pt] print:mt-0.5">
            {INSTITUTION_CONFIG.department} • {INSTITUTION_CONFIG.location}
          </p>
          <div className="inline-block mt-3 px-4 py-1 border border-zinc-900 rounded-md text-xs font-bold uppercase tracking-wider bg-zinc-50 font-mono print:mt-1 print:px-2.5 print:py-0.5 print:text-[7.5pt] print:bg-transparent print:border-zinc-800 print:rounded-xs">
            {documentTitleBadge}
          </div>

          {(headerFacilityName || headerAcademicYear) && (
            <div className="mt-4 pt-2 border-t border-zinc-300 flex flex-wrap justify-between items-center text-xs font-medium text-zinc-700 font-sans print:mt-1.5 print:pt-1 print:text-[7pt]">
              {headerFacilityName && (
                <span>
                  FACILITY: <strong className="text-zinc-950 uppercase">{headerFacilityName}</strong>
                </span>
              )}
              {headerAcademicYear && (
                <span>
                  ACADEMIC YEAR: <strong>{headerAcademicYear}</strong>
                </span>
              )}
              <span suppressHydrationWarning>
                GENERATED: {new Date().toISOString().split('T')[0]}
              </span>
            </div>
          )}
        </div>

        {/* Metadata Grid (Unified for Screen & Print) */}
        {metadataGrid}

        {/* Sub-Header / Summary Banner */}
        {subHeaderBanner}

        {/* Main Records Content (Table) */}
        {children}

        {/* Audit Footnotes Annex (Rendered immediately above signatures) */}
        {footnotes && footnotes.length > 0 && (
          <div className="mt-6 pt-3 border-t-2 border-zinc-900 footnotes-block break-inside-avoid print:break-inside-avoid font-sans">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 font-mono">
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

        {/* Institutional Signatures Block */}
        <div
          className={`grid ${
            resolvedSignatories.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          } gap-8 pt-8 px-6 mt-8 font-sans signature-block break-inside-avoid print:break-inside-avoid print:pt-4 print:mt-4 print:px-4`}
        >
          {resolvedSignatories.map((sig, idx) => (
            <div key={idx} className="text-center">
              <div className="border-t-2 border-zinc-900 pt-1.5 mx-auto w-52 print:w-44">
                <p className="text-xs print:text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                  {sig.title}
                </p>
                <p className="text-[10px] print:text-[8px] text-zinc-500 mt-0.5">
                  {sig.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Verification Footer */}
        <div
          suppressHydrationWarning
          className="text-center mt-8 pt-3 border-t border-zinc-200 text-[10px] print:text-[8px] text-zinc-400 font-mono print:mt-3 print:pt-1"
        >
          {INSTITUTION_CONFIG.systemTitle} • {footerNote} • Generated:{' '}
          {new Date().toISOString().split('T')[0]}
        </div>
      </div>
    </div>
  )
}
