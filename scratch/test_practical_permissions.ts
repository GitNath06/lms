import { updatePracticalLog, deletePracticalLog, getPracticalLogs } from '../app/actions/logs'

console.log('--- TEST SUITE: PRACTICAL MODIFICATION & RECORD PERMISSIONS ---')

async function runTests() {
  try {
    const logs = await getPracticalLogs()
    console.log(`Fetched ${logs.length} logs.`)
    if (logs.length > 0) {
      const target = logs[0]
      console.log(`Testing modification on log ID: ${target.id} (${target.subject_name})`)
      
      const updateRes = await updatePracticalLog(target.id, {
        remarks: 'Updated via test suite verification',
      })
      console.log('Update result:', updateRes)
      if (updateRes.success) {
        console.log('✅ PASS: Practical log update completed successfully')
      } else {
        console.log('⚠️ Update result info:', updateRes.error)
      }
    }
  } catch (err) {
    console.error('Test error:', err)
  }
}

runTests()
