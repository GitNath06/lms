'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pairWorkstationTerminal } from '@/app/actions/terminal'

function TerminalPairingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialStation = searchParams.get('station') || ''
  const initialSecret = searchParams.get('secret') || searchParams.get('token') || ''

  const [stationCode, setStationCode] = useState(initialStation)
  const [lanIp, setLanIp] = useState('')
  const [isPairing, setIsPairing] = useState(false)
  const [pairingSuccess, setPairingSuccess] = useState(false)
  const [generatedToken, setGeneratedToken] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stationCode.trim()) {
      setErrorMsg('Please specify workstation label (e.g. PC-12 or A4).')
      return
    }

    setIsPairing(true)
    setErrorMsg(null)

    const res = await pairWorkstationTerminal(stationCode.trim(), initialSecret || undefined, lanIp || undefined)
    setIsPairing(false)

    if (res.success && res.pairingToken) {
      setGeneratedToken(res.pairingToken)
      setPairingSuccess(true)
      // Save pairing token to localStorage for persistent hardware lock
      if (typeof window !== 'undefined') {
        localStorage.setItem('labsync_paired_station', stationCode.trim())
        localStorage.setItem('labsync_paired_token', res.pairingToken)
        localStorage.setItem(`labsync_paired_token_${stationCode.trim()}`, res.pairingToken)
      }
    } else {
      setErrorMsg(res.error || 'Failed to pair workstation terminal.')
    }
  }

  return (
    <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center shadow-md">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold font-heading text-white">
          Hardware Terminal Pairing Lock
        </h1>
        <p className="text-xs text-zinc-400">
          Pair this browser to a physical workstation to enable anti-spoofing protection and 1-tap student assistance reporting.
        </p>
      </div>

      {pairingSuccess ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Terminal Paired Successfully!</span>
            </div>
            <p className="text-xs text-emerald-300/90">
              This browser is now cryptographically bound to{' '}
              <strong className="text-white font-mono">{stationCode.trim()}</strong>. Reports from other desks cannot spoof this terminal.
            </p>
            <div className="pt-1 text-[11px] font-mono text-emerald-400/80 break-all bg-emerald-950/80 p-2 rounded-lg border border-emerald-800/40">
              Token: {generatedToken}
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => router.push(`/terminal/${encodeURIComponent(stationCode.trim())}`)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              <span>Launch Student Terminal View</span>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePair} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Workstation Label / Code</label>
            <Input
              type="text"
              placeholder="e.g. PC-12 or A4"
              value={stationCode}
              onChange={(e) => setStationCode(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-sm font-mono uppercase text-zinc-100"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Static LAN IP Address (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. 192.168.1.130"
              value={lanIp}
              onChange={(e) => setLanIp(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-xs font-mono text-zinc-100"
            />
            <p className="text-[10px] text-zinc-500">
              Network-level IP verification ensures reports originate from this physical LAN outlet.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isPairing || !stationCode.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isPairing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Cryptographic Pairing...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pair Browser to Terminal</span>
              </>
            )}
          </Button>
        </form>
      )}

      <div className="border-t border-zinc-800/80 pt-4 text-center">
        <Link href="/computer-lab" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Return to Lab Floor Plan & Live Cockpit
        </Link>
      </div>
    </div>
  )
}

export default function TerminalPairPage() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <Suspense fallback={<div className="text-xs text-zinc-500 font-mono">Loading pairing security manager...</div>}>
        <TerminalPairingContent />
      </Suspense>
    </div>
  )
}
