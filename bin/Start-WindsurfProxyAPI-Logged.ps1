param(
    [int]$DelaySeconds = 0
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "logs"
$startScript = Join-Path $PSScriptRoot "Start-WindsurfProxyAPI.ps1"
$nodeDir = $env:WPA_NODE_DIR
if ($nodeDir) {
    $nodePath = Join-Path $nodeDir "node.exe"
}
else {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { "" }
    $nodeDir = if ($nodePath) { Split-Path -Parent $nodePath } else { "" }
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logDir "startup-$stamp.log"
$latestLogPath = Join-Path $logDir "startup-latest.log"

function Write-StartupLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"), $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    Add-Content -LiteralPath $latestLogPath -Value $line -Encoding UTF8
}

function Test-Listener {
    param([int]$Port)
    return $null -ne (Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

try {
    Set-Content -LiteralPath $latestLogPath -Value "" -Encoding UTF8
    Write-StartupLog "WindsurfProxyAPI startup wrapper begin. Root=$root DelaySeconds=$DelaySeconds"

    if ($DelaySeconds -gt 0) {
        Write-StartupLog "Sleeping before startup: ${DelaySeconds}s"
        Start-Sleep -Seconds $DelaySeconds
    }

    if (-not (Test-Path -LiteralPath $startScript)) {
        throw "Start script not found: $startScript"
    }
    if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath)) {
        throw "Node executable not found. Install Node.js 20+ or set WPA_NODE_DIR to the directory containing node.exe."
    }

    $env:Path = "$nodeDir;$env:Path"
    $resolvedNode = (Get-Command node -ErrorAction Stop).Source
    Write-StartupLog "Using node: $resolvedNode"
    Write-StartupLog "Invoking: $startScript"

    & $startScript *>> $logPath

    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ((Test-Listener -Port 8327) -and (Test-Listener -Port 8328)) {
            Write-StartupLog "Listeners ready: 127.0.0.1:8327 and 127.0.0.1:8328"
            Write-StartupLog "WindsurfProxyAPI startup wrapper completed successfully."
            exit 0
        }
        Start-Sleep -Seconds 1
    }

    $gatewayReady = Test-Listener -Port 8327
    $poolReady = Test-Listener -Port 8328
    throw "Startup finished but listener check failed. gateway8327=$gatewayReady pool8328=$poolReady"
}
catch {
    Write-StartupLog "ERROR: $($_.Exception.Message)"
    Write-StartupLog "WindsurfProxyAPI startup wrapper failed."
    exit 1
}
