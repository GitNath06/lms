'use client'

import React, { useState, useMemo } from 'react'
import {
    AlertTriangle,
    Wrench,
    RotateCcw,
    CheckCircle2,
    Clock,
    Send,
    Plus,
    Building2,
    Calendar,
    Filter,
    UserCheck,
    Shield,
    ShieldAlert,
    Search,
    ChevronRight,
    Sparkles,
    Info,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useIncidentState, LabIncidentRecord } from '@/hooks/use-incident-state'
import IncidentDrawer from '@/components/dashboard/incident-drawer'
import ReportIncidentModal from '@/components/dashboard/report-incident-modal'
import { getCurrentUserProfile, UserProfile } from '@/app/actions/auth'

export type UserRoleMode = 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'faculty'

export default function IncidentsPage() {
    const { incidents, isLoading } = useIncidentState()

    // Authenticated Role & User Profile
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
    const [currentRole, setCurrentRole] = useState<UserRoleMode>('teacher')
    const [selectedIncident, setSelectedIncident] = useState<LabIncidentRecord | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false)
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    // Filters State (Primary Labs: Physics, Chemistry, Computer)
    const [scopeFilter, setScopeFilter] = useState<'my_incidents' | 'all'>('my_incidents')
    const [labFilter, setLabFilter] = useState<string>('all')
    const [severityFilter, setSeverityFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [dateFilter, setDateFilter] = useState<string>('')
    const [searchQuery, setSearchQuery] = useState<string>('')

    React.useEffect(() => {
        async function loadProfile() {
            try {
                const profile = await getCurrentUserProfile()
                if (profile) {
                    setUserProfile(profile)
                    const mappedRole = profile.role as UserRoleMode
                    setCurrentRole(mappedRole)
                    const isPriv = ['super_admin', 'lab_incharge', 'hod', 'admin'].includes(profile.role)
                    setScopeFilter(isPriv ? 'all' : 'my_incidents')
                }
            } catch (err) {
                console.error('Failed to load current user profile:', err)
            }
        }
        loadProfile()
    }, [])

    const triggerToast = (msg: string) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 3500)
    }

    // Filtered dataset
    const filteredIncidents = useMemo(() => {
        return incidents.filter((inc) => {
            // Scope Filter (My Incidents vs All)
            if (scopeFilter === 'my_incidents' && userProfile) {
                const myName = (userProfile.full_name || '').toLowerCase()
                const myId = userProfile.id
                const isMine =
                    (inc.reported_by && inc.reported_by.toLowerCase().includes(myName)) ||
                    (inc.subject_teacher_name && inc.subject_teacher_name.toLowerCase().includes(myName)) ||
                    (inc as any).reported_by_id === myId
                if (!isMine) return false
            }

            // Lab Filter
            if (labFilter !== 'all') {
                const matchesLab =
                    inc.lab_id === labFilter ||
                    (labFilter === 'phys' && inc.lab_id.includes('phys')) ||
                    (labFilter === 'chem' && inc.lab_id.includes('chem')) ||
                    (labFilter === 'comp' && inc.lab_id.includes('comp'))
                if (!matchesLab) return false
            }

            // Severity Filter
            if (severityFilter !== 'all' && inc.severity !== severityFilter) {
                return false
            }

            // Status Filter
            if (statusFilter !== 'all' && inc.status !== statusFilter) {
                return false
            }

            // Date Filter
            if (dateFilter && inc.date !== dateFilter) {
                return false
            }

            // Search Query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase()
                const matchesQuery =
                    inc.title.toLowerCase().includes(query) ||
                    (inc.resolution_notes && inc.resolution_notes.toLowerCase().includes(query)) ||
                    inc.batch_name.toLowerCase().includes(query) ||
                    inc.subject_teacher_name.toLowerCase().includes(query) ||
                    (inc.student_rolls && inc.student_rolls.toLowerCase().includes(query))
                if (!matchesQuery) return false
            }

            return true
        })
    }, [incidents, scopeFilter, userProfile, labFilter, severityFilter, statusFilter, dateFilter, searchQuery])

    // KPI Calculations
    const totalCount = incidents.length
    const underRepairCount = incidents.filter((i) => i.status === 'under_repair').length
    const replacedCount = incidents.filter((i) => i.status === 'replaced').length
    const pendingHODCount = incidents.filter((i) => i.status === 'escalated_to_hod').length
    const resolvedCount = incidents.filter((i) => i.status === 'resolved').length

    const canManageStatuses = currentRole === 'super_admin' || currentRole === 'lab_incharge' || currentRole === 'hod'

    return (
        <div className="space-y-6 w-full pb-12 font-sans">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-top-2 duration-150">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-rose-500 text-white shadow-xs">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono uppercase">
                                Incident and Damage
                            </h1>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                                Physics, Chemistry & Computer Laboratory equipment breakages, technical faults & escalation log
                            </p>
                        </div>
                    </div>
                </div>

                {/* Authenticated Profile Status & Report Action */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs shadow-2xs">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-zinc-900 dark:text-zinc-100 font-bold text-xs truncate max-w-[150px] sm:max-w-[200px]">
                            {userProfile ? userProfile.full_name : 'Loading Profile...'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${currentRole === 'super_admin'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                : currentRole === 'lab_incharge'
                                    ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700'
                                    : currentRole === 'hod'
                                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                            }`}>
                            {currentRole === 'super_admin' ? 'Super Admin' : currentRole === 'lab_incharge' ? 'Lab Incharge' : currentRole === 'hod' ? 'HOD' : 'Teacher'}
                        </span>
                    </div>

                    {/* "+ Report Incident & Damage" Action */}
                    <Button
                        size="sm"
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold gap-1.5 shadow-xs h-9 px-3.5"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Report Incident & Damage</span>
                    </Button>
                </div>
            </div>

            {/* Role Context Helper Banner */}
            <div
                className={`p-3 px-4 rounded-xl border text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${currentRole === 'teacher' || currentRole === 'faculty'
                        ? 'bg-zinc-100/70 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        : currentRole === 'hod'
                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-900 dark:text-purple-200'
                            : currentRole === 'super_admin'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 opacity-80" />
                    <span>
                        {(currentRole === 'teacher' || currentRole === 'faculty') && (
                            <>
                                <strong>Teacher Standard View:</strong> You can report laboratory incidents & breakages. Status resolutions and repairs are managed by the Lab Incharge, Super Admin, and HOD.
                            </>
                        )}
                        {currentRole === 'lab_incharge' && (
                            <>
                                <strong>Lab Incharge Authorized:</strong> You can mark cases <em>Under Repair</em>, <em>Replaced</em>, <em>Resolved</em>, or forward major matters to <em>HOD</em>.
                            </>
                        )}
                        {currentRole === 'super_admin' && (
                            <>
                                <strong>Super Admin Executive:</strong> Global operational authority across Physics, Chemistry, and Computer labs with user access governance.
                            </>
                        )}
                        {currentRole === 'hod' && (
                            <>
                                <strong>Head of Department (HOD):</strong> Final institutional decision-maker for escalated cases, high-cost damages, and academic review.
                            </>
                        )}
                    </span>
                </div>

                <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                    Authenticated Profile Session Active
                </span>
            </div>

            {/* 4 KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono">
                <Card className="border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Total Cases</span>
                    <div className="text-2xl font-black text-zinc-950 dark:text-white mt-1">
                        {totalCount}
                    </div>
                    <span className="text-[11px] text-zinc-500">Physics, Chem & Comp Labs</span>
                </Card>

                <Card className="border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Under Repair</span>
                    <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
                        {underRepairCount}
                    </div>
                    <span className="text-[11px] text-zinc-500">Workshop / servicing</span>
                </Card>

                <Card className="border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Replaced</span>
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                        {replacedCount}
                    </div>
                    <span className="text-[11px] text-zinc-500">Buffer store replacements</span>
                </Card>

                <Card className="border-zinc-200/80 dark:border-zinc-800 p-4 shadow-2xs">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">HOD Escalations</span>
                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                        {pendingHODCount}
                    </div>
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                        Requires Head Directive
                    </span>
                </Card>
            </div>

            {/* Comprehensive Filter Toolbar */}
            <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-2xs space-y-3 font-mono text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold uppercase text-[11px]">
                            <Filter className="h-3.5 w-3.5 text-indigo-500" />
                            <span>Filter Incident Records</span>
                        </div>

                        {/* Segmented View Switcher: My Incidents vs All Facilities */}
                        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-mono">
                            <button
                                type="button"
                                onClick={() => setScopeFilter('my_incidents')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    scopeFilter === 'my_incidents'
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                        : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                            >
                                My Incidents
                            </button>
                            <button
                                type="button"
                                onClick={() => setScopeFilter('all')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                    scopeFilter === 'all'
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                        : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                            >
                                All Facilities
                            </button>
                        </div>
                    </div>

                    {(labFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all' || dateFilter || searchQuery) && (
                        <button
                            onClick={() => {
                                setLabFilter('all')
                                setSeverityFilter('all')
                                setStatusFilter('all')
                                setDateFilter('')
                                setSearchQuery('')
                            }}
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                        >
                            Reset All Filters
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {/* Lab Room Filter (Focus: Physics, Chemistry, Computer) */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Target Lab</span>
                        <Select value={labFilter} onChange={(e) => setLabFilter(e.target.value)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                            <option value="all">All Labs (Phys, Chem, Comp)</option>
                            <option value="phys">Physics Laboratory</option>
                            <option value="chem">Chemistry Laboratory</option>
                            <option value="comp">Computer Laboratory</option>
                        </Select>
                    </div>

                    {/* Severity Filter */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Severity</span>
                        <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                            <option value="all">All Severities</option>
                            <option value="minor">Minor</option>
                            <option value="moderate">Moderate</option>
                            <option value="major_critical">Major / Critical</option>
                        </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Status</span>
                        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950">
                            <option value="all">All Statuses</option>
                            <option value="reported">Reported</option>
                            <option value="under_repair">Under Repair</option>
                            <option value="replaced">Replaced</option>
                            <option value="escalated_to_hod">Escalated to HOD</option>
                            <option value="resolved">Resolved</option>
                        </Select>
                    </div>

                    {/* Date Filter */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Specific Date</span>
                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="h-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                        />
                    </div>

                    {/* Search Query */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Search Keywords</span>
                        <div className="relative">
                            <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-zinc-400" />
                            <Input
                                type="text"
                                placeholder="Student, equipment, remarks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-xs bg-zinc-50 dark:bg-zinc-950"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Incident Audit Records Table */}
            <Card className="border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
                <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-mono font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                            Damage & Incident Audit Register
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-500 font-mono">
                            {isLoading
                                ? 'Loading incidents...'
                                : `Showing ${filteredIncidents.length} of ${incidents.length} recorded cases`}
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-0 overflow-x-auto">
                    {isLoading ? (
                        <div className="p-16 flex flex-col items-center justify-center text-zinc-500 space-y-3 font-mono">
                            <div className="h-7 w-7 rounded-full border-2 border-rose-500/30 border-t-rose-600 animate-spin" />
                            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Loading incident records...
                            </p>
                        </div>
                    ) : filteredIncidents.length === 0 ? (
                        <div className="p-12 text-center font-mono space-y-1">
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                No records found
                            </p>
                            <p className="text-[11px] text-zinc-400">
                                No damages or breakages match your active filters.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-500 font-bold uppercase text-[10px]">
                                    <th className="py-2.5 px-4">Period & Date</th>
                                    <th className="py-2.5 px-4">Laboratory</th>
                                    <th className="py-2.5 px-4">Class & Teacher</th>
                                    <th className="py-2.5 px-4 min-w-[260px]">What Happened / Circumstances</th>
                                    <th className="py-2.5 px-4">Student(s)</th>
                                    <th className="py-2.5 px-4">Severity</th>
                                    <th className="py-2.5 px-4">Status</th>
                                    <th className="py-2.5 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                {filteredIncidents.map((inc) => {
                                    const isCritical = inc.severity === 'major_critical'
                                    const isEscalated = inc.status === 'escalated_to_hod'
                                    const isPhys = inc.lab_id.includes('phys')
                                    const isChem = inc.lab_id.includes('chem')
                                    const isComp = inc.lab_id.includes('comp')

                                    return (
                                        <tr
                                            key={inc.id}
                                            className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            {/* Period & Date */}
                                            <td className="py-3.5 px-4 font-bold text-zinc-950 dark:text-white">
                                                <div className="whitespace-nowrap">{inc.session_label || 'Practical Session'}</div>
                                                <span className="text-[10px] text-zinc-400 font-normal block">{inc.date}</span>
                                            </td>

                                            {/* Laboratory Badge */}
                                            <td className="py-3.5 px-4">
                                                <span
                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap ${isChem
                                                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                                                            : isPhys
                                                                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
                                                                : isComp
                                                                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                                                                    : 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20'
                                                        }`}
                                                >
                                                    {inc.lab_id.toUpperCase()} Lab
                                                </span>
                                            </td>

                                            {/* Class & Faculty */}
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{inc.batch_name}</div>
                                                <span className="text-[10px] text-zinc-400 block whitespace-nowrap">
                                                    {inc.subject_teacher_name}
                                                </span>
                                            </td>

                                            {/* What Happened / Circumstances */}
                                            <td className="py-3.5 px-4 max-w-sm">
                                                <div className="font-bold text-zinc-950 dark:text-white leading-snug">
                                                    {inc.title}
                                                </div>
                                                {inc.circumstances && inc.circumstances !== inc.title && (
                                                    <p className="text-[11px] font-sans text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-0.5">
                                                        {inc.circumstances}
                                                    </p>
                                                )}
                                                {inc.resolution_notes && (
                                                    <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                                                        <CheckCircle2 className="h-3 w-3 inline shrink-0" />
                                                        <span className="truncate">{inc.resolution_notes}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Involved Student(s) */}
                                            <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                                                {inc.student_rolls ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-[10px]">
                                                        {inc.student_rolls}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400 font-normal">—</span>
                                                )}
                                            </td>

                                            {/* Severity Pill */}
                                            <td className="py-3.5 px-4">
                                                <Badge
                                                    className={`text-[10px] uppercase font-mono ${isCritical
                                                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                                            : inc.severity === 'moderate'
                                                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                                                : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                                        }`}
                                                >
                                                    {inc.severity.replace('_', ' ')}
                                                </Badge>
                                            </td>

                                            {/* Status Pill */}
                                            <td className="py-3.5 px-4">
                                                <span
                                                    className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${inc.status === 'resolved'
                                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                                            : inc.status === 'under_repair'
                                                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                                                                : inc.status === 'replaced'
                                                                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                                                    : isEscalated
                                                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                        }`}
                                                >
                                                    {inc.status.replace('_', ' ')}
                                                </span>
                                            </td>

                                            {/* Role-Aware Action */}
                                            <td className="py-3.5 px-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedIncident(inc)
                                                        setIsDrawerOpen(true)
                                                    }}
                                                    className={`h-7 text-[11px] font-mono gap-1 ${isEscalated && currentRole === 'hod'
                                                            ? 'border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 font-bold'
                                                            : ''
                                                        }`}
                                                >
                                                    {canManageStatuses ? (
                                                        isEscalated && currentRole === 'hod' ? (
                                                            'HOD Review'
                                                        ) : (
                                                            'Manage'
                                                        )
                                                    ) : (
                                                        'View Details'
                                                    )}
                                                    <ChevronRight className="h-3 w-3" />
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* Incident Resolution Drawer */}
            <IncidentDrawer
                incident={selectedIncident}
                isOpen={isDrawerOpen}
                onClose={() => {
                    setIsDrawerOpen(false)
                    setSelectedIncident(null)
                }}
                userRole={currentRole}
            />

            {/* Report Incident Modal */}
            <ReportIncidentModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                onSuccess={(msg) => triggerToast(msg)}
            />
        </div>
    )
}
