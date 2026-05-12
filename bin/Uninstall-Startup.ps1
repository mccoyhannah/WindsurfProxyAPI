$taskName = "WindsurfProxyAPI-Startup"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed scheduled task: $taskName"
} else {
    Write-Host "Scheduled task not found: $taskName"
}

$startup = [Environment]::GetFolderPath("Startup")
$vbs = Join-Path $startup "Start-WindsurfProxyAPI.vbs"
if (Test-Path -LiteralPath $vbs) {
    Remove-Item -LiteralPath $vbs -Force
    Write-Host "Removed legacy startup entry: $vbs"
}
