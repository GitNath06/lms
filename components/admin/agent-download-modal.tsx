'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Download,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Server,
  Layers,
  Key,
  X,
} from 'lucide-react'
import { getInstitutionalPairingKey } from '@/app/actions/workstations'

interface AgentDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  defaultLabId?: string
  labs?: Array<{ id: string; name: string }>
}

export function AgentDownloadModal({
  isOpen,
  onClose,
  defaultLabId = 'comp',
  labs = [{ id: 'comp', name: 'Computer Laboratory' }],
}: AgentDownloadModalProps) {
  const [serverUrl, setServerUrl] = useState('')
  const [selectedLabId, setSelectedLabId] = useState(defaultLabId)
  const [customToken, setCustomToken] = useState('')
  const [pairingToken, setPairingToken] = useState('')
  const [copiedScript, setCopiedScript] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setServerUrl(window.location.origin)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      getInstitutionalPairingKey().then((res) => {
        if (res.success && res.token) {
          setPairingToken(res.token)
        }
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  const effectiveToken = customToken.trim() || pairingToken
  const tokenQueryParam = effectiveToken ? `&token=${encodeURIComponent(effectiveToken)}` : ''

  const downloadUrl = `/api/terminal/agent/download?serverUrl=${encodeURIComponent(
    serverUrl || 'http://localhost:3000'
  )}&labId=${encodeURIComponent(selectedLabId)}${tokenQueryParam}`

  const quickPsCommand = `Invoke-WebRequest -Uri "${serverUrl || 'http://localhost:3000'}/api/terminal/agent/download?labId=${selectedLabId}${tokenQueryParam}" -OutFile "$env:TEMP\\Setup-LabTerminal.bat"; Start-Process "$env:TEMP\\Setup-LabTerminal.bat" -Verb runAs`

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(quickPsCommand)
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2000)
    } catch {
      // Graceful fallback
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#101726] border border-zinc-200 dark:border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl p-6 text-zinc-900 dark:text-zinc-100 font-sans relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-zinc-900 dark:text-white">
                Download Lab Terminal Setup Agent
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Generate a self-contained Windows batch installer for physical lab computers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 pt-3 text-xs">
          {/* Server URL Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-indigo-500" />
              <span>Laboratory Server Address (LAN IP / Hostname)</span>
            </label>
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.50:3000"
              className="font-mono text-xs h-9 bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700"
            />
            <p className="text-[10px] text-zinc-500">
              Ensure this IP is reachable by lab computers over the campus local network.
            </p>
          </div>

          {/* Laboratory Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span>Target Laboratory Room</span>
            </label>
            <select
              value={selectedLabId}
              onChange={(e) => setSelectedLabId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name} ({lab.id})
                </option>
              ))}
            </select>
          </div>

          {/* Institutional Pairing Token Status */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                  Institutional Security Token
                </p>
                <p className="text-[10px] text-zinc-500">
                  {pairingToken ? 'Cryptographically embedded into installer payload' : 'Verifying permissions...'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
              {pairingToken ? 'Ready' : 'Pending'}
            </span>
          </div>

          {/* Instructions Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>How It Works (1-Click Deployment)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pl-1">
              <li>Download the batch installer onto a USB flash drive or run the PowerShell 1-liner below.</li>
              <li>Right-click and select <strong className="text-zinc-900 dark:text-white">&ldquo;Run as administrator&rdquo;</strong> on each PC.</li>
              <li>The script binds the physical hardware, configures auto-boot, and puts the shortcut on the Desktop.</li>
            </ol>
          </div>

          {/* Quick PowerShell Command */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                Direct PowerShell 1-Liner:
              </label>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedScript ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-[10px] break-all border border-zinc-800 select-all">
              {quickPsCommand}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-2 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs rounded-xl"
          >
            Cancel
          </Button>
          <a
            href={downloadUrl}
            download={`Setup-LabTerminal-${selectedLabId}.bat`}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Download Lab Agent (.bat)</span>
          </a>
        </div>
      </div>
    </div>
  )
}
