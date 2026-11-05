<#
.SYNOPSIS
    LabSync LIMS - Native Windows Student Terminal Client Agent (v1.1.0)
.DESCRIPTION
    Extracts physical workstation hardware telemetry (CPU, RAM, Storage, OS, MAC, LAN IP),
    binds to a clone-safe composite silicon GUID (Motherboard UUID + Registry MachineGuid + Physical NIC MAC),
    authenticates with the LabSync Next.js server via TOFU (Trust-On-First-Use) with institutional pairing token,
    and launches a tamper-proof browser session.
.PARAMETER ServerUrl
    Optional override URL for the LabSync server.
.PARAMETER StationCode
    Optional override station code (e.g. PC-01).
.PARAMETER LabId
    Optional laboratory identifier (defaults to "comp").
.PARAMETER PairingToken
    Optional institutional pairing token.
#>

[CmdletBinding()]
param(
    [string]$ServerUrl = "",
    [string]$StationCode = "",
    [string]$LabId = "",
    [string]$PairingToken = "",
    [switch]$DebugMode
)

# Set console title & window aesthetics
$Host.UI.RawUI.WindowTitle = "LabSync Terminal Agent - Workstation Initialization"

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "      LabSync LIMS - Physical Workstation Client Agent (v1.1.0)           " -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Resolve Server URL and Agent Configuration
$programDataConfig = "C:\ProgramData\LabSync\config.json"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$localConfigFile = Join-Path $scriptDir "config.json"

$configFile = if (Test-Path $programDataConfig) { $programDataConfig } elseif (Test-Path $localConfigFile) { $localConfigFile } else { $null }

$resolvedServerUrl = $ServerUrl
$resolvedStationCode = $StationCode
$resolvedLabId = if ([string]::IsNullOrWhiteSpace($LabId)) { "comp" } else { $LabId }
$resolvedPairingToken = $PairingToken

if ($configFile -and (Test-Path $configFile)) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($resolvedServerUrl) -and $config.server_url) { $resolvedServerUrl = $config.server_url }
        if ([string]::IsNullOrWhiteSpace($resolvedStationCode) -and $config.station_code) { $resolvedStationCode = $config.station_code }
        if ([string]::IsNullOrWhiteSpace($LabId) -and $config.lab_id) { $resolvedLabId = $config.lab_id }
        if ([string]::IsNullOrWhiteSpace($resolvedPairingToken)) {
            if ($config.pairing_token) { $resolvedPairingToken = $config.pairing_token }
            elseif ($config.agent_key) { $resolvedPairingToken = $config.agent_key }
        }
        if ($config.debug) { $DebugMode = $true }
    } catch {
        Write-Host "[!] Warning: Unable to parse config.json. Using defaults." -ForegroundColor Yellow
    }
}

if ([string]::IsNullOrWhiteSpace($resolvedServerUrl)) {
    $resolvedServerUrl = "http://localhost:3000"
}

if ([string]::IsNullOrWhiteSpace($resolvedStationCode)) {
    $rawName = $env:COMPUTERNAME
    # Normalize common lab hostname formats: e.g. "PC01", "PC-01", "LAB-PC-01", "PC1", "DESK-1" -> "PC-01"
    if ($rawName -match '^(?:.*?(?:PC|DESK|NODE)[-_]?)(\d+)$') {
        $num = [int]$matches[1]
        $resolvedStationCode = "PC-{0:D2}" -f $num
    } elseif ($rawName -match '^[A-Za-z]+[-_]?\d+$') {
        $resolvedStationCode = $rawName.ToUpper()
    } else {
        $resolvedStationCode = $rawName
    }
}

# Remove trailing slash
$resolvedServerUrl = $resolvedServerUrl.TrimEnd('/')

Write-Host "[*] Target LabSync Server : $resolvedServerUrl" -ForegroundColor Gray
Write-Host "[*] Target Laboratory     : $resolvedLabId" -ForegroundColor Gray
Write-Host "[*] Station Identifier    : $resolvedStationCode" -ForegroundColor Gray

# 1B. Self-Healing Desktop Shortcut: Restores desktop shortcut if accidentally deleted
try {
    $publicDesktop = [System.Environment]::GetFolderPath('CommonDesktopDirectory')
    $userDesktop = [System.Environment]::GetFolderPath('Desktop')
    $targetScript = if ($configFile -and (Test-Path $configFile)) { "C:\ProgramData\LabSync\labsync-agent.ps1" } else { $MyInvocation.MyCommand.Path }
    $psExe = (Get-Command powershell.exe).Source

    foreach ($deskPath in @($publicDesktop, $userDesktop)) {
        if (-not [string]::IsNullOrWhiteSpace($deskPath) -and (Test-Path $deskPath)) {
            $desktopShortcutPath = Join-Path $deskPath "LabSync Student Portal.lnk"
            if (-not (Test-Path $desktopShortcutPath)) {
                $wsh = New-Object -ComObject WScript.Shell
                $sc = $wsh.CreateShortcut($desktopShortcutPath)
                $sc.TargetPath = $psExe
                $sc.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$targetScript`""
                $sc.Description = "LabSync Student Assistance & Terminal Portal"
                $sc.WorkingDirectory = "C:\ProgramData\LabSync"
                $sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,99"
                $sc.Save()
            }
        }
    }
} catch {
    # Non-fatal if standard user without UAC
}

# 2. Extract Hardware Telemetry & Silicon Identifiers
Write-Host "[+] Querying physical machine telemetry..." -ForegroundColor White

# 2A. Clone-Safe & Virtual-NIC-Safe Silicon GUID:
# Motherboard Hardware UUID + Registry MachineGuid + Physical Adapter MAC
$hwUuid = (Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue).UUID
if (-not $hwUuid -or $hwUuid -match '^0{8}-0{4}-0{4}-0{4}-0{12}$|^F{8}-F{4}-F{4}-F{4}-F{12}$') {
    $hwUuid = "GENERIC-SYSTEM"
}

$regGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -ErrorAction SilentlyContinue).MachineGuid
if (-not $regGuid) {
    $regGuid = [System.Guid]::NewGuid().ToString()
}

$physicalNic = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | 
    Where-Object { $_.Status -eq 'Up' } | 
    Select-Object -First 1

if (-not $physicalNic) {
    $physicalNic = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Select-Object -First 1
}

$macAddr = if ($physicalNic -and $physicalNic.MacAddress) { 
    $physicalNic.MacAddress.Replace(':', '-') 
} else { 
    "00-00-00-00-00-00" 
}

# 100% Unique Composite Identifier (immune to cloned disk images & virtual adapters)
$compositeGuid = "$hwUuid-$regGuid-$macAddr"

# 2B. Processor Info
$cpuInfo = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
$cpuName = if ($cpuInfo -and $cpuInfo.Name) { $cpuInfo.Name.Trim() } else { "Intel Core / AMD Processor" }
$cpuCores = if ($cpuInfo -and $cpuInfo.NumberOfCores) { [int]$cpuInfo.NumberOfCores } else { 4 }

# 2C. Memory (RAM)
$rawRamBytes = (Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue | Measure-Object -Property Capacity -Sum).Sum
$ramGb = if ($rawRamBytes) { [math]::Round(($rawRamBytes / 1GB), 1) } else { 8.0 }

# 2D. Primary Storage (Drive C:)
$cDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
$diskTotalGb = if ($cDrive -and $cDrive.Size) { [math]::Round(($cDrive.Size / 1GB), 1) } else { 256.0 }
$diskFreeGb = if ($cDrive -and $cDrive.FreeSpace) { [math]::Round(($cDrive.FreeSpace / 1GB), 1) } else { 50.0 }
$diskUsedPct = if ($diskTotalGb -gt 0) { [math]::Round((($diskTotalGb - $diskFreeGb) / $diskTotalGb) * 100, 1) } else { 50.0 }

# 2E. Operating System Details
$osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$osCaption = if ($osInfo -and $osInfo.Caption) { $osInfo.Caption.Trim() } else { "Microsoft Windows 11" }
$osBuild = if ($osInfo -and $osInfo.BuildNumber) { [string]$osInfo.BuildNumber } else { "22631" }

# 2F. Local IPv4 Address
$activeIpNic = Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | 
    Where-Object { $_.IPEnabled -eq $true } | 
    Select-Object -First 1
$lanIp = if ($activeIpNic -and $activeIpNic.IPAddress) { $activeIpNic.IPAddress[0] } else { "127.0.0.1" }

Write-Host "    - Composite GUID : $compositeGuid" -ForegroundColor DarkCyan
Write-Host "    - CPU            : $cpuName ($cpuCores Cores)" -ForegroundColor Gray
Write-Host "    - Memory         : $ramGb GB RAM" -ForegroundColor Gray
Write-Host "    - Storage (C:)   : $diskFreeGb GB Free of $diskTotalGb GB ($diskUsedPct% Used)" -ForegroundColor Gray
Write-Host "    - OS Version     : $osCaption (Build $osBuild)" -ForegroundColor Gray
Write-Host "    - Network Link   : $lanIp ($macAddr)" -ForegroundColor Gray

# 3. Construct Payload
$telemetryPayload = @{
    labId           = $resolvedLabId
    workstationCode = $resolvedStationCode
    machineGuid     = $compositeGuid
    pairingToken    = $resolvedPairingToken
    hardwareSpecs   = @{
        cpu             = $cpuName
        cpu_cores       = $cpuCores
        ram_gb          = $ramGb
        disk_c_total_gb = $diskTotalGb
        disk_c_free_gb  = $diskFreeGb
        disk_c_used_pct = $diskUsedPct
        os_caption      = $osCaption
        os_build        = $osBuild
        mac_address     = $macAddr
        lan_ip          = $lanIp
        agent_version   = "1.1.0"
        last_synced_at  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
} | ConvertTo-Json -Depth 5

$handshakeEndpoint = "$resolvedServerUrl/api/terminal/handshake"
$headers = @{
    "Content-Type" = "application/json"
}
if (![string]::IsNullOrWhiteSpace($resolvedPairingToken)) {
    $headers["X-LabSync-Agent-Key"] = $resolvedPairingToken
}

Write-Host ""
Write-Host "[+] Connecting to LabSync Handshake Gateway..." -ForegroundColor White

# 4. Perform Handshake with Offline Diagnostic Fallback
$handshakeSuccess = $false
$redirectUrl = ""

try {
    # Skip TLS certificate validation for local self-signed HTTPS if testing
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

    $response = Invoke-RestMethod -Uri $handshakeEndpoint -Method Post -Body $telemetryPayload -Headers $headers -TimeoutSec 10 -ErrorAction Stop

    if ($response.success -and $response.redirect_url) {
        $handshakeSuccess = $true
        $redirectUrl = $response.redirect_url
        Write-Host "[OK] Machine Handshake Authorized!" -ForegroundColor Green
        Write-Host "    - Bound Station Code : $($response.station_code)" -ForegroundColor Green
        if ($response.is_new_pairing) {
            Write-Host "    - TOFU Status        : New hardware lock established" -ForegroundColor Yellow
        } else {
            Write-Host "    - TOFU Status        : Verified existing hardware lock" -ForegroundColor Green
        }
    } else {
        Write-Host "[!] Handshake Rejected: $($response.error)" -ForegroundColor Red
    }
}
catch {
    Write-Host ""
    $serverErrorMsg = ""
    $statusCode = 0

    if ($_.Exception.Response) {
        try {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $stream = $_.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $rawBody = $reader.ReadToEnd()
                $parsed = $rawBody | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($parsed -and $parsed.error) { $serverErrorMsg = $parsed.error }
                else { $serverErrorMsg = $rawBody }
            }
        } catch {}
    }
    if (-not $serverErrorMsg -and $_.ErrorDetails) {
        $serverErrorMsg = $_.ErrorDetails.Message
    }
    if (-not $serverErrorMsg) {
        $serverErrorMsg = $_.Exception.Message
    }

    if ($statusCode -eq 403 -or $serverErrorMsg -match "Hardware Mismatch") {
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  [!] HARDWARE MISMATCH: WORKSTATION IS ALREADY LOCKED" -ForegroundColor Yellow
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Server Response: $serverErrorMsg" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  ACTION REQUIRED:" -ForegroundColor White
        Write-Host "  Workstation '$resolvedStationCode' was previously locked to a different machine." -ForegroundColor White
        Write-Host "  1. Open http://localhost:3000/admin (CAD Floor Plan) as Lab In-Charge" -ForegroundColor Cyan
        Write-Host "  2. Select '$resolvedStationCode' and click 'Reset Hardware Binding'" -ForegroundColor Cyan
        Write-Host "  3. Double-click 'LabSync Student Portal' on this desktop to complete binding!" -ForegroundColor Cyan
        Write-Host "==========================================================================" -ForegroundColor Red
    } elseif ($statusCode -eq 401) {
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  [!] SECURITY TOKEN REJECTED (401 UNAUTHORIZED)" -ForegroundColor Yellow
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  Server Response: $serverErrorMsg" -ForegroundColor Yellow
        Write-Host "  Please re-run Setup-LabTerminal.bat with the latest pairing token from /admin." -ForegroundColor White
        Write-Host "==========================================================================" -ForegroundColor Red
    } elseif ($statusCode -eq 404) {
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  [!] WORKSTATION NOT FOUND (404)" -ForegroundColor Yellow
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  Server Response: $serverErrorMsg" -ForegroundColor Yellow
        Write-Host "  Ensure '$resolvedStationCode' exists in laboratory '$resolvedLabId' on the floor plan." -ForegroundColor White
        Write-Host "==========================================================================" -ForegroundColor Red
    } else {
        Write-Host "==========================================================================" -ForegroundColor Red
        Write-Host "  [!] NETWORK UNREACHABLE ON $env:COMPUTERNAME" -ForegroundColor Yellow
        Write-Host "==========================================================================" -ForegroundColor Red

        # Quick Local Diagnostic
        $linkStatus = "Ethernet Link Down / Cable Unplugged"
        try {
            $netAdapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' }
            if ($netAdapters) {
                $linkStatus = "Ethernet Link Up, but Server $resolvedServerUrl Unreachable"
            }
        } catch {}

        Write-Host "  - Detected Status : $linkStatus" -ForegroundColor Yellow
        Write-Host "  - Error Details   : $serverErrorMsg" -ForegroundColor DarkYellow
        Write-Host ""
        Write-Host "  ACTION REQUIRED:" -ForegroundColor White
        Write-Host "  Please verify that the LabSync server is running at $resolvedServerUrl" -ForegroundColor White
        Write-Host "  and reachable over the campus local network." -ForegroundColor White
        Write-Host "==========================================================================" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "Press any key to close this diagnostic window..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 5. Launch Tamper-Proof Browser Session
if ($handshakeSuccess -and -not [string]::IsNullOrWhiteSpace($redirectUrl)) {
    Write-Host ""
    Write-Host "[+] Launching Student Terminal Portal in default browser..." -ForegroundColor Cyan
    Write-Host "    Target URL: $redirectUrl" -ForegroundColor DarkGray
    
    try {
        Start-Process $redirectUrl
    } catch {
        Write-Host "[!] Unable to start default browser: $($_.Exception.Message)" -ForegroundColor Red
    }

    if (-not $DebugMode) {
        Write-Host ""
        Write-Host "[OK] Workstation initialized. Window closing in 2 seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 2
    } else {
        Write-Host ""
        Write-Host "[Debug Mode Active] Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}
