import { NextRequest, NextResponse } from 'next/server'
import {
  dispatchTeacherDailyReminders,
  dispatchOverdueMaintenanceAlerts,
  dispatchUpcomingHolidayNotices,
} from '@/app/actions/notifications'

import { getServerUserScope } from '@/lib/context/server-user-scope'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const startTime = Date.now()

  // 1. Strict CRON_SECRET authorization check
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization')

  let isAuthorized = false
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true
  } else {
    // Allow manual triggers from authenticated Super Admin session
    try {
      const scope = await getServerUserScope()
      if (!scope.isPending && scope.approvalStatus === 'approved' && scope.role === 'super_admin') {
        isAuthorized = true
      }
    } catch {
      // Unauthenticated
    }
  }

  if (!isAuthorized) {
    return new Response('Unauthorized: Valid CRON_SECRET or Super Admin session required.', { status: 401 })
  }

  // Check if force parameter is provided for manual testing
  const searchParams = req.nextUrl.searchParams
  const force = searchParams.get('force') === 'true'

  try {
    // 2. Execute parallel scheduled scans
    const [teacherReminders, overdueMaintenance, holidayNotices] = await Promise.all([
      dispatchTeacherDailyReminders(force),
      dispatchOverdueMaintenanceAlerts(force),
      dispatchUpcomingHolidayNotices(force),
    ])

    const durationMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      summary: {
        teacherReminders: {
          dispatched: teacherReminders.dispatchedCount,
          skippedDuplicates: teacherReminders.skippedDuplicates,
          message: (teacherReminders as any).message,
        },
        overdueMaintenance: {
          dispatched: overdueMaintenance.dispatchedCount,
          skippedDuplicates: overdueMaintenance.skippedCount,
          overdueLabCount: overdueMaintenance.overdueLabCount,
          message: (overdueMaintenance as any).message,
        },
        holidayNotices: {
          dispatched: holidayNotices.dispatchedCount,
          holidaysFound: holidayNotices.holidaysFound,
          message: (holidayNotices as any).message,
        },
      },
    })
  } catch (err: any) {
    console.error('[Cron Error] Automated email dispatch failed:', err)
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Internal server error during cron dispatch',
      },
      { status: 500 }
    )
  }
}
