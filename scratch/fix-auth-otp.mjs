import fs from 'node:fs'

// 1. app/actions/auth.ts
const authPath = 'd:/Projects/LMR/app/actions/auth.ts'
let authContent = fs.readFileSync(authPath, 'utf8')

authContent = authContent.replace(
  "const department = (formData.get('department') as string)?.trim() || 'Science Department'",
  "const department = (formData.get('department') as string)?.trim() || null"
)
authContent = authContent.replace(
  "department: user.user_metadata?.department || 'Science Department',",
  "department: user.user_metadata?.department || null,"
)
authContent = authContent.replace(
  "department: 'Science Department',",
  "department: null,"
)
authContent = authContent.replace(
  "const department = data.department?.trim() || 'Science Department'",
  "const department = data.department?.trim() || null"
)

fs.writeFileSync(authPath, authContent, 'utf8')
console.log('Successfully updated auth.ts!')

// 2. app/actions/otp.ts
const otpPath = 'd:/Projects/LMR/app/actions/otp.ts'
let otpContent = fs.readFileSync(otpPath, 'utf8')

otpContent = otpContent.replace(
  "const department = (formData.get('department') as string)?.trim() || 'Science Department'",
  "const department = (formData.get('department') as string)?.trim() || null"
)

fs.writeFileSync(otpPath, otpContent, 'utf8')
console.log('Successfully updated otp.ts!')
