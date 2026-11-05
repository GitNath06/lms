import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { getInstitutionalAgentSecret } from '@/lib/security/terminal-handshake'
import { safeEqual } from '@/lib/security/terminal-token'

/**
 * Dynamic Agent Installer Generator.
 * Authenticates administrator credentials or institutional pairing token,
 * injects the server LAN URL, lab ID, pairing token, and streams Setup-LabTerminal.bat
 * as a single-click downloadable batch installer.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const suppliedToken = (
    searchParams.get('token') ||
    searchParams.get('pairingToken') ||
    req.headers.get('x-labsync-agent-key') ||
    ''
  ).trim()

  let institutionalSecret = ''
  try {
    institutionalSecret = getInstitutionalAgentSecret()
  } catch {
    // If not configured, will be caught if token validation is attempted
  }

  const isTokenValid = Boolean(
    institutionalSecret &&
    suppliedToken &&
    safeEqual(suppliedToken, institutionalSecret)
  )

  const hostname = req.nextUrl.hostname
  const isDevLocalhost =
    process.env.NODE_ENV !== 'production' &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')

  let isSessionAllowed = false
  try {
    const scope = await getServerUserScope()
    isSessionAllowed =
      !scope.isPending &&
      scope.approvalStatus === 'approved' &&
      (scope.isPrivileged || scope.role === 'super_admin' || scope.role === 'lab_incharge')
  } catch {
    isSessionAllowed = false
  }

  if (!isTokenValid && !isDevLocalhost && !isSessionAllowed) {
    return new NextResponse(
      'Unauthorized: Valid institutional pairing token or administrator session required to download terminal setup package.',
      { status: 403 }
    )
  }

  const origin = req.nextUrl.origin
  const serverUrl = (searchParams.get('serverUrl') || origin).trim().replace(/\/+$/, '')
  const labId = (searchParams.get('labId') || 'comp').trim()
  const pairingToken = (suppliedToken && isTokenValid ? suppliedToken : institutionalSecret).trim()

  const scriptDir = path.join(process.cwd(), 'scripts', 'client-agent')
  const batPath = path.join(scriptDir, 'Setup-LabTerminal.bat')
  const ps1Path = path.join(scriptDir, 'labsync-agent.ps1')

  if (!fs.existsSync(batPath) || !fs.existsSync(ps1Path)) {
    return new NextResponse('Agent template scripts not found on server.', { status: 500 })
  }

  const batTemplate = fs.readFileSync(batPath, 'utf8')

  // Inject runtime constants into batch script
  const customizedBat = batTemplate
    .replace(
      'if "%SERVER_URL%"=="" set "SERVER_URL=http://localhost:3000"',
      `set "SERVER_URL=${serverUrl}"`
    )
    .replace('if "%LAB_ID%"=="" set "LAB_ID=comp"', `set "LAB_ID=${labId}"`)
    .replace('if "%PAIRING_TOKEN%"=="" set "PAIRING_TOKEN="', `set "PAIRING_TOKEN=${pairingToken}"`)

  return new NextResponse(customizedBat, {
    headers: {
      'Content-Type': 'application/x-bat; charset=utf-8',
      'Content-Disposition': `attachment; filename="Setup-LabTerminal-${labId}.bat"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
