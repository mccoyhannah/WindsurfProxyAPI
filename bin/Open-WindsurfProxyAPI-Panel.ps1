. "$PSScriptRoot\_Common.ps1"
Ensure-WpaApp
$cfg = Get-WpaConfig
Start-Process "http://$($cfg.host):$($cfg.port)/"
