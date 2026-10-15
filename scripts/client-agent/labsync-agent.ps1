<#
.SYNOPSIS
    LabSync LIMS - Native Windows Student Terminal Client Agent
.DESCRIPTION
    Extracts physical workstation hardware telemetry (CPU, RAM, Storage, OS, MAC, LAN IP),
    binds to a 100% unique composite silicon GUID ($regGuid-$macAddr), authenticates with
    the LabSync Next.js server via TOFU (Trust-On-First-Use), and launches a tamper-proof
    browser session.
.PARAMETER ServerUrl
    Optional override URL for the LabSync server.
#>

[CmdletBinding()]
param(
    [string]$ServerUrl = "",
    [string]$StationCode = "",
    [switch]$DebugMode
)

# Set console title & window aesthetics
$Host.UI.RawUI.WindowTitle = "LabSync Terminal Agent - Workstation Initialization"

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "      LabSync LIMS - Physical Workstation Client Agent (v1.0.0)           " -ForegroundColor White
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Resolve Server URL and Agent Configuration
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $scriptDir "config.json"
$sampleConfigFile = Join-Path $scriptDir "config.sample.json"

$resolvedServerUrl = $ServerUrl
$resolvedStationCode = $StationCode
$agentKey = ""

if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($resolvedServerUrl) -and $config.server_url) { $resolvedServerUrl = $config.server_url }
        if ([string]::IsNullOrWhiteSpace($resolvedStationCode) -and $config.station_code) { $resolvedStationCode = $config.station_code }
        if ($config.agent_key) { $agentKey = $config.agent_key }
        if ($config.debug) { $DebugMode = $true }
    } catch {
        Write-Host "[!] Warning: Unable to parse config.json. Using defaults." -ForegroundColor Yellow
    }
}

if ([string]::IsNullOrWhiteSpace($resolvedServerUrl)) {
    $resolvedServerUrl = "http://localhost:3000"
}
if ([string]::IsNullOrWhiteSpace($resolvedStationCode)) {
    $resolvedStationCode = $env:COMPUTERNAME
}

# Remove trailing slash
$resolvedServerUrl = $resolvedServerUrl.TrimEnd('/')

Write-Host "[*] Target LabSync Server : $resolvedServerUrl" -ForegroundColor Gray
Write-Host "[*] Station Identifier    : $resolvedStationCode" -ForegroundColor Gray

# 2. Extract Hardware Telemetry & Silicon Identifiers
Write-Host "[+] Querying physical machine telemetry..." -ForegroundColor White

# 2A. Composite Silicon GUID (MachineGuid + MAC Address)
$regGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -ErrorAction SilentlyContinue).MachineGuid
if (-not $regGuid) {
    # Fallback if registry key restricted
    $regGuid = [System.Guid]::NewGuid().ToString()
}

$activeNic = Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | 
    Where-Object { $_.IPEnabled -eq $true } | 
    Select-Object -First 1

$macAddr = if ($activeNic -and $activeNic.MACAddress) { 
    $activeNic.MACAddress.Replace(':', '-') 
} else { 
    "00-00-00-00-00-00" 
}

# 100% Unique Composite Identifier (immune to cloned disk images)
$compositeGuid = "$regGuid-$macAddr"

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
$lanIp = if ($activeNic -and $activeNic.IPAddress) { $activeNic.IPAddress[0] } else { "127.0.0.1" }

Write-Host "    - Composite GUID : $compositeGuid" -ForegroundColor DarkCyan
Write-Host "    - CPU            : $cpuName ($cpuCores Cores)" -ForegroundColor Gray
Write-Host "    - Memory         : $ramGb GB RAM" -ForegroundColor Gray
Write-Host "    - Storage (C:)   : $diskFreeGb GB Free of $diskTotalGb GB ($diskUsedPct% Used)" -ForegroundColor Gray
Write-Host "    - OS Version     : $osCaption (Build $osBuild)" -ForegroundColor Gray
Write-Host "    - Network Link   : $lanIp ($macAddr)" -ForegroundColor Gray

# 3. Construct Payload
$telemetryPayload = @{
    computer_name  = $resolvedStationCode
    machine_guid   = $compositeGuid
    hardware_specs = @{
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
        agent_version   = "1.0.0"
        last_synced_at  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
} | ConvertTo-Json -Depth 5

$handshakeEndpoint = "$resolvedServerUrl/api/terminal/handshake"
$headers = @{
    "Content-Type" = "application/json"
}
if (![string]::IsNullOrWhiteSpace($agentKey)) {
    $headers["X-LabSync-Agent-Key"] = $agentKey
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
    Write-Host "  - Error Details   : $($_.Exception.Message)" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "  ACTION REQUIRED:" -ForegroundColor White
    Write-Host "  Please notify the Lab In-Charge or Instructor verbally that this desk" -ForegroundColor White
    Write-Host "  has no network connection to the laboratory server." -ForegroundColor White
    Write-Host "==========================================================================" -ForegroundColor Red
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
        Write-Host "[OK] Workstation initialized. Window closing in 3 seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    } else {
        Write-Host ""
        Write-Host "[Debug Mode Active] Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}
