. "$PSScriptRoot\_Common.ps1"

$root = Get-WpaRoot
$taskName = "WindsurfProxyAPI-Startup"
$startScript = Join-Path $root "bin\Start-WindsurfProxyAPI-Logged.ps1"
$pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
if (-not (Test-Path -LiteralPath $pwsh)) {
    $pwsh = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
}

$action = New-ScheduledTaskAction -Execute $pwsh -Argument "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -DelaySeconds 15"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Start local WindsurfProxyAPI gateway/pool after user logon." -Force | Out-Null

$startup = [Environment]::GetFolderPath("Startup")
$oldVbs = Join-Path $startup "Start-WindsurfProxyAPI.vbs"
if (Test-Path -LiteralPath $oldVbs) {
    Remove-Item -LiteralPath $oldVbs -Force
}

Write-Host "Installed scheduled task: $taskName"
Write-Host "Startup wrapper: $startScript"
