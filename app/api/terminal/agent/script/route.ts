import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Streams the pure PowerShell client agent script (labsync-agent.ps1).
 * Called by Setup-LabTerminal.bat during standalone workstation provisioning.
 */
export async function GET(req: NextRequest) {
  const scriptPath = path.join(process.cwd(), 'scripts', 'client-agent', 'labsync-agent.ps1')

  if (!fs.existsSync(scriptPath)) {
    return new NextResponse('Agent script template not found on server.', { status: 500 })
  }

  const scriptContent = fs.readFileSync(scriptPath, 'utf8')

  return new NextResponse(scriptContent, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="labsync-agent.ps1"',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

