import fs from 'node:fs'

const filePath = 'd:/Projects/LMR/app/actions/schedules.ts'
let content = fs.readFileSync(filePath, 'utf8')

const target = `      // Clear existing schedules table
      await client.query('DELETE FROM public.schedules;')`

const replacement = `      // Reset all schedules to default 'scheduled' status and clear skipped metadata
      const updateRes = await client.query(\`
        UPDATE public.schedules
        SET status = 'scheduled',
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{is_skipped}',
              'false'::jsonb
            );
      \`)

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    const resetCount = (await pool.query('SELECT count(*) FROM public.schedules;')).rows[0]?.count || 0

    await recordAuditEvent({
      action: 'UPDATE',
      entityType: 'policy',
      entityId: 'master_routine_reset',
      entityLabel: 'Master Timetable Schedule Reset',
      before: { status: 'custom_modified' },
      after: { status: 'restored_to_master_baseline', total_routines: Number(resetCount) },
      metadata: { operation: 'reset_schedules_to_master' },
    })

    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true, count: Number(resetCount) }
  } catch (err: any) {
    console.error('[DATABASE ERROR] Reset schedules to master failed:', err)
    return { success: false, error: err?.message || 'Failed to reset schedules.' }
  }
}`

const funcStart = content.indexOf('export async function resetSchedulesToMaster')
if (funcStart === -1) {
  console.error('Could not find resetSchedulesToMaster function')
  process.exit(1)
}

const clearIndex = content.indexOf('// Clear existing schedules table', funcStart)
const updateScheduleIndex = content.indexOf('export async function updateSchedule(', funcStart)

if (clearIndex === -1 || updateScheduleIndex === -1) {
  console.error('Could not locate block bounds', { clearIndex, updateScheduleIndex })
  process.exit(1)
}

const before = content.slice(0, clearIndex)
const after = content.slice(updateScheduleIndex)

content = before + replacement + '\n\n/**\n * Update an existing scheduled slot in PostgreSQL.\n * Fetches pre-state, applies changes, and records UPDATE audit event with structured diff.\n */\n' + after

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated schedules.ts!')
