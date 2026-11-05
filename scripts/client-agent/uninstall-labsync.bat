@echo off
setlocal enabledelayedexpansion
title LabSync Client Agent Uninstaller

echo =====================================================================
echo          LabSync LIMS - Client Workstation Agent Uninstaller
echo =====================================================================
echo.

:: 1. Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting administrative privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 2. Remove Scheduled Task
echo [+] Removing background scheduled task "LabSyncClientAgent"...
schtasks /delete /tn "LabSyncClientAgent" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo     [OK] Scheduled task removed.
) else (
    echo     [*] Scheduled task not found or already removed.
)

:: 3. Remove Desktop Shortcut
echo [+] Removing Desktop shortcut...
if exist "%PUBLIC%\Desktop\LabSync Student Portal.lnk" (
    del /f /q "%PUBLIC%\Desktop\LabSync Student Portal.lnk" >nul 2>&1
    echo     [OK] Public desktop shortcut removed.
)
if exist "%USERPROFILE%\Desktop\LabSync Student Portal.lnk" (
    del /f /q "%USERPROFILE%\Desktop\LabSync Student Portal.lnk" >nul 2>&1
    echo     [OK] User desktop shortcut removed.
)

:: 4. Remove Target Directory
set "TARGET_DIR=C:\LabSync"
if exist "%TARGET_DIR%" (
    echo [+] Removing directory %TARGET_DIR%...
    rmdir /s /q "%TARGET_DIR%" >nul 2>&1
    echo     [OK] Files removed.
)

echo.
echo =====================================================================
echo [OK] LabSync Agent Uninstalled Cleanly!
echo =====================================================================
echo.
timeout /t 3
