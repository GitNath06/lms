'use client'

import React, { useState, useEffect } from 'react'
import {
  Clock,
  FastForward,
  RotateCcw,
  X,
  ChevronUp,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sliders,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getEffectiveDate,
  isSimulatingTime,
  setSimulatedTime,
  stepSimulatedMinutes,
  stepSimulatedDays,
  stepSimulatedWeeks,
  jumpToDayInActiveWeek,
  jumpToTimeOfDay,
  setExactDateTime,
  resetToLiveTime,
  ACADEMIC_PERIOD_TARGETS,
  TIME_TRAVEL_EVENT,
} from '@/lib/time-simulator'
import { useLiveSchedule } from '@/hooks/use-live-schedule'

export default function TimeTravelController() {
  const [isOpen, setIsOpen] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')

  const {
    now,
    timeString,
    nepaliDate,
    activePeriodName,
    activeSlotId,
  } = useLiveSchedule()

  useEffect(() => {
    const update = () => {
      setSimulating(isSimulatingTime())
      const cur = getEffectiveDate()
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      const h = String(cur.getHours()).padStart(2, '0')
      const min = String(cur.getMinutes()).padStart(2, '0')
      setCustomDate(`${y}-${m}-${d}`)
      setCustomTime(`${h}:${min}`)
    }
    update()
    window.addEventListener(TIME_TRAVEL_EVENT, update)
    return () => window.removeEventListener(TIME_TRAVEL_EVENT, update)
  }, [])

  const currentHours = now.getHours()
  const isNightShift = currentHours < 9 || currentHours >= 17

  // Handle applying custom date & time
  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customDate) return
    setExactDateTime(customDate, customTime)
    setShowCustomPicker(false)
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none font-sans print:hidden">
      {/* 1. COLLAPSED TRIGGER PILL */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono shadow-xl backdrop-blur-md transition-all cursor-pointer active:scale-95 ${
            simulating
              ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-zinc-900/90 text-zinc-100 dark:bg-surface-2/90 dark:text-zinc-200 border border-zinc-700/60 dark:border-white/[0.1] hover:border-zinc-500 hover:bg-zinc-900'
          }`}
          title="Open LabSync Time Simulator"
        >
          {simulating ? (
            <span className="flex items-center gap-1.5 font-bold">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span>SIMULATED: {timeString}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-zinc-300 dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>Test Time</span>
            </span>
          )}
          <ChevronUp className="h-3 w-3 opacity-60 ml-0.5" />
        </button>
      )}

      {/* 2. EXPANDED CONTROL CONSOLE */}
      {isOpen && (
        <div className="w-[340px] sm:w-[380px] rounded-2xl bg-white/95 dark:bg-[#101726]/95 border border-zinc-200/90 dark:border-white/[0.1] shadow-2xl backdrop-blur-xl p-3.5 sm:p-4 animate-in slide-in-from-bottom-3 duration-200 text-zinc-900 dark:text-zinc-100 max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <FastForward className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-heading uppercase tracking-wider">
                  Time Travel Engine
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-slate-400">
                  Simulate any week, day, period & custom date
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Current Active Telemetry Status */}
          <div className="my-2.5 p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.06] bg-zinc-50/80 dark:bg-slate-900/60 space-y-1 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="text-[11px] text-zinc-500 dark:text-slate-400">Effective Clock:</span>
              <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white tabular-nums">
                {isNightShift ? <Moon className="h-3 w-3 text-indigo-400" /> : <Sun className="h-3 w-3 text-amber-500" />}
                <span>{timeString}</span>
              </div>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-[11px] text-zinc-500 dark:text-slate-400">Date & Day:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {nepaliDate.dayName}, {nepaliDate.englishDate}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono pt-1 border-t border-zinc-200/60 dark:border-white/[0.04]">
              <span className="text-[11px] text-zinc-500 dark:text-slate-400">Active Period:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                activeSlotId
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-slate-400'
              }`}>
                {activePeriodName}
              </span>
            </div>
          </div>

          {/* 1. WEEK NAVIGATION (Jump Prev / Next Week without resetting) */}
          <div className="space-y-1 pb-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans">
              <span>Week Navigation</span>
              <span className="font-mono font-normal">±1 Week</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedWeeks(-1)}
                className="h-7 px-2 text-xs font-mono border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev Week</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const real = new Date()
                  const current = getEffectiveDate()
                  const currentDay = current.getDay()
                  const realDay = real.getDay()
                  // Return to this real week while maintaining day of week
                  const diff = currentDay - realDay
                  const target = new Date(real)
                  target.setDate(target.getDate() + diff)
                  target.setHours(current.getHours(), current.getMinutes(), 0, 0)
                  setSimulatedTime(target)
                }}
                className="h-7 flex-1 text-[11px] font-mono border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Current Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedWeeks(1)}
                className="h-7 px-2 text-xs font-mono border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Next Week</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 2. DAY SELECTOR (STAYS WITHIN CURRENTLY ACTIVE WEEK!) */}
          <div className="space-y-1 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans">
              Jump Day in Active Week
            </span>
            <div className="grid grid-cols-6 gap-1">
              {[
                { name: 'Sun', idx: 0 },
                { name: 'Mon', idx: 1 },
                { name: 'Tue', idx: 2 },
                { name: 'Wed', idx: 3 },
                { name: 'Thu', idx: 4 },
                { name: 'Fri', idx: 5 },
              ].map((d) => {
                const isActiveDay = nepaliDate.dayName?.toLowerCase().startsWith(d.name.toLowerCase())
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => jumpToDayInActiveWeek(d.idx)}
                    className={`h-7 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      isActiveDay
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-surface-2 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {d.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. QUICK ACADEMIC PERIOD JUMPER (ALL 10 PERIODS) */}
          <div className="space-y-1 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans">
              Jump to Period
            </span>
            <div className="grid grid-cols-3 gap-1">
              {ACADEMIC_PERIOD_TARGETS.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => jumpToTimeOfDay(period.hours, period.minutes)}
                  className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    activeSlotId === period.id
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold'
                      : 'border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-surface-2/60 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {period.name}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 dark:text-slate-500 truncate">
                    {period.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. STEPPER NUDGES (DAYS & HOURS) */}
          <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-slate-400 font-bold uppercase">
              <span>Fine Steppers</span>
              <span className="font-mono font-normal">Day & Hour</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedDays(-1)}
                className="h-7 text-[11px] font-mono p-0 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Previous Day"
              >
                -1 Day
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedMinutes(-60)}
                className="h-7 text-[11px] font-mono p-0 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Rewind 1 Hour"
              >
                -1 Hr
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedMinutes(60)}
                className="h-7 text-[11px] font-mono p-0 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Advance 1 Hour"
              >
                +1 Hr
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedDays(1)}
                className="h-7 text-[11px] font-mono p-0 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Next Day"
              >
                +1 Day
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedMinutes(-15)}
                className="h-6 text-[10px] font-mono p-0 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                -15 min
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stepSimulatedMinutes(15)}
                className="h-6 text-[10px] font-mono p-0 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                +15 min
              </Button>
            </div>
          </div>

          {/* 5. CUSTOM DATE & TIME PICKER (TOGGLEABLE) */}
          <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <span>Custom Date & Time Picker</span>
              <Sliders className="h-3 w-3" />
            </button>

            {showCustomPicker && (
              <form onSubmit={handleApplyCustom} className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[9px] text-zinc-400 font-mono mb-0.5">Date</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full h-7 px-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-surface-2 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-400 font-mono mb-0.5">Time</label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full h-7 px-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-surface-2 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="w-full h-7 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-lg cursor-pointer"
                >
                  Apply Custom Time
                </Button>
              </form>
            )}
          </div>

          {/* 6. RESET TO LIVE REAL-TIME CLOCK */}
          {simulating && (
            <div className="mt-2.5 pt-2 border-t border-amber-500/20">
              <Button
                size="sm"
                onClick={() => resetToLiveTime()}
                className="w-full h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Real-Time Clock</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
