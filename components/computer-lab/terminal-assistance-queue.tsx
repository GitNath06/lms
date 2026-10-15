'use client'

import React, { useState } from 'react'
import {
  BellRing,
  Monitor,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  ZapOff,
  User,
  X,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { acknowledgeAssistanceRequest } from '@/app/actions/terminal'

export interface LiveAssistanceItem {
  id: string
  workstationId: string
  stationLabel: string
  title: string
  description: string | null
  severity: string
  studentName: string | null
  studentRoll: string | null
  createdAt: string
}

interface TerminalAssistanceQueueProps {
  requests: LiveAssistanceItem[]
  onFocusStation?: (stationLabel: string) => void
  onDismissRequest?: (id: string) => void
}

export function TerminalAssistanceQueue({
  requests,
  onFocusStation,
  onDismissRequest,
}: TerminalAssistanceQueueProps) {
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)

  if (!requests || requests.length === 0) return null

  const handleAcknowledge = async (item: LiveAssistanceItem) => {
    setAcknowledgingId(item.id)
    const res = await acknowledgeAssistanceRequest(item.id)
    setAcknowledgingId(null)
    if (res.success) {
      onDismissRequest?.(item.id)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 sm:p-4 shadow-lg space-y-2.5 font-sans animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <BellRing className="h-3.5 w-3.5 animate-bounce" />
          </div>
          <span className="font-heading font-extrabold text-xs sm:text-sm text-white">
            Incoming Student Terminal Help Requests ({requests.length})
          </span>
        </div>
        <span className="text-[10px] text-amber-300/80 font-mono uppercase tracking-wider">
          Live Help Beacon
        </span>
      </div>

      <div className="divide-y divide-amber-500/10 space-y-2 pt-1">
        {requests.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30 font-mono font-bold text-xs">
                  {item.stationLabel}
                </Badge>
                <span className="font-bold text-white">{item.title}</span>
                {item.studentName && (
                  <span className="text-zinc-400 text-xs">
                    from <strong className="text-zinc-200">{item.studentName}</strong>
                    {item.studentRoll && (
                      <span className="text-indigo-400 font-mono ml-1">(Roll {item.studentRoll})</span>
                    )}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-[11px] text-zinc-400 italic line-clamp-1">
                  &ldquo;{item.description}&rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {onFocusStation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onFocusStation(item.stationLabel)}
                  className="h-7 px-2.5 text-xs rounded-lg border-amber-500/30 text-amber-200 hover:bg-amber-500/20 gap-1"
                >
                  <Monitor className="h-3 w-3" />
                  <span>Locate Node</span>
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={() => handleAcknowledge(item)}
                disabled={acknowledgingId === item.id}
                className="h-7 px-2.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium gap-1"
              >
                {acknowledgingId === item.id ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span>Acknowledge</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
