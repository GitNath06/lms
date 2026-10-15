@echo off
setlocal enabledelayedexpansion
title LabSync Client Agent Installer

echo =====================================================================
echo           LabSync LIMS - Client Workstation Agent Setup
echo =====================================================================
echo.

set "TARGET_DIR=C:\LabSync"

echo [*] Target Directory: %TARGET_DIR%
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

echo [+] Creating Desktop Shortcut "LabSync Student Portal"...

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\LabSync Student Portal.lnk"
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

cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%"

echo.
echo =====================================================================
echo [OK] Setup Completed Successfully!
echo      Desktop shortcut created: "LabSync Student Portal"
echo =====================================================================
echo.
pause
