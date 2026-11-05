import { NextRequest, NextResponse } from 'next/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { getPgPool } from '@/lib/db'
import { getPracticalRecords, getIncidentRecords } from '@/app/actions/records'
import { getStudentBoardComplianceReport } from '@/app/actions/institutional-reports'
import { exportMaintenanceRecordsAction } from '@/app/actions/maintenance'
import {
  generatePracticalRecordsXlsxBuffer,
  generateIncidentRecordsXlsxBuffer,
  generateStudentBoardComplianceXlsxBuffer,
} from '@/lib/exports/xlsx'
import {
  generatePracticalRecordsCsv,
  generateIncidentRecordsCsv,
} from '@/lib/exports/csv'

export const dynamic = 'force-dynamic'

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params
    const searchParams = request.nextUrl.searchParams
    const format = (searchParams.get('format') || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx'

    // 1. Authenticate user session
    const scope = await getServerUserScope()
    if (!scope.userId) {
      return NextResponse.json({ error: 'Unauthorized: Active user session required.' }, { status: 401 })
    }

    // 2. Dispatch to dedicated export generator
    switch (type) {
      // -------------------------------------------------------------
      // Practical Logbook Records
      // -------------------------------------------------------------
      case 'practical-records': {
        const lab_id = searchParams.get('lab_id') || undefined
        const academic_year_id = searchParams.get('academic_year_id') || undefined
        const date_from = searchParams.get('date_from') || undefined
        const date_to = searchParams.get('date_to') || undefined
        const search = searchParams.get('search') || undefined
        const status = searchParams.get('status') || undefined
        const batch_group = searchParams.get('batch_group') || undefined
        const groupBy = (searchParams.get('groupBy') || 'none') as any
        const selectedIdsParam = searchParams.get('selected_ids')
        const colsParam = searchParams.get('cols')
        const visibleColumns = colsParam ? colsParam.split(',') : undefined

        const selectedIds = selectedIdsParam ? selectedIdsParam.split(',') : undefined
        const exportFilters: any = {
          lab_id: lab_id && lab_id !== 'all' ? lab_id : undefined,
          academic_year_id: academic_year_id && academic_year_id !== 'all' ? academic_year_id : undefined,
          date_from,
          date_to,
          search,
          status: status && status !== 'all' ? status : undefined,
          batch_group: batch_group && batch_group !== 'all' ? batch_group : undefined,
          selected_ids: selectedIds,
        }

        const data = await getPracticalRecords(exportFilters, groupBy)
        if (!data.success) {
          return NextResponse.json({ error: data.error || 'Failed to fetch practical records.' }, { status: 400 })
        }

        let resolvedYearName: string | undefined = undefined
        if (academic_year_id && academic_year_id !== 'all') {
          try {
            const pool = getPgPool()
            const ayRes = await pool.query(`SELECT name FROM public.academic_years WHERE id = $1;`, [academic_year_id])
            if (ayRes.rows.length > 0) resolvedYearName = ayRes.rows[0].name
          } catch {}
        }

        const fromStr = date_from || 'start'
        const toStr = date_to || 'end'
        const yearPrefix = academic_year_id && academic_year_id !== 'all' ? `_ay-${academic_year_id}` : ''
        const selPrefix = selectedIds && selectedIds.length > 0 ? `_selected-${selectedIds.length}` : ''
        const filename = `practical-records${yearPrefix}_${groupBy}${selPrefix}_${fromStr}_${toStr}.${format}`

        if (format === 'csv') {
          const csvContent = generatePracticalRecordsCsv(data.sections, {
            labName: lab_id ? lab_id.toUpperCase() : 'All Laboratories',
            dateRange: `${date_from || 'Earliest'} to ${date_to || 'Latest'}`,
            academicYear: resolvedYearName || (academic_year_id !== 'all' ? academic_year_id : undefined),
            visibleColumns,
          })
          const buffer = Buffer.from(csvContent, 'utf-8')
          return new Response(new Uint8Array(buffer), {
            headers: {
              'Content-Type': CSV_CONTENT_TYPE,
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'no-store, no-cache',
            },
          })
        } else {
          const buffer = await generatePracticalRecordsXlsxBuffer(data.sections, {
            labName: lab_id ? lab_id.toUpperCase() : 'All Laboratories',
            dateRange: `${date_from || 'Earliest'} to ${date_to || 'Latest'}`,
            groupByLabel: groupBy.toUpperCase(),
            academicYear: resolvedYearName || (academic_year_id !== 'all' ? academic_year_id : undefined),
            visibleColumns,
          })
          return new Response(new Uint8Array(buffer), {
            headers: {
              'Content-Type': XLSX_CONTENT_TYPE,
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'no-store, no-cache',
            },
          })
        }
      }

      // -------------------------------------------------------------
      // NEB Board Exam 75% Attendance Compliance Register
      // -------------------------------------------------------------
      case 'neb-compliance': {
        const academic_year_id = searchParams.get('academic_year_id')
        const class_id = searchParams.get('class_id')

        if (!academic_year_id || !class_id) {
          return NextResponse.json(
            { error: 'Missing required parameters: academic_year_id and class_id' },
            { status: 400 }
          )
        }

        const reportRes = await getStudentBoardComplianceReport({
          academicYearId: academic_year_id,
          classId: class_id,
        })
        if (!reportRes.success || !reportRes.data) {
          return NextResponse.json(
            { error: reportRes.error || 'Failed to retrieve compliance data.' },
            { status: 400 }
          )
        }

        const buffer = await generateStudentBoardComplianceXlsxBuffer(reportRes.data)
        const cleanClassName = reportRes.data.class_name.replace(/\s+/g, '_')
        const filename = `NEB_Compliance_Register_${cleanClassName}_${reportRes.data.academic_year_name}.xlsx`

        return new Response(new Uint8Array(buffer), {
          headers: {
            'Content-Type': XLSX_CONTENT_TYPE,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-store, no-cache',
          },
        })
      }

      // -------------------------------------------------------------
      // Equipment Breakage & Incident Register
      // -------------------------------------------------------------
      case 'incident-records': {
        const lab_id = searchParams.get('lab_id') || undefined
        const date_from = searchParams.get('date_from') || undefined
        const date_to = searchParams.get('date_to') || undefined
        const search = searchParams.get('search') || undefined
        const severity = searchParams.get('severity') || undefined
        const status = searchParams.get('status') || undefined
        const colsParam = searchParams.get('cols')
        const visibleColumns = colsParam ? colsParam.split(',') : undefined

        const data = await getIncidentRecords({
          lab_id: lab_id && lab_id !== 'all' ? lab_id : undefined,
          date_from,
          date_to,
          search,
          severity: severity && severity !== 'all' ? severity : undefined,
          status: status && status !== 'all' ? status : undefined,
        })

        if (!data.success) {
          return NextResponse.json({ error: data.error || 'Failed to fetch incident records.' }, { status: 400 })
        }

        const fromStr = date_from || 'start'
        const toStr = date_to || 'end'
        const filename = `incident-records_${lab_id || 'all'}_${fromStr}_${toStr}.${format}`

        if (format === 'csv') {
          const csvContent = generateIncidentRecordsCsv(data.incidents, {
            labName: lab_id ? lab_id.toUpperCase() : 'All Laboratories',
            dateRange: `${date_from || 'Earliest'} to ${date_to || 'Latest'}`,
            visibleColumns,
          })
          const buffer = Buffer.from(csvContent, 'utf-8')
          return new Response(new Uint8Array(buffer), {
            headers: {
              'Content-Type': CSV_CONTENT_TYPE,
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'no-store, no-cache',
            },
          })
        } else {
          const buffer = await generateIncidentRecordsXlsxBuffer(data.incidents, data.metrics, {
            labName: lab_id ? lab_id.toUpperCase() : 'All Laboratories',
            dateRange: `${date_from || 'Earliest'} to ${date_to || 'Latest'}`,
            visibleColumns,
          })
          return new Response(new Uint8Array(buffer), {
            headers: {
              'Content-Type': XLSX_CONTENT_TYPE,
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'no-store, no-cache',
            },
          })
        }
      }

      // -------------------------------------------------------------
      // Laboratory Maintenance & Service History Logbook
      // -------------------------------------------------------------
      case 'maintenance-records': {
        const labId = searchParams.get('lab_id') || 'all'
        const result = await exportMaintenanceRecordsAction(labId, format)
        if (!result.success || !result.base64) {
          return NextResponse.json({ error: result.error || 'Failed to export maintenance records' }, { status: 400 })
        }

        const buffer = Buffer.from(result.base64, 'base64')
        return new Response(new Uint8Array(buffer), {
          headers: {
            'Content-Type': result.contentType || (format === 'csv' ? CSV_CONTENT_TYPE : XLSX_CONTENT_TYPE),
            'Content-Disposition': `attachment; filename="${result.filename || `maintenance-records.${format}`}"`,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-store, no-cache',
          },
        })
      }

      default:
        return NextResponse.json({ error: `Unknown export type "${type}".` }, { status: 404 })
    }
  } catch (err: any) {
    console.error('[export route error]:', err)
    return NextResponse.json({ error: err.message || 'Internal server error during export' }, { status: 500 })
  }
}
