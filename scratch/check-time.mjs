import fs from 'fs'
import path from 'path'

// Test current time calculation
const date = new Date()
console.log('Real Date now:', date.toISOString())
console.log('Real Date local:', date.toString())

const nptMs = date.getTime() + 5.75 * 3600000
const nptDate = new Date(nptMs)
const dayIndex = nptDate.getUTCDay()
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const dayKey = DAY_KEYS[dayIndex]
const currentMinutes = nptDate.getUTCHours() * 60 + nptDate.getUTCMinutes()
console.log('dayKey:', dayKey)
console.log('dayIndex:', dayIndex)
console.log('currentMinutes:', currentMinutes)
