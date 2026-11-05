process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: 'test-admin',
  email: 'admin@rrl.edu.np',
  full_name: 'Super Admin',
  role: 'super_admin',
  approval_status: 'approved',
  is_active: true,
  permissions: { can_access_admin: true, can_manage_users: true }
})

import { updateClassAction, getClassesAction } from '../app/actions/classes.ts'

async function test() {
  try {
    console.log('Testing updateClassAction with custom stream...')
    const res = await updateClassAction('12eng', {
      name: '12 Eng',
      grade: 12,
      section: 'Eng',
      stream_id: 'Computer Engineering',
      capacity: 38
    })
    console.log('RESULT OF updateClassAction:', res)

    const classesRes = await getClassesAction()
    const class12 = classesRes.data.find(c => c.id === '12eng')
    console.log('CLASS 12 ENG IN DB:', class12)
  } catch (err) {
    console.error('ERROR:', err)
  }
}

test()
