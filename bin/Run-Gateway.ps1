. "$PSScriptRoot\_Common.ps1"

$root = Get-WpaRoot
$app = Join-Path $root "app"
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
$env:NODE_ENV = "production"
Set-Location $app
node "dist\index.js"
