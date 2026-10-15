'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Monitor,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Building2,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { WorkstationFloorPlan } from '@/components/maintenance/workstations/workstation-floor-plan'
import { getWorkstationBoardData } from '@/app/actions/workstations'
import { getLabFloorElements } from '@/app/actions/floor-elements'
import type { WorkstationBoardData, WorkstationWithIssues } from '@/types/workstations'
import type { LabFloorElementRow } from '@/types/database'

interface AdminFloorDesignerProps {
  isEditModeUnlocked: boolean
}

const LAB_OPTIONS = [
  { id: 'comp', name: 'Computer Lab 01' },
]

export default function AdminFloorDesigner({
  isEditModeUnlocked,
}: AdminFloorDesignerProps) {
  const [selectedLabId, setSelectedLabId] = useState<string>('comp')
  const [boardData, setBoardData] = useState<WorkstationBoardData | null>(null)
  const [floorElements, setFloorElements] = useState<LabFloorElementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWs, setSelectedWs] = useState<WorkstationWithIssues | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bData, fData] = await Promise.all([
        getWorkstationBoardData(selectedLabId),
        getLabFloorElements(selectedLabId),
      ])
      setBoardData(bData)
      if (fData.success && fData.data) {
        setFloorElements(fData.data)
      }
    } catch (err) {
      console.error('Error loading floor designer data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedLabId])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-4 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Top Controls Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Monitor className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-extrabold text-sm text-zinc-950 dark:text-white">
                Floor Plan & Hardware Topology Designer
              </h3>
              <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border-indigo-500/20">
                Admin Console
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Drag-and-drop coordinate calibration, architectural landmarks, and device provisioning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            className="h-8.5 text-xs bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-xl"
          >
            {LAB_OPTIONS.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8.5 px-3 text-xs gap-1.5 rounded-xl border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/computer-lab">
            <Button
              type="button"
              size="sm"
              className="h-8.5 px-3 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Live Lab Workspace</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Safety Notice if Locked */}
      {!isEditModeUnlocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Precaution Active: Floor layout editing and coordinate drag handles require enabling <strong>Edit Mode</strong> at the top of the Admin Console.
            </span>
          </div>
        </div>
      )}

      {/* Interactive Floor Plan Canvas */}
      {loading ? (
        <div className="h-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>Loading laboratory floor topology...</span>
          </div>
        </div>
      ) : boardData ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 p-2 sm:p-4 shadow-sm">
          <WorkstationFloorPlan
            workstations={boardData.workstations}
            categories={boardData.categories}
            floorElements={floorElements}
            labId={boardData.lab_id}
            labName={boardData.lab_name}
            isPrivileged={isEditModeUnlocked}
            onSelectWorkstation={(ws) => setSelectedWs(ws)}
            onRefreshData={loadData}
          />
        </div>
      ) : (
        <div className="h-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-xs text-zinc-500">
          Failed to load lab floor data.
        </div>
      )}
    </div>
  )
}
