import { getPgPool } from '../lib/db.ts'

async function testBootstrapQuery() {
  const pool = getPgPool()
  const sql = `
    SELECT jsonb_build_object(
      'academic_years', (SELECT COALESCE(jsonb_agg(ay), '[]'::jsonb) FROM (SELECT id, name, start_date, end_date, is_current, is_archived FROM public.academic_years ORDER BY start_date DESC) ay),
      'labs', (SELECT COALESCE(jsonb_agg(l), '[]'::jsonb) FROM (SELECT id, name, code, type, capacity, status, is_active FROM public.labs ORDER BY name) l),
      'classes', (SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM (SELECT id, name, grade, section, stream_id, capacity, is_active FROM public.classes WHERE is_active = true ORDER BY name) c),
      'subjects', (SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) FROM (SELECT id, code, name, default_lab_id, credit_hours, is_active FROM public.subjects WHERE is_active = true ORDER BY name) s),
      'class_subjects', (SELECT COALESCE(jsonb_agg(cs), '[]'::jsonb) FROM (
        SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id, cs.default_lab_id, cs.academic_year_id,
               s.code AS subject_code, s.name AS subject_name,
               c.name AS class_name,
               p.full_name AS teacher_name,
               l.name AS lab_name
        FROM public.class_subjects cs
        LEFT JOIN public.subjects s ON s.id = cs.subject_id
        LEFT JOIN public.classes c ON c.id = cs.class_id
        LEFT JOIN public.profiles p ON p.id = cs.teacher_id
        LEFT JOIN public.labs l ON l.id = cs.default_lab_id
      ) cs),
      'teachers', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (SELECT id, full_name, email, role, department, photo_url FROM public.profiles WHERE role IN ('teacher', 'lab_incharge', 'hod') AND is_active = true AND approval_status = 'approved' ORDER BY full_name) t),
      'academic_holidays', (SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) FROM (SELECT * FROM public.academic_holidays ORDER BY date_start ASC) h),
      'issue_categories', (SELECT COALESCE(jsonb_agg(ic), '[]'::jsonb) FROM (SELECT id, name, type, color, icon, default_severity, is_active, sort_order FROM public.issue_categories WHERE is_active = true ORDER BY sort_order) ic),
      'period_settings', (SELECT value FROM public.institution_settings WHERE key = 'master_time_slots' LIMIT 1)
    ) AS payload;
  `
  const start = Date.now()
  const res = await pool.query(sql)
  const duration = Date.now() - start
  console.log(`Bootstrap SQL completed in ${duration}ms!`)
  const payload = res.rows[0]?.payload
  console.log('Payload keys:', Object.keys(payload))
  console.log('Counts:', {
    academic_years: payload.academic_years?.length,
    labs: payload.labs?.length,
    classes: payload.classes?.length,
    subjects: payload.subjects?.length,
    class_subjects: payload.class_subjects?.length,
    teachers: payload.teachers?.length,
    holidays: payload.academic_holidays?.length,
    issue_categories: payload.issue_categories?.length,
  })
  await pool.end()
}

testBootstrapQuery().catch(console.error)

