'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  Building2,
  BookOpen,
  Users,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Sparkles,
  Palmtree,
  Settings,
  Terminal,
  Atom,
  FlaskRound,
  Dna,
  Cpu,
  Clock,
  RotateCcw,
  Timer
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  DAYS,
  LAB_ROOMS,
  DEFAULT_HOLIDAYS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  MASTER_TIME_SLOTS,
  HolidayItem
} from '@/lib/master-data'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<
    'holidays' | 'periods' | 'subjects' | 'classes' | 'labs' | 'faculty'
  >('periods')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const { startDay, sundayWeekend, saturdayWeekend, updateSettings } = useCalendarSettings()

  // 1. Periods State
  const [periodsList, setPeriodsList] = useState([...MASTER_TIME_SLOTS])
  const [newPeriodName, setNewPeriodName] = useState('')
  const [newPeriodStart, setNewPeriodStart] = useState('04:50')
  const [newPeriodEnd, setNewPeriodEnd] = useState('05:35')
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [editPeriodName, setEditPeriodName] = useState('')
  const [editPeriodLabel, setEditPeriodLabel] = useState('')

  // 2. Labs State
  const [labsList, setLabsList] = useState([
    { id: 'comp', name: 'Computer Engineering Lab 01', code: 'LAB-COMP-01', capacity: 40, type: 'computer_lab', status: 'Operational' },
    { id: 'phys', name: 'Physics Laboratory', code: 'LAB-PHYS-01', capacity: 38, type: 'physics_lab', status: 'Operational' },
    { id: 'chem', name: 'Chemistry Laboratory', code: 'LAB-CHEM-01', capacity: 40, type: 'chemistry_lab', status: 'Operational' },
    { id: 'bio', name: 'Biology & Life Sciences Lab', code: 'LAB-BIO-01', capacity: 35, type: 'biology_lab', status: 'Operational' },
    { id: 'elec', name: 'Electronics & Hardware Lab', code: 'LAB-ELEC-01', capacity: 30, type: 'electronics_lab', status: 'Operational' },
  ])

  // 3. Classes State (12C, 12 Sc, 12 Mgt, 11C, 11 Sc, etc.)
  const [classesList, setClassesList] = useState([
    { id: '12c', name: '12C', section: 'Tech Stream Sec A (Computer)', capacity: 38, stream: 'Computer Engineering' },
    { id: '12sc', name: '12 Sc', section: 'Science Stream Sec B', capacity: 40, stream: 'General Science' },
    { id: '12mgt', name: '12 Mgt', section: 'Management Stream', capacity: 36, stream: 'Management' },
    { id: '11c', name: '11C', section: 'Tech Stream Sec A (Computer)', capacity: 42, stream: 'Computer Engineering' },
    { id: '11sc', name: '11 Sc', section: 'Science Stream Sec B', capacity: 38, stream: 'General Science' },
    { id: '10a', name: '10A', section: 'Vocational Technical', capacity: 35, stream: 'Secondary Technical' },
    { id: '9b', name: '9B', section: 'Pre-Engineering', capacity: 36, stream: 'Secondary Technical' },
    { id: '8a', name: '8A', section: 'General Science & ICT', capacity: 32, stream: 'Basic Level' },
    { id: '6a', name: '6A', section: 'Basic Science & Computing', capacity: 28, stream: 'Basic Level' },
  ])

  // 4. Subjects & Practical Quotas State
  const [subjectsList, setSubjectsList] = useState([
    { code: 'COMP-12', title: 'Data Structures & Algorithms Lab', grade: '12C', quota: 12, lab: 'Computer Lab 01' },
    { code: 'DBMS-10', title: 'Database Management Systems', grade: '10A', quota: 10, lab: 'Computer Lab 01' },
    { code: 'CHEM-12', title: 'Analytical Chemistry Practicals', grade: '12 Sc', quota: 10, lab: 'Chemistry Laboratory' },
    { code: 'PHY-11', title: 'Optics & Wave Mechanics', grade: '11 Sc', quota: 10, lab: 'Physics Laboratory' },
    { code: 'BIO-11', title: 'Cell Biology & Microbiology Lab', grade: '11 Sc', quota: 8, lab: 'Biology & Life Sciences Lab' },
    { code: 'WPD-9', title: 'Web Page Design & Development', grade: '9B', quota: 8, lab: 'Computer Lab 01' },
    { code: 'ELEC-12', title: 'Digital Electronics & Logic Gates', grade: '12C', quota: 10, lab: 'Electronics & Hardware Lab' },
  ])

  // 5. Faculty State
  const [facultyList, setFacultyList] = useState([
    { id: 't1', name: 'Dr. Rajesh Sharma', dept: 'Computer Science & Engineering', role: 'Lab In-Charge', email: 'r.sharma@rrl.edu.np' },
    { id: 't2', name: 'Dr. Prakash Adhikari', dept: 'Physics Department', role: 'Senior Faculty', email: 'p.adhikari@rrl.edu.np' },
    { id: 't3', name: 'Ms. Sunita Thapa', dept: 'Chemistry Department', role: 'Lab In-Charge', email: 's.thapa@rrl.edu.np' },
    { id: 't4', name: 'Er. Anish Karki', dept: 'Electronics & Hardware', role: 'Faculty Member', email: 'a.karki@rrl.edu.np' },
    { id: 't5', name: 'Dr. Nirmala Poudel', dept: 'Biology & Life Sciences', role: 'Senior Faculty', email: 'n.poudel@rrl.edu.np' },
  ])

  // 6. Holidays State
  const [holidaysList, setHolidaysList] = useState<HolidayItem[]>([
    ...DEFAULT_HOLIDAYS,
    {
      id: 'hol-dept-1',
      title: 'Annual Science & Tech Exhibition',
      dateStr: '2026-09-25',
      type: 'department',
      description: 'Campus-wide laboratory project exhibition',
    },
  ])

  // Forms State
  const [newLabName, setNewLabName] = useState('')
  const [newLabCode, setNewLabCode] = useState('')
  const [newLabCapacity, setNewLabCapacity] = useState(35)
  const [newLabType, setNewLabType] = useState('biology_lab')

  const [newClassName, setNewClassName] = useState('')
  const [newClassSection, setNewClassSection] = useState('')
  const [newClassCapacity, setNewClassCapacity] = useState(36)
  const [newClassStream, setNewClassStream] = useState('Computer Engineering')

  const [newSubCode, setNewSubCode] = useState('')
  const [newSubTitle, setNewSubTitle] = useState('')
  const [newSubGrade, setNewSubGrade] = useState('12C')
  const [newSubQuota, setNewSubQuota] = useState(10)
  const [newSubLab, setNewSubLab] = useState('Computer Lab 01')

  const [newHolTitle, setNewHolTitle] = useState('')
  const [newHolDate, setNewHolDate] = useState('')
  const [newHolType, setNewHolType] = useState<'state' | 'cultural' | 'department'>('cultural')

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // --- Handlers ---
  const handleAddPeriod = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPeriodName || !newPeriodStart || !newPeriodEnd) return

    const newPeriod = {
      id: `t${periodsList.length + 1}`,
      name: newPeriodName,
      label: `${newPeriodStart} - ${newPeriodEnd}`,
    }

    setPeriodsList([...periodsList, newPeriod])
    setNewPeriodName('')
    triggerToast(`Added timetable period "${newPeriod.name}" (${newPeriod.label})!`)
  }

  const handleDeletePeriod = (id: string) => {
    if (periodsList.length <= 4) {
      triggerToast('Cannot delete below minimum 4 periods.')
      return
    }
    setPeriodsList(periodsList.filter((p) => p.id !== id))
    triggerToast('Timetable period removed.')
  }

  const handleSaveEditPeriod = (id: string) => {
    setPeriodsList(
      periodsList.map((p) =>
        p.id === id ? { ...p, name: editPeriodName || p.name, label: editPeriodLabel || p.label } : p
      )
    )
    setEditingPeriodId(null)
    triggerToast('Period details updated.')
  }

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName) return

    const newCls = {
      id: `c-${Date.now()}`,
      name: newClassName,
      section: newClassSection || `${newClassName} Section`,
      capacity: newClassCapacity,
      stream: newClassStream,
    }

    setClassesList([...classesList, newCls])
    setNewClassName('')
    setNewClassSection('')
    triggerToast(`Added class "${newCls.name}" with capacity of ${newCls.capacity}!`)
  }

  const handleAddLab = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabName || !newLabCode) return

    const newLab = {
      id: `lab-${Date.now()}`,
      name: newLabName,
      code: newLabCode,
      capacity: newLabCapacity,
      type: newLabType,
      status: 'Operational',
    }

    setLabsList([...labsList, newLab])
    setNewLabName('')
    setNewLabCode('')
    triggerToast(`Added facility "${newLab.name}"! Synced to telemetry.`)
  }

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubCode || !newSubTitle) return

    const newSub = {
      code: newSubCode,
      title: newSubTitle,
      grade: newSubGrade,
      quota: newSubQuota,
      lab: newSubLab,
    }

    setSubjectsList([...subjectsList, newSub])
    setNewSubCode('')
    setNewSubTitle('')
    triggerToast(`Added curriculum subject "${newSub.code}" with quota ${newSub.quota}!`)
  }

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHolTitle || !newHolDate) return

    const newHol: HolidayItem = {
      id: `hol-${Date.now()}`,
      title: newHolTitle,
      dateStr: newHolDate,
      type: newHolType,
      description: 'Scheduled institutional recess',
    }

    setHolidaysList([...holidaysList, newHol])
    setNewHolTitle('')
    setNewHolDate('')
    triggerToast(`Holiday "${newHol.title}" scheduled for ${newHol.dateStr}!`)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 select-none">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white font-mono">
                  Super Admin Control Center
                </h2>
                <Badge className="bg-indigo-600 text-white font-mono text-[10px]">
                  B.S. 2083 Root
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                Manage Master Period Slots, Curriculum Quotas, Classes (12C, 11 Sc), Facilities, and Weekend Recess Policies.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-mono border border-zinc-200/80 dark:border-zinc-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('periods')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'periods'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-indigo-500" />
          <span>Period Slots & Times ({periodsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('subjects')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'subjects'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-cyan-500" />
          <span>Subjects & Quotas ({subjectsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('classes')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'classes'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-emerald-500" />
          <span>Classes & Headcounts ({classesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('labs')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'labs'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Building2 className="h-3.5 w-3.5 text-amber-500" />
          <span>Laboratory Facilities ({labsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'holidays'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Palmtree className="h-3.5 w-3.5 text-rose-500" />
          <span>Weekend & Calendar Recess</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('faculty')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'faculty'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Settings className="h-3.5 w-3.5 text-violet-500" />
          <span>Faculty Directory ({facultyList.length})</span>
        </button>
      </div>

      {/* 1. PERIODS MANAGEMENT TAB */}
      {activeTab === 'periods' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    Master Timetable Period Slots
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    Defines start/end times across all routines and multi-period selection dialogs.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1"
                  onClick={() => {
                    setPeriodsList([...MASTER_TIME_SLOTS])
                    triggerToast('Reset to standard institutional period slots.')
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Default</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {periodsList.map((slot) => {
                  const isEditing = editingPeriodId === slot.id
                  return (
                    <div
                      key={slot.id}
                      className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="flex-1 mr-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editPeriodName}
                              onChange={(e) => setEditPeriodName(e.target.value)}
                              className="h-7 text-xs w-36"
                              placeholder="Period Name"
                            />
                            <Input
                              value={editPeriodLabel}
                              onChange={(e) => setEditPeriodLabel(e.target.value)}
                              className="h-7 text-xs w-48"
                              placeholder="10:10 - 11:00"
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleSaveEditPeriod(slot.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setEditingPeriodId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-950 dark:text-white">
                              {slot.name}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                              {slot.label}
                            </span>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            onClick={() => {
                              setEditingPeriodId(slot.id)
                              setEditPeriodName(slot.name)
                              setEditPeriodLabel(slot.label)
                            }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-rose-500 hover:text-rose-700"
                            onClick={() => handleDeletePeriod(slot.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-indigo-500" />
                  Add Period Slot
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddPeriod} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Period Name *</label>
                    <Input
                      type="text"
                      required
                      value={newPeriodName}
                      onChange={(e) => setNewPeriodName(e.target.value)}
                      placeholder="e.g. Period 9"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700 dark:text-zinc-300">Start Time</label>
                      <Input
                        type="text"
                        required
                        value={newPeriodStart}
                        onChange={(e) => setNewPeriodStart(e.target.value)}
                        placeholder="04:50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700 dark:text-zinc-300">End Time</label>
                      <Input
                        type="text"
                        required
                        value={newPeriodEnd}
                        onChange={(e) => setNewPeriodEnd(e.target.value)}
                        placeholder="05:35"
                      />
                    </div>
                  </div>

                  <Button type="submit" size="sm" className="w-full mt-2 font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Period Slot</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 2. SUBJECTS & PRACTICAL QUOTAS TAB */}
      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Practical Syllabus Quota Targets & Subject Registry
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Subjects appear directly in practical log registration dialogs and schedule allocation dropdowns.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {subjectsList.map((sub) => (
                  <div
                    key={sub.code}
                    className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-950 dark:text-white">
                          {sub.code} — {sub.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                          {sub.grade}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Lab Room: {sub.lab} • Annual Experiment Quota: <strong>{sub.quota} Experiments</strong>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-rose-500 hover:text-rose-700"
                      onClick={() => {
                        setSubjectsList(subjectsList.filter((s) => s.code !== sub.code))
                        triggerToast(`Removed subject ${sub.code}.`)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-cyan-500" />
                  Add Subject & Quota
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddSubject} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Subject Code *</label>
                    <Input
                      type="text"
                      required
                      value={newSubCode}
                      onChange={(e) => setNewSubCode(e.target.value)}
                      placeholder="e.g. BIO-12"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Subject Title *</label>
                    <Input
                      type="text"
                      required
                      value={newSubTitle}
                      onChange={(e) => setNewSubTitle(e.target.value)}
                      placeholder="e.g. Genetics & Plant Anatomy Lab"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Target Grade / Class</label>
                    <Select
                      value={newSubGrade}
                      onChange={(e) => setNewSubGrade(e.target.value)}
                    >
                      {classesList.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.section})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Designated Facility</label>
                    <Select
                      value={newSubLab}
                      onChange={(e) => setNewSubLab(e.target.value)}
                    >
                      {labsList.map((l) => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Annual Experiment Quota</label>
                    <Input
                      type="number"
                      min="1"
                      value={newSubQuota}
                      onChange={(e) => setNewSubQuota(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <Button type="submit" size="sm" className="w-full mt-2 font-bold gap-1 bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Subject Quota</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. CLASSES & BATCHES TAB (12C, 12 Sc, 12 Mgt, 11C, 10A) */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Registered Classes & Student Batches
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Classes are formatted concisely (e.g. 12C, 12 Sc, 10A) and automatically populate student roll strengths.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {classesList.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-zinc-950 dark:text-white px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          {c.name}
                        </span>
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">
                          {c.section}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        Stream: {c.stream} • Enrolled Students: <strong>{c.capacity}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {c.capacity} Students
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-500 hover:text-rose-700"
                        onClick={() => {
                          setClassesList(classesList.filter((x) => x.id !== c.id))
                          triggerToast(`Removed class ${c.name}.`)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-emerald-500" />
                  Add Academic Class / Batch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddClass} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Class Code / Tag *</label>
                    <Input
                      type="text"
                      required
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="e.g. 12C / 12 Mgt / 6B"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Section Description</label>
                    <Input
                      type="text"
                      value={newClassSection}
                      onChange={(e) => setNewClassSection(e.target.value)}
                      placeholder="e.g. Tech Stream Sec A"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Stream / Faculty</label>
                    <Input
                      type="text"
                      value={newClassStream}
                      onChange={(e) => setNewClassStream(e.target.value)}
                      placeholder="e.g. Computer Engineering"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Student Roll Strength</label>
                    <Input
                      type="number"
                      min="1"
                      value={newClassCapacity}
                      onChange={(e) => setNewClassCapacity(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <Button type="submit" size="sm" className="w-full mt-2 font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Class</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 4. LABS MANAGEMENT TAB */}
      {activeTab === 'labs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-3.5">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Registered Institutional Facilities
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Rooms automatically synchronise with real-time occupancy telemetry and schedule matrices.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {labsList.map((lab) => (
                  <div
                    key={lab.id}
                    className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                        {lab.type.includes('comp') ? (
                          <Terminal className="h-4 w-4 text-indigo-500" />
                        ) : lab.type.includes('phys') ? (
                          <Atom className="h-4 w-4 text-cyan-500" />
                        ) : lab.type.includes('bio') ? (
                          <Dna className="h-4 w-4 text-emerald-500" />
                        ) : lab.type.includes('elec') ? (
                          <Cpu className="h-4 w-4 text-amber-500" />
                        ) : (
                          <FlaskRound className="h-4 w-4 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                            {lab.name}
                          </h4>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                            {lab.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Capacity: <strong>{lab.capacity} Workstations</strong> • Status: <span className="text-emerald-600">{lab.status}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-mono"
                      onClick={() => {
                        setLabsList(labsList.filter((l) => l.id !== lab.id))
                        triggerToast(`Removed facility ${lab.name}.`)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-indigo-500" />
                  Add Laboratory Facility
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddLab} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Facility Name *</label>
                    <Input
                      type="text"
                      required
                      value={newLabName}
                      onChange={(e) => setNewLabName(e.target.value)}
                      placeholder="e.g. Biology Laboratory 02"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Room Code *</label>
                    <Input
                      type="text"
                      required
                      value={newLabCode}
                      onChange={(e) => setNewLabCode(e.target.value)}
                      placeholder="e.g. LAB-BIO-02"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Lab Category</label>
                    <Select
                      value={newLabType}
                      onChange={(e) => setNewLabType(e.target.value)}
                    >
                      <option value="computer_lab">Computer Lab</option>
                      <option value="physics_lab">Physics Lab</option>
                      <option value="chemistry_lab">Chemistry Lab</option>
                      <option value="biology_lab">Biology & Life Sciences Lab</option>
                      <option value="electronics_lab">Electronics & Hardware Lab</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Seat Capacity</label>
                    <Input
                      type="number"
                      min="1"
                      value={newLabCapacity}
                      onChange={(e) => setNewLabCapacity(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <Button type="submit" size="sm" className="w-full mt-2 font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Facility</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 5. HOLIDAYS & CALENDAR ENGINE TAB */}
      {activeTab === 'holidays' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  Timetable Structure & Starting Weekday
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Select which day the weekly timetable matrix starts with. Changes react immediately on the schedule grid.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <div>
                    <div className="font-bold text-zinc-950 dark:text-white text-sm">
                      Weekly Routine Starting Day
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {startDay === 'sun'
                        ? 'Schedule starts with Sunday (आइतवार) and ends on Saturday (शनिबार)'
                        : 'Schedule starts with Monday (सोमबार) and displays Sunday (आइतवार) at the end'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({ startDay: 'sun' })
                        triggerToast('Timetable updated: Sunday is now the starting day.')
                      }}
                      className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                        startDay === 'sun'
                          ? 'bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Sunday First
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({ startDay: 'mon' })
                        triggerToast('Timetable updated: Monday is now the starting day (Sunday at the end).')
                      }}
                      className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                        startDay === 'mon'
                          ? 'bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Monday First
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-950 dark:text-white">Sunday (आइतवार) Recess Policy</span>
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                        sundayWeekend
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      }`}>
                        {sundayWeekend ? 'Holiday (Starts Monday)' : 'Active Working Day (Starts Sunday)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {sundayWeekend
                        ? 'Sunday is marked as a weekend holiday. Weekly routine automatically starts from Monday.'
                        : 'Sunday is an active school day. Weekly routine automatically starts from Sunday (National standard in Nepal).'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={sundayWeekend ? 'default' : 'outline'}
                    className={sundayWeekend ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold' : 'font-bold text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}
                    onClick={() => {
                      const next = !sundayWeekend
                      updateSettings({ sundayWeekend: next, startDay: next ? 'mon' : 'sun' })
                      triggerToast(
                        next
                          ? 'Sunday marked as Weekend Holiday. Schedule now starts on Monday.'
                          : 'Sunday marked as Active Working Day. Schedule now starts on Sunday.'
                      )
                    }}
                  >
                    {sundayWeekend ? 'Mark Active Day' : 'Mark as Holiday'}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <div>
                    <div className="font-bold text-zinc-950 dark:text-white">Saturday (शनिबार) Mandatory Off</div>
                    <div className="text-[11px] text-zinc-400">
                      {saturdayWeekend
                        ? 'Saturday is marked as a Weekend Recess (National standard off-day)'
                        : 'Saturday is marked as an Active Day'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={saturdayWeekend ? 'default' : 'outline'}
                    className={saturdayWeekend ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold' : 'font-bold text-emerald-600 border-emerald-500/40'}
                    onClick={() => {
                      const next = !saturdayWeekend
                      updateSettings({ saturdayWeekend: next })
                      triggerToast(`Saturday weekend policy updated.`)
                    }}
                  >
                    {saturdayWeekend ? 'Weekend Off' : 'Active Day'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Scheduled State & Cultural Holidays (B.S. 2083)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {holidaysList.map((hol) => (
                  <div
                    key={hol.id}
                    className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-950 dark:text-white">
                          {hol.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold uppercase">
                          {hol.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Date: <strong>{hol.dateStr}</strong> • {hol.description}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-rose-500 hover:text-rose-700"
                      onClick={() => {
                        setHolidaysList(holidaysList.filter((h) => h.id !== hol.id))
                        triggerToast(`Removed holiday ${hol.title}.`)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-amber-500" />
                  Schedule Calendar Holiday
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddHoliday} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Holiday Title *</label>
                    <Input
                      type="text"
                      required
                      value={newHolTitle}
                      onChange={(e) => setNewHolTitle(e.target.value)}
                      placeholder="e.g. Maha Shivaratri / Sports Week"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Target Date *</label>
                    <Input
                      type="date"
                      required
                      value={newHolDate}
                      onChange={(e) => setNewHolDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Holiday Category</label>
                    <Select
                      value={newHolType}
                      onChange={(e) => setNewHolType(e.target.value as any)}
                    >
                      <option value="cultural">Cultural Festival (दशैं, तिहार, etc.)</option>
                      <option value="state">State / National Holiday (संविधान दिवस)</option>
                      <option value="department">Departmental Event / Examination Recess</option>
                    </Select>
                  </div>

                  <Button type="submit" size="sm" className="w-full mt-2 font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Declare Holiday</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 6. FACULTY DIRECTORY TAB */}
      {activeTab === 'faculty' && (
        <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
            <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Department Faculty & Lab Endorsers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
            {facultyList.map((f) => (
              <div
                key={f.id}
                className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white">{f.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                      {f.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {f.dept} • {f.email}
                  </div>
                </div>

                <Badge variant="outline" className="font-mono text-xs">
                  Active Endorser
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
