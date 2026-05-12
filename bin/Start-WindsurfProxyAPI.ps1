. "$PSScriptRoot\_Common.ps1"

$root = Get-WpaRoot
Ensure-WpaApp
$cfg = Get-WpaConfig

Protect-WpaFile -Path $cfg.adminCredentialsPath
New-Item -ItemType Directory -Path $cfg.logDir,$cfg.dataDir -Force | Out-Null

$password = Get-WpaManagementPassword
$poolEnv = @(
    "HOST=$($cfg.pool.host)",
    "PORT=$($cfg.pool.port)",
    "API_KEY=$($cfg.pool.apiKey)",
    "DASHBOARD_PASSWORD=$password",
    "LS_BINARY_PATH=$($cfg.lsBinaryPath)",
    "LS_PORT=42100",
    "LS_DATA_DIR=$(Join-Path $root 'data\pool-ls')",
    "LOG_LEVEL=info",
    "WPA_AUTO_START_DEFAULT_LS=0",
    # Hide model thinking blocks from /v1/messages clients. Claude Code can
    # render late thinking blocks as a stale "Thought for 0s" card.
    "WPA_EXPOSE_THINKING=0"
)
if ($cfg.proxyUrl) {
    $poolEnv += "HTTP_PROXY=$($cfg.proxyUrl)"
    $poolEnv += "HTTPS_PROXY=$($cfg.proxyUrl)"
}
Set-Content -LiteralPath $cfg.poolEnvPath -Value $poolEnv -Encoding UTF8
Protect-WpaFile -Path $cfg.poolEnvPath

$poolStarted = $false
$gatewayStarted = $false
$nodePath = (Get-Command node -ErrorAction Stop).Source

function Start-WpaNodeProcess {
    param(
        [string]$WorkingDirectory,
        [string[]]$Arguments,
        [hashtable]$Environment,
        [string]$StdoutPath,
        [string]$StderrPath
    )

    $saved = @{}
    foreach ($key in $Environment.Keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
        [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], "Process")
    }
    $saved["NODE_TLS_REJECT_UNAUTHORIZED"] = [Environment]::GetEnvironmentVariable("NODE_TLS_REJECT_UNAUTHORIZED", "Process")
    [Environment]::SetEnvironmentVariable("NODE_TLS_REJECT_UNAUTHORIZED", $null, "Process")
    try {
        return Start-Process -FilePath $nodePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -RedirectStandardOutput $StdoutPath -RedirectStandardError $StderrPath -PassThru
    }
    finally {
        foreach ($key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($key, $saved[$key], "Process")
        }
        [Environment]::SetEnvironmentVariable("NODE_TLS_REJECT_UNAUTHORIZED", $saved["NODE_TLS_REJECT_UNAUTHORIZED"], "Process")
    }
}

if (Test-WpaListener -HostAddress $cfg.pool.host -Port ([int]$cfg.pool.port)) {
    Write-Host "WindsurfPoolAPI already listening on $($cfg.pool.host):$($cfg.pool.port)"
    $poolProc = $null
}
else {
    $poolOut = Join-Path $cfg.logDir "pool.out.log"
    $poolErr = Join-Path $cfg.logDir "pool.err.log"
    $poolEnvMap = @{
        HOST = $cfg.pool.host
        PORT = [string]$cfg.pool.port
        API_KEY = $cfg.pool.apiKey
        DASHBOARD_PASSWORD = $password
        LS_BINARY_PATH = $cfg.lsBinaryPath
        LS_PORT = "42100"
        LS_DATA_DIR = (Join-Path $root "data\pool-ls")
        LOG_LEVEL = "info"
        WPA_AUTO_START_DEFAULT_LS = "0"
        WPA_EXPOSE_THINKING = "0"
    }
    if ($cfg.proxyUrl) {
        $poolEnvMap["HTTP_PROXY"] = $cfg.proxyUrl
        $poolEnvMap["HTTPS_PROXY"] = $cfg.proxyUrl
        $poolEnvMap["http_proxy"] = $cfg.proxyUrl
        $poolEnvMap["https_proxy"] = $cfg.proxyUrl
    }
    $poolProc = Start-WpaNodeProcess -WorkingDirectory $cfg.vendorDir -Arguments @("src\index.js") -Environment $poolEnvMap -StdoutPath $poolOut -StderrPath $poolErr
    $poolStarted = $true
    if (-not (Wait-WpaListener -HostAddress $cfg.pool.host -Port ([int]$cfg.pool.port) -Seconds 45)) {
        throw "WindsurfPoolAPI did not start on $($cfg.pool.host):$($cfg.pool.port). Check $poolErr"
    }
}

if (Test-WpaListener -HostAddress $cfg.host -Port ([int]$cfg.port)) {
    Write-Host "Gateway already listening on $($cfg.host):$($cfg.port)"
    $gatewayProc = $null
}
else {
    $gatewayOut = Join-Path $cfg.logDir "gateway.out.log"
    $gatewayErr = Join-Path $cfg.logDir "gateway.err.log"
    $gatewayProc = Start-WpaNodeProcess -WorkingDirectory (Join-Path $root "app") -Arguments @("dist\index.js") -Environment @{ NODE_ENV = "production" } -StdoutPath $gatewayOut -StderrPath $gatewayErr
    $gatewayStarted = $true
    if (-not (Wait-WpaListener -HostAddress $cfg.host -Port ([int]$cfg.port) -Seconds 30)) {
        throw "Gateway did not start on $($cfg.host):$($cfg.port). Check $gatewayErr"
    }
}

$poolListener = Get-WpaListenerProcess -Port ([int]$cfg.pool.port) | Select-Object -First 1
$gatewayListener = Get-WpaListenerProcess -Port ([int]$cfg.port) | Select-Object -First 1

$state = [ordered]@{
    root = $root
    startedAt = (Get-Date).ToString("o")
    poolWrapperPid = if ($poolProc) { $poolProc.Id } elseif ($poolListener) { $poolListener.Pid } else { $null }
    gatewayWrapperPid = if ($gatewayProc) { $gatewayProc.Id } elseif ($gatewayListener) { $gatewayListener.Pid } else { $null }
    poolStarted = $poolStarted
    gatewayStarted = $gatewayStarted
    gatewayUrl = "http://$($cfg.host):$($cfg.port)"
    poolUrl = $cfg.pool.baseUrl
}
$statePath = Join-Path $cfg.dataDir "state.json"
$state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8

Write-Host "WindsurfProxyAPI is ready."
Write-Host "  Gateway:        http://$($cfg.host):$($cfg.port)"
Write-Host "  OpenAI Base:    http://$($cfg.host):$($cfg.port)/v1"
Write-Host "  Pool Dashboard: $($cfg.pool.dashboardUrl)"
Write-Host "  Credentials:    $($cfg.adminCredentialsPath)"
