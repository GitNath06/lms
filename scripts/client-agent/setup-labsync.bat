@echo off
setlocal enabledelayedexpansion
title LabSync Client Agent Installer

echo =====================================================================
echo           LabSync LIMS - Client Workstation Agent Setup
echo =====================================================================
echo.

:: 1. Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting administrative privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "TARGET_DIR=C:\LabSync"

echo [*] Target Installation Directory: %TARGET_DIR%
if not exist "%TARGET_DIR%" (
    echo [+] Creating %TARGET_DIR%...
    mkdir "%TARGET_DIR%"
)

echo [+] Copying agent files...
copy /Y "%~dp0labsync-agent.ps1" "%TARGET_DIR%\labsync-agent.ps1" >nul
if exist "%~dp0config.json" (
    copy /Y "%~dp0config.json" "%TARGET_DIR%\config.json" >nul
) else (
    copy /Y "%~dp0config.sample.json" "%TARGET_DIR%\config.json" >nul
)

:: 2. Register Silent Windows Scheduled Task at Logon / Boot
echo [+] Registering background startup task "LabSyncClientAgent"...
schtasks /delete /tn "LabSyncClientAgent" /f >nul 2>&1
schtasks /create /tn "LabSyncClientAgent" /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%TARGET_DIR%\labsync-agent.ps1\"" /sc onlogon /rl highest /f >nul

if %errorlevel% equ 0 (
    echo     [OK] Background startup task registered (Runs on every student logon/boot).
) else (
    echo     [!] Warning: Could not register scheduled task. Agent can still run via shortcut.
)

:: 3. Create Desktop Shortcut "LabSync Student Portal"
echo [+] Creating Desktop Shortcut "LabSync Student Portal"...
set "SHORTCUT_PATH=%PUBLIC%\Desktop\LabSync Student Portal.lnk"
set "VBS_SCRIPT=%TEMP%\create_shortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%SHORTCUT_PATH%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "powershell.exe" >> "%VBS_SCRIPT%"
echo oLink.Arguments = "-NoProfile -ExecutionPolicy Bypass -File """ ^& "%TARGET_DIR%\labsync-agent.ps1" ^& """" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Launch LabSync Student Terminal Portal" >> "%VBS_SCRIPT%"
echo oLink.WindowStyle = 1 >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

cscript /nologo "%VBS_SCRIPT%" >nul 2>&1
del "%VBS_SCRIPT%" >nul 2>&1

echo.
echo =====================================================================
echo [OK] Setup Completed Successfully!
echo      - Program Folder : %TARGET_DIR%
echo      - Auto-Start     : Enabled (Windows Scheduled Task on Logon/Boot)
echo      - Public Desktop : "LabSync Student Portal"
echo =====================================================================
echo.
timeout /t 5
