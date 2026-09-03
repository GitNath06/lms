'use client'

import React, { useState, useEffect } from 'react'
import {
  Plus,
  RotateCcw,
  Coffee,
  Merge,
  Clock,
  Split,
  CalendarDays,
  Palmtree,
  Sparkles,
  Lock,
  Flame,
  Radio
} from 'lucide-react'
import {
  MASTER_TIME_SLOTS,
  MasterRoutineItem,
  getOrderedDays,
  getWeekDates,
  DayKey,
  formatGradeBadge
} from '@/lib/master-data'
import SessionActionModal, { ModalMode } from '@/components/schedules/session-action-modal'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'

interface AdvancedCalendarProps {
  labFilter?: string
}

export default function AdvancedCalendar({ labFilter = 'all' }: AdvancedCalendarProps) {
  const {
    dayKey: currentDayKey,
    activeSlotId,
    activeSessions,
    minutesRemaining
  } = useLiveSchedule()

  const {
    startDay,
    sundayWeekend,
    saturdayWeekend
  } = useCalendarSettings()

  const {
    routines,
    addSession,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
    resetToMaster,
  } = useRoutineState()

  const [mounted, setMounted] = useState(false)
  const [selectedSession, setSelectedSession] = useState<MasterRoutineItem | null>(null)
  const [hoveredSession, setHoveredSession] = useState<MasterRoutineItem | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('log')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const orderedDays = getOrderedDays(startDay)
  const weekDates = getWeekDates(new Date(), startDay)

  const openActionModal = (session: MasterRoutineItem, mode: ModalMode = 'log') => {
    setSelectedSession(session)
    setModalMode(mode)
    setIsModalOpen(true)
  }

  const isDayOff = (dayKey: DayKey): boolean => {
    if (dayKey === 'sun') return sundayWeekend
    if (dayKey === 'sat') return saturdayWeekend
    return false
  }

  const handleQuickAdd = (dayKey: DayKey, slotId: string) => {
    if (isDayOff(dayKey)) {
      setToastMessage('Scheduling is locked on weekend recess days.')
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    const slot = MASTER_TIME_SLOTS.find((t) => t.id === slotId)
    const timeSlot = slot?.label || '10:10 - 11:00'
    const dayObj = orderedDays.find((d) => d.id === dayKey)
    const dayLabel = (dayObj?.label as any) || 'Monday'

    const adhocSession: MasterRoutineItem = {
      id: `adhoc-${Date.now()}`,
      day: dayLabel,
      dayKey,
      timeSlot,
      slotId,
      span: 1,
      subjectCode: 'COMP-12',
      subjectTitle: 'Data Structures & Algorithms Lab',
      grade: 'Class 12',
      gradeKey: 'class-12',
      teacher: 'Assigned Faculty',
      lab: 'Computer Lab',
      labKey: 'comp',
      defaultStudents: 38,
      category: 'Computer',
      dotColor: 'bg-indigo-500',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700',
      accentColor:
        'border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 text-zinc-950 dark:text-white border-indigo-200 dark:border-indigo-500/30',
    }

    setSelectedSession(adhocSession)
    setModalMode('book')
    setIsModalOpen(true)
  }

  const handleSuccess = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // ACCURATE LAB FILTER
  const filteredRoutine = routines.filter((item) => {
    if (labFilter === 'all') return true
    if (labFilter === 'comp') return item.labKey === 'comp' || item.lab.toLowerCase().includes('comp')
    if (labFilter === 'phys') return item.labKey === 'phys' || item.lab.toLowerCase().includes('phys')
    if (labFilter === 'chem') return item.labKey === 'chem' || item.lab.toLowerCase().includes('chem')
    if (labFilter === 'bio') return item.labKey === 'bio' || item.lab.toLowerCase().includes('bio')
    return item.labKey === labFilter
  })

  // Dynamic Aurora Glow Computation (Live Session or Hovered Session)
  const targetSessionForAurora = hoveredSession || (activeSessions && activeSessions.length > 0 ? activeSessions[0] : null)
  
  const getAuroraStyles = () => {
    if (!targetSessionForAurora) {
      return {
        blob1: 'bg-indigo-500/20 dark:bg-indigo-600/15',
        blob2: 'bg-cyan-500/20 dark:bg-cyan-600/15',
        blob3: 'bg-violet-500/15 dark:bg-violet-600/10',
      }
    }

    const lab = targetSessionForAurora.lab.toLowerCase()
    const code = targetSessionForAurora.subjectCode.toUpperCase()

    if (lab.includes('comp') || code.includes('COMP') || code.includes('DBMS') || code.includes('WPD')) {
      return {
        blob1: 'bg-indigo-500/30 dark:bg-indigo-600/25',
        blob2: 'bg-violet-500/30 dark:bg-violet-600/25',
        blob3: 'bg-blue-500/20 dark:bg-blue-600/20',
      }
    }
    if (lab.includes('phys') || code.includes('PHY')) {
      return {
        blob1: 'bg-cyan-500/30 dark:bg-cyan-500/25',
        blob2: 'bg-teal-500/30 dark:bg-teal-500/25',
        blob3: 'bg-sky-500/20 dark:bg-sky-600/20',
      }
    }
    if (lab.includes('chem') || code.includes('CHEM')) {
      return {
        blob1: 'bg-rose-500/30 dark:bg-rose-500/25',
        blob2: 'bg-pink-500/30 dark:bg-pink-500/25',
        blob3: 'bg-amber-500/20 dark:bg-amber-600/20',
      }
    }
    if (lab.includes('bio') || code.includes('BIO')) {
      return {
        blob1: 'bg-emerald-500/30 dark:bg-emerald-500/25',
        blob2: 'bg-lime-500/30 dark:bg-lime-500/25',
        blob3: 'bg-teal-500/20 dark:bg-teal-600/20',
      }
    }

    return {
      blob1: 'bg-amber-500/30 dark:bg-amber-500/25',
      blob2: 'bg-orange-500/30 dark:bg-orange-500/25',
      blob3: 'bg-yellow-500/20 dark:bg-yellow-600/20',
    }
  }

  const aurora = getAuroraStyles()

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Sparkles className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Synchronizing Laboratory Matrix...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl shadow-sm overflow-hidden select-none relative backdrop-blur-xl">
      {/* 🌌 Dynamic Ambient Aurora Glow Blobs Layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className={`absolute -top-24 -left-20 w-96 h-96 rounded-full blur-[100px] transition-colors duration-1000 animate-aurora-1 ${aurora.blob1}`}
        />
        <div
          className={`absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full blur-[110px] transition-colors duration-1000 animate-aurora-2 ${aurora.blob2}`}
        />
        <div
          className={`absolute -bottom-20 left-1/3 w-[26rem] h-[26rem] rounded-full blur-[120px] transition-colors duration-1000 animate-aurora-1 ${aurora.blob3}`}
        />
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid Viewport */}
      <div className="flex-1 overflow-auto relative z-10">
        <div className="min-w-[1280px] flex flex-col h-full">
          {/* Top Axis: Time Slots Header */}
          <div className="flex border-b border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-50/95 dark:bg-zinc-900/95 sticky top-0 z-30 backdrop-blur-md">
            {/* Axis Label */}
            <div className="w-48 shrink-0 border-r border-zinc-200/90 dark:border-zinc-800/90 p-3.5 flex items-center justify-between text-xs font-mono font-extrabold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider sticky left-0 z-40 bg-zinc-50 dark:bg-zinc-900 shadow-xs">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                DAY // 2083
              </span>
              <button
                onClick={resetToMaster}
                title="Reset Routine to Master Schedule"
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 10 Period Slots */}
            <div className="flex-1 grid grid-cols-10 divide-x divide-zinc-200/80 dark:divide-zinc-800/80">
              {MASTER_TIME_SLOTS.map((slot) => {
                const isBreak = slot.id === 't6'
                const isSlotActive = activeSlotId === slot.id

                return (
                  <div
                    key={slot.id}
                    className={`p-3 px-2 text-center font-mono flex flex-col justify-center transition-colors relative ${
                      isBreak
                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                        : isSlotActive
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={`text-xs font-extrabold tracking-tight ${
                          isBreak
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-950 dark:text-white'
                        }`}
                      >
                        {slot.name}
                      </span>
                      {isSlotActive && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-0.5 font-bold">
                      {slot.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 7 Day Rows in Configured Order */}
          <div className="flex-1 flex flex-col divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
            {orderedDays.map((day) => {
              const isToday = currentDayKey === day.id
              const daySchedules = filteredRoutine.filter((s) => s.dayKey === day.id)
              const dayDateInfo = weekDates.find((w) => w.dayKey === day.id)
              const isWeekend = isDayOff(day.id)

              // Multi-track allocation
              const sessionTracks = new Map<string, number>()
              const trackOccupancy: Array<Set<number>> = [new Set(), new Set()]

              const sortedSchedules = [...daySchedules].sort((a, b) => {
                const aIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === a.slotId)
                const bIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === b.slotId)
                return aIdx - bIdx
              })

              sortedSchedules.forEach((session) => {
                const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === session.slotId)
                if (startIdx === -1) return
                const span = session.span || 1

                let chosenTrack = 0
                for (let track = 0; track < trackOccupancy.length; track++) {
                  let canFit = true
                  for (let c = startIdx; c < startIdx + span; c++) {
                    if (trackOccupancy[track].has(c)) {
                      canFit = false
                      break
                    }
                  }
                  if (canFit) {
                    chosenTrack = track
                    break
                  }
                }

                if (chosenTrack >= trackOccupancy.length) {
                  trackOccupancy.push(new Set())
                  chosenTrack = trackOccupancy.length - 1
                }

                for (let c = startIdx; c < startIdx + span; c++) {
                  trackOccupancy[chosenTrack].add(c)
                }
                sessionTracks.set(session.id, chosenTrack)
              })

              const hasTrack1 = trackOccupancy[1] && trackOccupancy[1].size > 0
              const rowHeightClass = isWeekend
                ? 'min-h-[90px]'
                : hasTrack1
                ? 'min-h-[160px]'
                : 'min-h-[120px]'

              return (
                <div
                  key={day.id}
                  className={`flex ${rowHeightClass} transition-colors relative ${
                    isToday
                      ? 'bg-emerald-500/10 dark:bg-emerald-950/20 ring-1 ring-emerald-500/40 z-10'
                      : isWeekend
                      ? 'bg-zinc-100/40 dark:bg-zinc-900/30'
                      : ''
                  }`}
                >
                  {/* Left Sticky Day Axis with High-Contrast Dual Dates */}
                  <div
                    className={`w-48 shrink-0 border-r p-4 flex flex-col justify-between sticky left-0 z-20 shadow-xs ${
                      isToday
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50/95 dark:bg-zinc-900/98 border-r-emerald-500/50'
                        : isWeekend
                        ? 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/90 dark:bg-zinc-900/80'
                        : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-base font-extrabold ${
                            isToday
                              ? 'text-emerald-900 dark:text-emerald-100'
                              : isWeekend
                              ? 'text-zinc-600 dark:text-zinc-400'
                              : 'text-zinc-950 dark:text-white'
                          }`}
                        >
                          {day.label}
                        </h4>
                        {isToday && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        )}
                      </div>

                      <div
                        className={`text-xs font-mono font-bold mt-0.5 ${
                          isToday
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {day.nepaliName}
                      </div>

                      {/* BOTH NEPALI & ENGLISH DATES */}
                      {dayDateInfo && (
                        <div className="flex items-center gap-1.5 text-xs font-mono mt-1.5 font-bold">
                          <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/60">
                            {dayDateInfo.formattedNp}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {dayDateInfo.formattedEng}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      {isToday ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 border border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          TODAY
                        </span>
                      ) : isWeekend ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          <Palmtree className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          Weekend Recess
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                          {daySchedules.length} Sessions
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 10-Column Multi-Track Grid Body */}
                  <div
                    className={`flex-1 grid grid-cols-10 divide-x relative ${
                      isToday
                        ? 'divide-emerald-500/30 dark:divide-emerald-500/20'
                        : 'divide-zinc-200/80 dark:divide-zinc-800/60'
                    }`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                      gridTemplateRows: hasTrack1 ? 'minmax(76px, 1fr) minmax(76px, 1fr)' : 'minmax(105px, 1fr)',
                    }}
                  >
                    {/* Background Grid Cells */}
                    {MASTER_TIME_SLOTS.map((slot, slotIdx) => {
                      const isSlotActive = isToday && activeSlotId === slot.id
                      const isBreak = slot.id === 't6'
                      const isOccupiedOnTrack0 = trackOccupancy[0].has(slotIdx)

                      return (
                        <div
                          key={`bg-${day.id}-${slot.id}`}
                          style={{
                            gridColumnStart: slotIdx + 1,
                            gridColumnEnd: slotIdx + 2,
                            gridRowStart: 1,
                            gridRowEnd: hasTrack1 ? 3 : 2,
                          }}
                          className={`group/cell relative transition-colors ${
                            isBreak
                              ? 'bg-amber-50/25 dark:bg-amber-950/15 flex items-center justify-center'
                              : isSlotActive
                              ? 'bg-emerald-500/10 dark:bg-emerald-950/20'
                              : isWeekend
                              ? 'bg-zinc-100/30 dark:bg-zinc-900/20'
                              : 'hover:bg-zinc-50/90 dark:hover:bg-zinc-900/50'
                          }`}
                        >
                          {isBreak ? (
                            <div className="flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 font-mono text-[10px] font-bold pointer-events-none">
                              <Coffee className="h-4 w-4 mb-0.5 opacity-80" />
                              <span>RECESS</span>
                            </div>
                          ) : isWeekend ? (
                            <div className="flex items-center justify-center h-full opacity-30 pointer-events-none">
                              <Lock className="h-3.5 w-3.5 text-zinc-400" />
                            </div>
                          ) : (
                            /* Quick-Add Button on Empty Working Slots */
                            !isOccupiedOnTrack0 && (
                              <button
                                onClick={() => handleQuickAdd(day.id, slot.id)}
                                className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute inset-0 m-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center gap-1.5 text-xs font-mono font-bold shadow-sm backdrop-blur-md"
                                title={`Book practical slot on ${day.label} (${slot.name})`}
                              >
                                <Plus className="h-4 w-4 text-indigo-500" />
                                <span>Book Slot</span>
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}

                    {/* Allocated Session Cards with Interactive Aurora Halo */}
                    {daySchedules.map((session) => {
                      const startIdx = MASTER_TIME_SLOTS.findIndex((t) => t.id === session.slotId)
                      if (startIdx === -1) return null

                      const span = session.span || 1
                      const trackIdx = sessionTracks.get(session.id) || 0
                      const isMultiPeriod = span > 1
                      const isLiveNow = isToday && activeSlotId === session.slotId

                      const isComp = session.lab.toLowerCase().includes('comp') || session.labKey === 'comp'
                      const isPhys = session.lab.toLowerCase().includes('phys') || session.labKey === 'phys'
                      const isChem = session.lab.toLowerCase().includes('chem') || session.labKey === 'chem'
                      const isBio = session.lab.toLowerCase().includes('bio') || session.labKey === 'bio'

                      return (
                        <div
                          key={session.id}
                          onClick={() => openActionModal(session, 'log')}
                          onMouseEnter={() => setHoveredSession(session)}
                          onMouseLeave={() => setHoveredSession(null)}
                          style={{
                            gridColumnStart: startIdx + 1,
                            gridColumnEnd: startIdx + 1 + span,
                            gridRowStart: trackIdx + 1,
                            gridRowEnd: trackIdx + 2,
                          }}
                          className={`m-1.5 p-3 rounded-xl border-l-4 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden relative group z-10 backdrop-blur-md ${
                            isLiveNow
                              ? 'ring-2 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.45)] scale-[1.02]'
                              : 'shadow-xs hover:shadow-xl hover:scale-[1.02]'
                          } ${
                            isMultiPeriod
                              ? 'border-l-violet-500 bg-violet-50/90 dark:bg-violet-950/60 hover:dark:bg-violet-950/80 text-zinc-950 dark:text-white border border-violet-200 dark:border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:shadow-[0_0_25px_rgba(139,92,246,0.4)]'
                              : isComp
                              ? 'border-l-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/50 hover:dark:bg-indigo-950/70 text-zinc-950 dark:text-white border border-indigo-200 dark:border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]'
                              : isPhys
                              ? 'border-l-cyan-500 bg-cyan-50/90 dark:bg-cyan-950/50 hover:dark:bg-cyan-950/70 text-zinc-950 dark:text-white border border-cyan-200 dark:border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]'
                              : isChem
                              ? 'border-l-rose-500 bg-rose-50/90 dark:bg-rose-950/50 hover:dark:bg-rose-950/70 text-zinc-950 dark:text-white border border-rose-200 dark:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] hover:shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                              : 'border-l-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 hover:dark:bg-emerald-950/70 text-zinc-950 dark:text-white border border-emerald-200 dark:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-sm font-mono font-extrabold text-zinc-950 dark:text-white tracking-tight">
                                  {session.subjectCode}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 font-extrabold shrink-0">
                                  {formatGradeBadge(session.grade, session.subjectCode)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                {isLiveNow && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500 text-white font-extrabold shrink-0 shadow-xs flex items-center gap-1 animate-pulse">
                                    <Radio className="h-2.5 w-2.5 animate-spin" />
                                    LIVE
                                  </span>
                                )}
                                {isMultiPeriod && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-600 text-white font-extrabold shrink-0 shadow-xs flex items-center gap-1">
                                    <Flame className="h-3 w-3" />
                                    {span}P
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-[12px] text-zinc-800 dark:text-zinc-200 font-bold truncate">
                              {session.subjectTitle}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-1.5">
                            <span className="truncate font-semibold text-zinc-700 dark:text-zinc-300">
                              {session.teacher}
                            </span>
                            <span className="shrink-0 font-bold text-zinc-900 dark:text-zinc-200">
                              {session.timeSlot}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Session Action Modal */}
      <SessionActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        session={selectedSession}
        allRoutines={routines}
        initialMode={modalMode}
        onSuccess={handleSuccess}
        onDeleteSession={deleteSession}
        onExtendSession={extendSession}
        onMergeSession={mergeSession}
        onUnmergeSession={unmergeSession}
        onAddSession={addSession}
      />
    </div>
  )
}
