import Link from 'next/link'
import { Calendar, ClipboardList, LayoutDashboard, LogOut, FlaskConical, Printer, Command, UserCheck, Shield } from 'lucide-react'
import ThemeToggle from '@/components/ui/theme-toggle'
import LiveClockHeader from '@/components/layout/live-clock-header'
import CloudSyncStatus from '@/components/layout/cloud-sync-status'
import CommandPalette from '@/components/command-palette'
import { getCurrentUserProfile, signOut } from '@/app/actions/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentUserProfile()

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'LA'

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Global Command Palette */}
      <CommandPalette />

      {/* Linear-style Sidebar */}
      <aside className="w-64 bg-white dark:bg-zinc-900/60 border-r border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-xl flex flex-col hidden md:flex print:hidden">
        {/* Logo / Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 shadow-sm">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">LabSync LIMS</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Academic Session 2083</div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-5 px-3">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono flex items-center justify-between">
            <span>Navigation</span>
            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded text-zinc-400 font-mono flex items-center gap-0.5">
              <Command className="h-2.5 w-2.5" /> K
            </span>
          </div>
          <ul className="space-y-1">
            <li>
              <Link
                href="/"
                className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all group"
              >
                <LayoutDashboard className="mr-3 h-4 w-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                Overview & Live Feed
              </Link>
            </li>
            <li>
              <Link
                href="/schedules"
                className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all group"
              >
                <Calendar className="mr-3 h-4 w-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                Schedules & Matrix
              </Link>
            </li>
            <li>
              <Link
                href="/logs"
                className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all group"
              >
                <ClipboardList className="mr-3 h-4 w-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                Practical Logs Register
              </Link>
            </li>
            <li>
              <Link
                href="/print/daily-log"
                className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all group"
              >
                <Printer className="mr-3 h-4 w-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors" />
                Daily Certified Report
              </Link>
            </li>
            <li className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
              <Link
                href="/admin"
                className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all group"
              >
                <Shield className="mr-3 h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span>Super Admin Control</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer / Account */}
        <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center w-full px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out Session
            </button>
          </form>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar with Live Nepali Calendar & Real-time Clock */}
        <header className="h-16 bg-white/80 dark:bg-zinc-900/60 border-b border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-md flex items-center justify-between px-6 z-20 print:hidden">
          <div className="flex items-center gap-3">
            <LiveClockHeader />
          </div>
          
          <div className="flex items-center gap-3">
            <CloudSyncStatus />
            <ThemeToggle />

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {profile?.full_name || 'Faculty Member'}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-end gap-1">
                  {isAdmin ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                      <Shield className="h-2.5 w-2.5" /> Admin Incharge
                    </span>
                  ) : (
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                      <UserCheck className="h-2.5 w-2.5" /> Faculty
                    </span>
                  )}
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-bold ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-2xs">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-zinc-50/50 dark:bg-zinc-950">
          {children}
        </main>
      </div>
    </div>
  )
}
