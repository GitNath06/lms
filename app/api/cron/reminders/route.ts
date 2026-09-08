import { NextRequest, NextResponse } from 'next/server'
import {
  dispatchTeacherDailyReminders,
  dispatchOverdueMaintenanceAlerts,
  dispatchUpcomingHolidayNotices,
} from '@/app/actions/notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const startTime = Date.now()

  // 1. Strict CRON_SECRET authorization check
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
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
