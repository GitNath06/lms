'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Maximize2, Minimize2, ArrowLeft } from 'lucide-react'
import { WorkstationNode } from '@/components/maintenance/workstations/workstation-node'
import { FloorLandmarkNode } from '@/components/maintenance/workstations/floor-landmark-node'
import { LabDeskStructureOverlay } from './lab-desk-structure-overlay'
import { getLiveSessionContext, type LiveSessionContext } from '@/app/actions/live-session'
import { deduplicateWorkstationCoordinates } from '@/lib/workstations/layout-engine'
import type { WorkstationBoardData } from '@/types/workstations'
import type { LabFloorElementRow } from '@/types/database'

interface ProjectorViewProps {
  initialBoardData: WorkstationBoardData
  floorElements: LabFloorElementRow[]
  initialSessionContext: LiveSessionContext | null
  scheduleId?: string
  labName?: string
  labCode?: string
}

export function ProjectorView({
  initialBoardData,
  floorElements,
  initialSessionContext,
  scheduleId,
  labName = 'Computer Lab 01',
  labCode = 'COM-LAB',
}: ProjectorViewProps) {
  const [boardData, setBoardData] = useState<WorkstationBoardData>(initialBoardData)
  const [sessionContext, setSessionContext] = useState<LiveSessionContext | null>(
    initialSessionContext
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // 1. Auto-request Fullscreen on Mount & track change
  useEffect(() => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // May be blocked by browser user gesture policies, which is expected
        })
      }
    } catch {
      // Browser environment guard
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 2. Workstation coordinate deduplication to guarantee zero stacked cards
  const renderedWorkstations = useMemo(() => {
    return deduplicateWorkstationCoordinates(boardData.workstations)
  }, [boardData.workstations])

  // 3. Compute bounding box of active workstations to eliminate dead top/side margins
  const bounds = useMemo(() => {
    if (!renderedWorkstations || renderedWorkstations.length === 0) {
      return { minX: 6, maxX: 94, minY: 28, maxY: 88 }
    }

    let minX = 100
    let maxX = 0
    let minY = 100
    let maxY = 0

    for (const ws of renderedWorkstations) {
      if (ws.pos_x < minX) minX = ws.pos_x
      if (ws.pos_x > maxX) maxX = ws.pos_x
      if (ws.pos_y < minY) minY = ws.pos_y
      if (ws.pos_y > maxY) maxY = ws.pos_y
    }

    return { minX, maxX, minY, maxY }
  }, [renderedWorkstations])

  // 4. Responsive Auto-Fitting Scale & Dead-Center Translation Wrapper using ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function computeTransform() {
      if (!container) return
      const width = container.clientWidth || window.innerWidth
      const height = container.clientHeight || window.innerHeight
      if (width <= 0 || height <= 0) return

      // Workstation node projector bounds in canonical stage units (1360 x 780)
      // Node half-width ~80px, node half-height ~47px
      const contentMinX = (bounds.minX / 100) * 1360 - 80
      const contentMaxX = (bounds.maxX / 100) * 1360 + 80
      const contentMinY = (bounds.minY / 100) * 780 - 47
      const contentMaxY = (bounds.maxY / 100) * 780 + 47

      const contentWidth = Math.max(100, contentMaxX - contentMinX)
      const contentHeight = Math.max(100, contentMaxY - contentMinY)
      const contentCenterX = (contentMinX + contentMaxX) / 2
      const contentCenterY = (contentMinY + contentMaxY) / 2

      // Target bounds: 94% of viewport width and 92% of viewport height
      const targetW = width * 0.94
      const targetH = height * 0.92

      const scaleX = targetW / contentWidth
      const scaleY = targetH / contentHeight
      const fitScale = Math.max(0.2, Math.min(scaleX, scaleY))

      // Dead-center horizontal and vertical translation
      const transX = width / 2 - contentCenterX * fitScale
      const transY = height / 2 - contentCenterY * fitScale

      setTransform({ scale: fitScale, x: transX, y: transY })
    }

    computeTransform()

    const observer = new ResizeObserver(() => {
      computeTransform()
    })
    observer.observe(container)

    window.addEventListener('resize', computeTransform)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', computeTransform)
    }
  }, [bounds])

  // 5. Fullscreen Toggle Helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // 6. Auto-Refresh Session & Attendance State every 10 seconds
  const refreshLiveState = useCallback(async () => {
    const targetSchedId = scheduleId || sessionContext?.scheduleId
    if (!targetSchedId) return

    try {
      const res = await getLiveSessionContext(targetSchedId)
      if (res.success && res.data) {
        setSessionContext(res.data)
      }
    } catch (err) {
      console.error('Error auto-refreshing projector state:', err)
    }
  }, [scheduleId, sessionContext?.scheduleId])

  useEffect(() => {
    const pollInterval = setInterval(refreshLiveState, 10000)
    return () => clearInterval(pollInterval)
  }, [refreshLiveState])

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen overflow-hidden cad-canvas-grid bg-slate-100 dark:bg-[#0B0F19] text-zinc-900 dark:text-white select-none m-0 p-0 rounded-none border-none">
      {/* Subtle Hover-Only Controls in top-right corner */}
      <div className="absolute top-3 right-3 z-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center gap-2 bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-2xl text-white">
        {sessionContext && (
          <span className="text-xs font-mono font-semibold text-zinc-300 pr-2 border-r border-white/10">
            {sessionContext.className} &bull; {sessionContext.subjectCode}
          </span>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <Link
          href="/computer-lab"
          className="p-1.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1 text-xs cursor-pointer"
          title="Return to Cockpit"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Exit</span>
        </Link>
      </div>

      {/* Edge-to-Edge Stage Container */}
      <div
        ref={containerRef}
        className="w-full h-full relative overflow-hidden"
      >
        <div
          style={{
            width: '1360px',
            height: '780px',
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          className="relative w-[1360px] h-[780px] shrink-0"
        >
          {/* Real-Life Architectural Desk Tables & Corridor Structures */}
          <LabDeskStructureOverlay />

          {/* Database Floor Landmarks (Doors, Windows, Board) */}
          {(Array.isArray(floorElements) ? floorElements : []).map((el) => (
            <FloorLandmarkNode key={el.id} element={el} />
          ))}

          {/* Workstations Canvas with Deduplicated Coordinates */}
          {renderedWorkstations.map((ws) => {
            let nodeAssignment: any = null
            let isPresent: boolean | undefined = undefined

            if (sessionContext) {
              const liveAssigned = sessionContext.seatPlan[ws.id]
              if (liveAssigned) {
                nodeAssignment = {
                  student_id: liveAssigned.studentId,
                  student_name: liveAssigned.fullName,
                  roll_number: liveAssigned.rollNumber,
                  enrollment_id: liveAssigned.enrollmentId,
                  is_override: liveAssigned.isOverride,
                  photo_url: (liveAssigned as any).photoUrl || (liveAssigned as any).photo_url || null,
                }
                isPresent =
                  sessionContext.existingAttendance?.[liveAssigned.enrollmentId] ??
                  (sessionContext.existingAttendance?.[liveAssigned.rollNumber] !== false)
              }
            }

            const wsWithAssignment = {
              ...ws,
              assignment: nodeAssignment,
              session_override: nodeAssignment?.is_override
                ? {
                    override_id: 'temp',
                    student_name: nodeAssignment.student_name,
                    roll_number: nodeAssignment.roll_number,
                    photo_url: nodeAssignment.photo_url || null,
                  }
                : null,
              isPresent,
            }

            return (
              <WorkstationNode
                key={ws.id}
                workstation={wsWithAssignment as any}
                isSeatPlanMode={true}
                density="projector"
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
