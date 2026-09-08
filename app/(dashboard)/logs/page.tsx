import Link from 'next/link'
import { Plus, Search, Trash2, Calendar, LayoutGrid, Users, FileCheck, CheckCircle2, TrendingUp, Sparkles, Terminal, Atom, FlaskRound } from 'lucide-react'
import { getPracticalLogs, deletePracticalLog, getActiveLabs } from '@/app/actions/logs'
import { getServerUserScope } from '@/lib/context/user-scope'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export default async function LogsPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; lab_id?: string; view_mode?: 'my_data' | 'all' }>
}) {
    const params = await searchParams
    const search = params.search || ''
    const labId = params.lab_id || 'all'
    const viewMode = params.view_mode

    const [scope, labs] = await Promise.all([
        getServerUserScope(),
        getActiveLabs(),
    ])

    const logs = await getPracticalLogs({
        search,
        lab_id: labId === 'all' ? undefined : labId,
        view_mode: viewMode,
    })

    const totalLogs = logs.length
    const totalStudents = logs.reduce((acc, curr: any) => acc + (curr.present_students || 0), 0)
    const totalEnrolled = logs.reduce((acc, curr: any) => acc + (curr.total_students || 0), 0)
    const avgAttendance = totalEnrolled > 0 ? Math.round((totalStudents / totalEnrolled) * 100) : 0

    return (
        <div className="space-y-6 animate-in fade-in duration-300 w-full select-none">
            {/* 1. TOP EXECUTIVE AUDIT METRICS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Metric 1 */}
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs">
                                <FileCheck className="h-4 w-4" />
                            </div>
                            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                                Log Database
                            </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 font-bold">
                            Audited
                        </span>
                    </div>
                    <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white">
                            {totalLogs}
                        </span>
                        <span className="text-xs font-medium text-zinc-500">Registered Logs</span>
                    </div>
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        Certified Academic Records
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50 shadow-2xs">
                                <Users className="h-4 w-4" />
                            </div>
                            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                                Student Attendance
                            </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 font-bold">
                            {avgAttendance}% Avg
                        </span>
                    </div>
                    <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                            {totalStudents}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">/ {totalEnrolled} Attended</span>
                    </div>
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        Total Practical Attendance
                    </div>
                </div>

                {/* Metric 3 */}
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/50 shadow-2xs">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                                Active Labs
                            </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 font-bold">
                            {labs.length} Facilities
                        </span>
                    </div>
                    <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white">
                            {labs.length}
                        </span>
                        <span className="text-xs font-medium text-zinc-500">Live Facilities</span>
                    </div>
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        Computer, Physics, Chemistry
                    </div>
                </div>

                {/* Metric 4 */}
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/40 dark:from-zinc-900/90 dark:via-zinc-900/50 dark:to-zinc-950 p-4 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200/60 dark:border-cyan-800/50 shadow-2xs">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                                Compliance
                            </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/50 font-bold">
                            100%
                        </span>
                    </div>
                    <div className="mt-3 mb-1.5 flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold font-mono tracking-tight text-cyan-600 dark:text-cyan-400">
                            Dual Certified
                        </span>
                    </div>
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        Incharge + Principal Dual Sign
                    </div>
                </div>
            </div>

            {/* 2. HEADER ACTION & SEARCH TOOLBAR */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900/80 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <form className="relative flex-1 min-w-[280px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-3.5 w-3.5 text-zinc-400" />
                        </div>
                        <Input
                            type="text"
                            name="search"
                            defaultValue={search}
                            className="pl-8.5 h-8 text-xs font-sans"
                            placeholder="Search by experiment, subject, or batch..."
                        />
                    </form>

                    {/* Quick Lab Filter Links */}
                    <div className="hidden md:flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-mono">
                        <Link
                            href="/logs"
                            className={`px-2.5 py-1 rounded-md transition-all ${labId === 'all'
                                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                        >
                            All Labs
                        </Link>
                        {labs.map((l: any) => (
                            <Link
                                key={l.id}
                                href={`/logs?lab_id=${l.id}${search ? `&search=${search}` : ''}`}
                                className={`px-2.5 py-1 rounded-md transition-all ${labId === l.id
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                                    }`}
                            >
                                {l.name.replace(' Laboratory', '').replace(' Lab 01', '')}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!scope.isPrivileged ? (
                        <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 font-mono text-[11px] px-2.5 py-1">
                            Faculty Scope: {scope.fullName}
                        </Badge>
                    ) : (
                        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-mono">
                            <Link
                                href={`/logs?${labId !== 'all' ? `lab_id=${labId}&` : ''}view_mode=my_data${search ? `&search=${search}` : ''}`}
                                className={`px-2 py-0.5 rounded-md transition-all ${
                                    viewMode === 'my_data'
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                        : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                            >
                                My Sessions
                            </Link>
                            <Link
                                href={`/logs?${labId !== 'all' ? `lab_id=${labId}&` : ''}view_mode=all${search ? `&search=${search}` : ''}`}
                                className={`px-2 py-0.5 rounded-md transition-all ${
                                    viewMode !== 'my_data'
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold shadow-2xs'
                                        : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                            >
                                All Faculty
                            </Link>
                        </div>
                    )}

                    <Link href="/logs/new">
                        <Button size="sm" className="gap-1.5 shadow-xs text-xs font-semibold">
                            <Plus className="h-3.5 w-3.5" />
                            <span>New Practical Entry</span>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* 3. MAIN LOGS AUDIT TABLE CARD */}
            <Card className="border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40 text-xs font-mono text-zinc-500">
                    <span>Official Practical Session Log Database</span>
                    <span>{logs.length} records verified</span>
                </div>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60">
                                <TableHead className="w-[180px] font-mono text-xs">Date & Period</TableHead>
                                <TableHead className="font-mono text-xs">Laboratory & Experiment Topic</TableHead>
                                <TableHead className="font-mono text-xs">Subject Teacher / Batch</TableHead>
                                <TableHead className="w-[160px] font-mono text-xs">Attendance Tally</TableHead>
                                <TableHead className="text-right w-[80px] font-mono text-xs">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-44 text-center text-zinc-500 dark:text-zinc-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <LayoutGrid className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                                            <p className="text-sm font-medium">No practical session logs found.</p>
                                            <p className="text-xs text-zinc-400 font-mono">Create a new session record or adjust search filter.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log: any) => {
                                    const isSkipped = log.status === 'skipped'
                                    const attendancePct =
                                        log.total_students > 0
                                            ? Math.round((log.present_students / log.total_students) * 100)
                                            : 0

                                    const isComp = log.labs?.type?.includes('comp') || log.lab_id === 'comp'
                                    const isPhys = log.labs?.type?.includes('phys') || log.lab_id === 'phys'

                                    return (
                                        <TableRow key={log.id} className="group hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors">
                                            <TableCell className="align-top py-3.5 font-mono">
                                                <div className="flex items-center text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                                    <Calendar className="mr-1.5 h-3 w-3 text-zinc-400" />
                                                    {log.date}
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                    {log.period_label}
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`h-2 w-2 rounded-full shrink-0 ${isComp ? 'bg-indigo-500' : isPhys ? 'bg-cyan-500' : 'bg-rose-500'
                                                            }`}
                                                    />
                                                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                                        {log.labs?.name || 'Science Laboratory'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 pl-3.5">
                                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                                        {log.subject_name}
                                                    </span>
                                                    <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">•</span>
                                                    {log.practical_title || log.topic_learned || 'Practical Experiment'}
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top py-3.5">
                                                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                                    {log.profiles?.full_name || 'Assigned Teacher'}
                                                </div>
                                                <div className="inline-flex items-center mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                                                    {log.batch_group}
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top py-3.5">
                                                {isSkipped ? (
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                                                        Skipped
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                                                            {log.present_students}{' '}
                                                            <span className="text-zinc-400 text-[11px]">/ {log.total_students}</span>
                                                        </span>
                                                        <Badge
                                                            variant={
                                                                attendancePct >= 80
                                                                    ? 'success'
                                                                    : attendancePct >= 50
                                                                        ? 'warning'
                                                                        : 'destructive'
                                                            }
                                                        >
                                                            {attendancePct}%
                                                        </Badge>
                                                    </div>
                                                )}
                                            </TableCell>

                                            <TableCell className="align-top py-3.5 text-right">
                                                <form
                                                    action={async () => {
                                                        'use server'
                                                        await deletePracticalLog(log.id)
                                                    }}
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        type="submit"
                                                        className="h-7 w-7 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </form>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
