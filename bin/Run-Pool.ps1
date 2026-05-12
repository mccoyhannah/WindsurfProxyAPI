. "$PSScriptRoot\_Common.ps1"

$root = Get-WpaRoot
$cfg = Get-WpaConfig
$password = Get-WpaManagementPassword

Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED -ErrorAction SilentlyContinue
$env:HOST = $cfg.pool.host
$env:PORT = [string]$cfg.pool.port
$env:API_KEY = $cfg.pool.apiKey
$env:DASHBOARD_PASSWORD = $password
$env:LS_BINARY_PATH = $cfg.lsBinaryPath
$env:LS_PORT = "42100"
$env:LS_DATA_DIR = Join-Path $root "data\pool-ls"
$env:LOG_LEVEL = "info"
if ($cfg.proxyUrl) {
    $env:HTTP_PROXY = $cfg.proxyUrl
    $env:HTTPS_PROXY = $cfg.proxyUrl
    $env:http_proxy = $cfg.proxyUrl
    $env:https_proxy = $cfg.proxyUrl
}

Set-Location $cfg.vendorDir
node "src\index.js"
