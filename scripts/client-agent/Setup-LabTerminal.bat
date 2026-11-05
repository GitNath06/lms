
@echo off
setlocal enabledelayedexpansion

title LabSync LIMS - Physical Workstation Auto-Enrollment Installer
color 0b

echo ==========================================================================
echo       LabSync LIMS - Physical Workstation Auto-Enrollment Installer        
echo ==========================================================================
echo.

:: 1. Verify / Request Administrator Elevation
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Requesting Administrator privileges to provision workstation shortcuts...
    powershell -Command "Start-Process cmd.exe -ArgumentList '/k \"\"%~f0\"\"' -Verb runAs"
    exit /b
)

:: 2. Pre-Configured Parameters (injected dynamically by /admin generator)
if "%SERVER_URL%"=="" set "SERVER_URL=http://localhost:3000"
if "%LAB_ID%"=="" set "LAB_ID=comp"
if "%PAIRING_TOKEN%"=="" set "PAIRING_TOKEN="

echo [*] Server URL       : %SERVER_URL%
echo [*] Laboratory Scope : %LAB_ID%
echo.

:: 3. Workstation Code Resolution
set "RESOLVED_CODE=%COMPUTERNAME%"

:: Check if computer name starts with PC or DESK followed by numbers
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "if ($env:COMPUTERNAME -match '^(?:.*?(?:PC|DESK|NODE)[-_]?)(\d+)$') { 'PC-{0:D2}' -f [int]$matches[1] } else { '' }"') do set "DETECTED_CODE=%%a"

if not "!DETECTED_CODE!"=="" (
    set "RESOLVED_CODE=!DETECTED_CODE!"
    echo [+] Auto-detected Station Code : !RESOLVED_CODE!
    goto :code_resolved
)

echo [!] Computer name '%COMPUTERNAME%' does not match standard lab format (e.g. PC-01).
set /p "USER_INPUT=    Enter Workstation Code (e.g. PC-01 or 1): "
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "$raw = '!USER_INPUT!'.Trim(); if ($raw -match '^\d+$') { 'PC-{0:D2}' -f [int]$raw } elseif ($raw -match '^[A-Za-z]+[-_]?\d+$') { $raw.ToUpper() } else { $raw }"') do set "RESOLVED_CODE=%%a"

:code_resolved
if "!RESOLVED_CODE!"=="" set "RESOLVED_CODE=PC-01"

echo [*] Confirmed Station Identifier : !RESOLVED_CODE!
echo.

:: 4. Create %ProgramData%\LabSync Provisioning Directory
set "TARGET_DIR=%ProgramData%\LabSync"
if not exist "%TARGET_DIR%" (
    echo [+] Creating provisioning directory: %TARGET_DIR%
    mkdir "%TARGET_DIR%"
)

:: 5. Copy or Deploy labsync-agent.ps1
set "TARGET_SCRIPT=%TARGET_DIR%\labsync-agent.ps1"
if exist "%~dp0labsync-agent.ps1" (
    echo [+] Deploying labsync-agent.ps1 from installer directory...
    copy /y "%~dp0labsync-agent.ps1" "%TARGET_SCRIPT%" >nul
) else (
    echo [+] Downloading latest labsync-agent.ps1 from %SERVER_URL%...
    powershell -NoProfile -Command "try { [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }; Invoke-WebRequest -Uri '%SERVER_URL%/api/terminal/agent/script' -OutFile '%TARGET_SCRIPT%' -TimeoutSec 10 } catch { Write-Host '[!] Failed to download agent script: ' $_.Exception.Message -ForegroundColor Red }"
)

:: 6. Write C:\ProgramData\LabSync\config.json
echo [+] Writing persistent station configuration...
(
    echo {
    echo   "server_url": "%SERVER_URL%",
    echo   "lab_id": "%LAB_ID%",
    echo   "station_code": "!RESOLVED_CODE!",
    echo   "pairing_token": "%PAIRING_TOKEN%",
    echo   "installed_at": "%DATE% %TIME%"
    echo }
) > "%TARGET_DIR%\config.json"

:: 7. Create All-Users (Public) Desktop & Startup Shortcuts
echo [+] Creating Public Desktop and Windows Startup shortcuts...

powershell -NoProfile -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$targetScript = 'C:\ProgramData\LabSync\labsync-agent.ps1'; " ^
    "$psExe = (Get-Command powershell.exe).Source; " ^
    "$publicDesktop = [System.Environment]::GetFolderPath('CommonDesktopDirectory'); " ^
    "$userDesktop = [System.Environment]::GetFolderPath('Desktop'); " ^
    "$startupFolder = [System.Environment]::GetFolderPath('CommonStartup'); " ^
    "foreach ($d in @($publicDesktop, $userDesktop)) { " ^
    "  if ($d -and (Test-Path $d)) { " ^
    "    $sc = $wsh.CreateShortcut(\"$d\LabSync Student Portal.lnk\"); " ^
    "    $sc.TargetPath = $psExe; " ^
    "    $sc.Arguments = \"-ExecutionPolicy Bypass -WindowStyle Hidden -File `\"$targetScript`\"\"; " ^
    "    $sc.Description = 'LabSync Student Assistance & Terminal Portal'; " ^
    "    $sc.WorkingDirectory = 'C:\ProgramData\LabSync'; " ^
    "    $sc.IconLocation = \"$env:SystemRoot\System32\imageres.dll,99\"; " ^
    "    $sc.Save(); " ^
    "  } " ^
    "}; " ^
    "$shortcutStartup = $wsh.CreateShortcut(\"$startupFolder\LabSync Terminal.lnk\"); " ^
    "$shortcutStartup.TargetPath = $psExe; " ^
    "$shortcutStartup.Arguments = \"-ExecutionPolicy Bypass -WindowStyle Hidden -File `\"$targetScript`\"\"; " ^
    "$shortcutStartup.Description = 'LabSync Terminal Boot Synchronizer'; " ^
    "$shortcutStartup.WorkingDirectory = 'C:\ProgramData\LabSync'; " ^
    "$shortcutStartup.IconLocation = \"$env:SystemRoot\System32\imageres.dll,99\"; " ^
    "$shortcutStartup.Save(); "

echo.
echo ==========================================================================
echo [SUCCESS] Workstation provisioned successfully!
echo   - Configuration: %TARGET_DIR%\config.json
echo   - Desktop Icon : Public Desktop (All Users)
echo   - Auto-Boot    : Windows Startup (All Users)
echo.
echo Launching workstation terminal portal now...
echo ==========================================================================
echo.

:: 8. Execute Agent Immediately
powershell -ExecutionPolicy Bypass -File "%TARGET_DIR%\labsync-agent.ps1"

echo.
echo ==========================================================================
echo [COMPLETE] Workstation setup finished.
echo Press any key to close this installer window...
echo ==========================================================================
pause >nul
