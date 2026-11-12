'use client'

import React, { useState, useEffect } from 'react'
import { Download, Share, Plus, X, Smartphone, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SNOOZE_KEY = 'labsync_pwa_prompt_snoozed_until_v1'
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function PwaInstallPrompt() {
  const [isStandalone, setIsStandalone] = useState<boolean>(true)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIos, setIsIos] = useState<boolean>(false)
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false)
  const [isDismissed, setIsDismissed] = useState<boolean>(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Detect standalone mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://')

    setIsStandalone(standaloneMode)
    if (standaloneMode) return

    // 2. Check snooze timestamp
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY)
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) {
      return
    }
    setIsDismissed(false)

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(ua)
    const isWebkit = /webkit/.test(ua)
    const isSafari = isIosDevice && isWebkit && !/crios|fxios|opios|mercury/.test(ua)
    setIsIos(isSafari)

    // 4. Android / Chromium beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsDismissed(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsDismissed(true)
      }
      setDeferredPrompt(null)
    } else if (isIos) {
      setShowIosGuide(true)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setShowIosGuide(false)
    try {
      localStorage.setItem(SNOOZE_KEY, (Date.now() + SNOOZE_DURATION_MS).toString())
    } catch {}
  }

  // Hide if already running in standalone mode or dismissed
  if (isStandalone || isDismissed) {
    return null
  }

  return (
    <>
      {/* Non-intrusive floating install card for mobile and desktop */}
      <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="bg-[#101726]/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-zinc-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-heading font-bold text-white truncate">
                Install LabSync Terminal
              </h4>
              <p className="text-[11px] text-zinc-400 truncate">
                Fast 1-tap access &amp; zero-loss offline attendance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-heading font-bold shadow-md transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="h-7 w-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Dismiss install banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari 3-Step Visual Instruction Sheet */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#101726] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] w-full max-w-md shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-indigo-400" />
                <span>Install on Apple iOS</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              Safari on iOS does not support 1-tap installs. Follow these 3 quick steps to add LabSync to your Home Screen:
            </p>

            <div className="space-y-3.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="text-xs text-zinc-300">
                  Tap the <span className="font-semibold text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-zinc-800"><Share className="h-3 w-3" /> Share</span> button in Safari&apos;s bottom toolbar.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="text-xs text-zinc-300">
                  Scroll down the menu and tap <span className="font-semibold text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-zinc-800"><Plus className="h-3 w-3" /> Add to Home Screen</span>.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <div className="h-6 w-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  3
                </div>
                <div className="text-xs text-zinc-300">
                  Tap <span className="font-semibold text-white">Add</span> in the top-right corner to finish.
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-heading font-bold text-xs text-white shadow-lg cursor-pointer transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

