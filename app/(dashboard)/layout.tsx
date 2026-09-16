import Link from 'next/link'
import { FlaskConical, Command, LogOut } from 'lucide-react'
import ThemeToggle from '@/components/ui/theme-toggle'
import LiveClockHeader from '@/components/layout/live-clock-header'
import CloudSyncStatus from '@/components/layout/cloud-sync-status'
import NotificationBell from '@/components/layout/notification-bell'
import CommandPalette from '@/components/command-palette'
import TimeTravelController from '@/components/dev/time-travel-controller'
import CollapsibleSidebar from '@/components/layout/collapsible-sidebar'
import MobileNav from '@/components/layout/mobile-nav'
import UserProfileMenu from '@/components/layout/user-profile-menu'
import HeaderSearchTrigger from '@/components/layout/header-search-trigger'
import { getCurrentUserProfile, signOut } from '@/app/actions/auth'

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

  const roleLabel =
    isSuperAdmin
      ? 'Super Admin'
      : role === 'lab_incharge'
      ? 'Lab Incharge'
      : role === 'hod'
      ? 'Head of Department'
      : 'Teacher'

  const roleColor =
    isSuperAdmin
      ? 'text-amber-600 dark:text-amber-400'
      : role === 'lab_incharge' || role === 'hod'
      ? 'text-indigo-600 dark:text-indigo-400'
      : 'text-zinc-600 dark:text-slate-400'

  return (
    <div className="flex h-screen bg-canvas text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Global Command Palette */}
      <CommandPalette />

      {/* Dev Time Travel Engine Controller */}
      <TimeTravelController />

      {/* Collapsible Sidebar with Animated Toggle */}
      <CollapsibleSidebar
        isSuperAdmin={isSuperAdmin}
        canAccessMaintenance={canAccessMaintenance}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar with Live Nepali Calendar & Real-time Clock */}
        <header className="h-16 glass-header flex items-center justify-between px-4 sm:px-6 z-20 print:hidden gap-4">
          {/* Zone 1: Context (Mobile Nav, Period Beacon & Live Clock) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <MobileNav
              isSuperAdmin={isSuperAdmin}
              canAccessMaintenance={canAccessMaintenance}
              profileName={profile?.full_name}
              roleLabel={roleLabel}
              roleColor={roleColor}
            />
            <LiveClockHeader />
          </div>

          {/* Zone 2: Centered Global Search Trigger */}
          <div className="hidden md:flex flex-1 justify-center max-w-md mx-2 lg:mx-auto">
            <HeaderSearchTrigger />
          </div>

          {/* Zone 3: Utilities & User Identity */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="md:hidden">
              <HeaderSearchTrigger />
            </div>
            <CloudSyncStatus />
            <div className="h-4 w-px bg-zinc-200/80 dark:bg-zinc-800/80 mx-0.5 hidden sm:block" />
            <NotificationBell
              currentUserRole={role}
              currentUserName={profile?.full_name}
            />
            <ThemeToggle />
            <div className="h-4 w-px bg-zinc-200/80 dark:bg-zinc-800/80 mx-0.5" />

            {/* In-App Enhanced User Profile Menu */}
            <UserProfileMenu profile={profile} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-canvas">
          {children}
        </main>
      </div>
    </div>
  )
}
