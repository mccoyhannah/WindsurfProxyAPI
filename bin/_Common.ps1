param()

$ErrorActionPreference = "Stop"

function Get-WpaRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

function Ensure-WpaApp {
    $root = Get-WpaRoot
    $app = Join-Path $root "app"
    $dist = Join-Path $app "dist\index.js"
    $configPath = Join-Path $root "config\config.yaml"
    Push-Location $app
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $app "node_modules"))) {
            npm install
        }
        if (-not (Test-Path -LiteralPath $dist)) {
            npm run build
        }
        if (-not (Test-Path -LiteralPath $configPath)) {
            node "dist\setup.js" | Out-Host
        }
    }
    finally {
        Pop-Location
    }
}

function Get-WpaConfig {
    $root = Get-WpaRoot
    $app = Join-Path $root "app"
    Push-Location $app
    try {
        # Internal service scripts need real keys; direct print-config output stays redacted by default.
        $json = node "dist\print-config.js" "--include-secrets"
        return $json | ConvertFrom-Json
    }
    finally {
        Pop-Location
    }
}

function Get-WpaManagementPassword {
    $root = Get-WpaRoot
    $path = Join-Path $root "data\admin-credentials.txt"
    if (-not (Test-Path -LiteralPath $path)) { return "" }
    $line = Get-Content -LiteralPath $path | Where-Object { $_ -like "management_password=*" } | Select-Object -First 1
    if (-not $line) { return "" }
    return $line.Substring("management_password=".Length)
}

function Test-WpaListener {
    param([string]$HostAddress, [int]$Port)
    $conn = Get-NetTCPConnection -LocalAddress $HostAddress -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $conn
}

function Wait-WpaListener {
    param([string]$HostAddress, [int]$Port, [int]$Seconds = 30)
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-WpaListener -HostAddress $HostAddress -Port $Port) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Get-WpaListenerProcess {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
        if ($proc) {
            [pscustomobject]@{
                Pid = [int]$proc.ProcessId
                Name = $proc.Name
                CommandLine = $proc.CommandLine
                LocalAddress = $conn.LocalAddress
                LocalPort = $conn.LocalPort
            }
        }
    }
}

function Get-WpaLanguageServerProcess {
    $root = (Get-WpaRoot).ToLowerInvariant()
    Get-CimInstance Win32_Process -Filter "Name='language_server_windows_x64.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($root) } |
        ForEach-Object {
            [pscustomobject]@{
                Pid = [int]$_.ProcessId
                Name = $_.Name
                CommandLine = $_.CommandLine
            }
        }
}

function Stop-WpaProcessTree {
    param([int]$ProcessId)
    if ($ProcessId -le 0) { return }
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-WpaProcessTree -ProcessId ([int]$child.ProcessId)
    }
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Protect-WpaFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        icacls $Path /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null
    }
    catch {
        Write-Warning "Could not restrict ACL for ${Path}: $($_.Exception.Message)"
    }
}
