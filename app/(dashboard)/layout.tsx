import Link from 'next/link'
import { FlaskConical, Command, LogOut } from 'lucide-react'
import ThemeToggle from '@/components/ui/theme-toggle'
import LiveClockHeader from '@/components/layout/live-clock-header'
import NotificationBell from '@/components/layout/notification-bell'
import CommandPalette from '@/components/command-palette'
import TimeTravelController from '@/components/dev/time-travel-controller'
import TerminalSimulatorController from '@/components/dev/terminal-simulator-controller'
import CollapsibleSidebar from '@/components/layout/collapsible-sidebar'
import MobileNav from '@/components/layout/mobile-nav'
import UserProfileMenu from '@/components/layout/user-profile-menu'
import HeaderSearchTrigger from '@/components/layout/header-search-trigger'
import ClientStorageEvictor from '@/components/layout/client-storage-evictor'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { PwaInstallPrompt } from '@/components/pwa/pwa-install-prompt'
import { getCurrentUserProfile, signOut } from '@/app/actions/auth'
import { AcademicYearProvider, HistoricalArchiveShield } from '@/lib/context/academic-year-context'
import PendingVerificationBanner from '@/components/dashboard/pending-verification-banner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentUserProfile()

  const role = profile?.role || 'teacher'
  const isSuperAdmin = role === 'super_admin'
  const canAccessMaintenance =
    role === 'super_admin' ||
    role === 'lab_incharge' ||
    role === 'hod' ||
    (role as string) === 'coordinator' ||
    profile?.permissions?.can_manage_maintenance === true

  const isPending = profile?.approval_status === 'pending'

  const roleLabel = isPending
    ? 'Pending Verification'
    : isSuperAdmin
    ? 'Super Admin'
    : role === 'lab_incharge'
    ? 'Lab Incharge'
    : role === 'hod'
    ? 'Head of Department'
    : 'Teacher'

  const roleColor = isPending || isSuperAdmin
    ? 'text-amber-600 dark:text-amber-400'
    : role === 'lab_incharge' || role === 'hod'
    ? 'text-indigo-600 dark:text-indigo-400'
    : 'text-zinc-600 dark:text-slate-400'

  return (
    <AcademicYearProvider>
      {/* Purge obsolete prototype localStorage keys once on mount */}
      <ClientStorageEvictor />

      <div className="flex h-screen bg-canvas text-zinc-900 dark:text-zinc-100 transition-colors duration-200 print:h-auto print:bg-white print:p-0 print:m-0 print:block">
        {/* Global Command Palette */}
        <CommandPalette />

        {/* Dev Time Travel Engine Controller (Development only) */}
        {process.env.NODE_ENV === 'development' && <TimeTravelController />}

        {/* Dev Station Rig & Telemetry Simulator (Development only) */}
        {process.env.NODE_ENV === 'development' && <TerminalSimulatorController />}

        {/* Collapsible Sidebar with Animated Toggle */}
        <CollapsibleSidebar
          isSuperAdmin={isSuperAdmin}
          canAccessMaintenance={canAccessMaintenance}
          isPending={isPending}
        />

        {/* Main Container */}
        <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block print:h-auto print:bg-white">
          {/* Topbar with Live Nepali Calendar & Real-time Clock */}
          <header className="h-16 glass-header w-full max-w-[100vw] px-3 sm:px-6 flex items-center justify-between gap-3 z-40 print:hidden">
            {/* Left Group */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <MobileNav
                isSuperAdmin={isSuperAdmin}
                canAccessMaintenance={canAccessMaintenance}
                isPending={isPending}
                profileName={profile?.full_name}
                roleLabel={roleLabel}
                roleColor={roleColor}
              />
              <LiveClockHeader />
            </div>

            {/* Right Group */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <HeaderSearchTrigger />
              <NotificationBell
                currentUserRole={role}
                currentUserName={profile?.full_name}
              />
              <ThemeToggle />
              <div className="h-4 w-px bg-zinc-200/80 dark:bg-zinc-800/80 mx-0.5 hidden xs:block" />

              {/* In-App Enhanced User Profile Menu */}
              <UserProfileMenu profile={profile} />
            </div>
          </header>

          {/* Ambient Historical Archive Shield */}
          <HistoricalArchiveShield />

          {/* Page Content with safe padding for persistent mobile dock */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 bg-canvas print:p-0 print:m-0 print:bg-white print:overflow-visible print:block">
            <PendingVerificationBanner profile={profile} />
            {children}
          </main>

          {/* Ergonomic Mobile Bottom Navigation Dock */}
          <MobileBottomNav />

          {/* PWA Smart Install Prompt */}
          <PwaInstallPrompt />
        </div>
      </div>
    </AcademicYearProvider>
  )
}
