. "$PSScriptRoot\_Common.ps1"

Ensure-WpaApp
$cfg = Get-WpaConfig
$statePath = Join-Path $cfg.dataDir "state.json"
$pids = New-Object System.Collections.Generic.HashSet[int]

if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    foreach ($name in @("gatewayWrapperPid","poolWrapperPid")) {
        if ($state.$name) { [void]$pids.Add([int]$state.$name) }
    }
}

foreach ($proc in @(Get-WpaListenerProcess -Port ([int]$cfg.port)) + @(Get-WpaListenerProcess -Port ([int]$cfg.pool.port))) {
    if ($proc) { [void]$pids.Add([int]$proc.Pid) }
}
foreach ($proc in @(Get-WpaLanguageServerProcess)) {
    if ($proc) { [void]$pids.Add([int]$proc.Pid) }
}

foreach ($id in $pids) {
    Stop-WpaProcessTree -ProcessId $id
}

if (Test-Path -LiteralPath $statePath) {
    Remove-Item -LiteralPath $statePath -Force
}

Write-Host "Stopped WindsurfProxyAPI-owned processes: $($pids -join ', ')"
