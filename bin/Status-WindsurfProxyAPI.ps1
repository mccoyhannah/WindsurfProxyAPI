. "$PSScriptRoot\_Common.ps1"

Ensure-WpaApp
$cfg = Get-WpaConfig

$gateway = @(Get-WpaListenerProcess -Port ([int]$cfg.port))
$pool = @(Get-WpaListenerProcess -Port ([int]$cfg.pool.port))
$ls = @(Get-WpaLanguageServerProcess)

Write-Host "WindsurfProxyAPI status"
Write-Host "  Gateway URL:        http://$($cfg.host):$($cfg.port)"
Write-Host "  OpenAI Base URL:    http://$($cfg.host):$($cfg.port)/v1"
Write-Host "  Pool URL:           $($cfg.pool.baseUrl)"
Write-Host "  Pool Dashboard:     $($cfg.pool.dashboardUrl)"
Write-Host ""
Write-Host "Listeners:"
if ($gateway.Count) {
    $gateway | Format-Table LocalAddress,LocalPort,Pid,Name -AutoSize
} else {
    Write-Host "  Gateway: not listening"
}
if ($pool.Count) {
    $pool | Format-Table LocalAddress,LocalPort,Pid,Name -AutoSize
} else {
    Write-Host "  Pool: not listening"
}
Write-Host ""
Write-Host "Language server processes owned by this install:"
if ($ls.Count) {
    $ls | Format-Table Pid,Name -AutoSize
} else {
    Write-Host "  none"
}
