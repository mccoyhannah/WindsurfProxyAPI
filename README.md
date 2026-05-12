# WindsurfProxyAPI

WindsurfProxyAPI is a local Windows wrapper around an OpenAI-compatible gateway
and an inner WindsurfPoolAPI service. It is intended for local learning,
research, and personal use.

The project runs as two local-only services:

- `WindsurfProxyAPI Gateway` on `127.0.0.1:8327`, handling the local API key,
  panel, request counts, and gateway logs.
- `WindsurfPoolAPI` on `127.0.0.1:8328`, handling Windsurf account tokens,
  model routing, cooldowns, and the pool dashboard.

Do not expose these ports to the public internet.

## Install

Clone this repository to a local tools directory. On Windows, a path such as
`D:\Tools\WindsurfProxyAPI` is convenient, but the scripts resolve paths from
their own location and do not require that exact directory.

Requirements:

- Windows PowerShell 5.1 or PowerShell 7
- Node.js 20+
- A local checkout of `guanxiaol/WindsurfPoolAPI` at `vendor/WindsurfPoolAPI`

Prepare the upstream pool checkout:

```powershell
git clone https://github.com/guanxiaol/WindsurfPoolAPI.git vendor\WindsurfPoolAPI
git -C vendor\WindsurfPoolAPI checkout a8d2f4cf0c4c36d021debfe0428ec497660c55e6
git -C vendor\WindsurfPoolAPI apply ..\WindsurfPoolAPI.local.patch
```

Optional local patches are kept under `vendor\*.patch`. Review them before
applying.

## Start

```powershell
.\bin\Start-WindsurfProxyAPI.ps1
.\bin\Status-WindsurfProxyAPI.ps1
.\bin\Open-WindsurfProxyAPI-Panel.ps1
.\bin\Stop-WindsurfProxyAPI.ps1
```

On first start, the gateway installs its Node dependencies, builds the
TypeScript app, and creates local-only files:

- `config\config.yaml`
- `data\admin-credentials.txt`
- `logs\*.log`

The management password and local API key are written to
`data\admin-credentials.txt`. Keep that file private.

## Local URLs

- Gateway panel: `http://127.0.0.1:8327/`
- OpenAI-compatible base URL: `http://127.0.0.1:8327/v1`
- Pool dashboard: `http://127.0.0.1:8328/dashboard`

Example request:

```powershell
$key = "<local_api_key from data\admin-credentials.txt>"
Invoke-RestMethod -Uri "http://127.0.0.1:8327/v1/models" -Headers @{ Authorization = "Bearer $key" }
```

## Startup Task

Install a per-user scheduled task:

```powershell
.\bin\Install-Startup.ps1
```

The task runs `bin\Start-WindsurfProxyAPI-Logged.ps1` after logon and writes
startup logs under `logs\`.

Uninstall it with:

```powershell
.\bin\Uninstall-Startup.ps1
```

If Node.js is not on `PATH`, set `WPA_NODE_DIR` to the directory containing
`node.exe` before installing or running the startup wrapper.

## Repository Layout

- `app\`: outer Node/TypeScript gateway.
- `bin\`: Windows helper scripts.
- `scripts\`: smoke-test scripts for a running local instance.
- `config\config.example.yaml`: safe example configuration.
- `vendor\WindsurfPoolAPI.commit`: upstream commit used for the inner pool.
- `vendor\WindsurfPoolAPI.local.patch`: local loopback binding patch.
- `vendor\WindsurfPoolAPI.ui-overhaul.patch`: optional dashboard UI patch.

The real `vendor\WindsurfPoolAPI` checkout, runtime binaries, logs, local
configuration, credentials, account files, and backup folders are intentionally
ignored by Git.

## Security Notes

- Keep `config\config.yaml`, `data\`, `.env`, `accounts.json`, `proxy.json`,
  `runtime-config.json`, `logs\`, and `usage-backups\` private.
- The inner pool stores Windsurf account tokens. Do not commit or share those
  files.
- Bind services to `127.0.0.1` unless you have reviewed and hardened the whole
  deployment.

## License

This wrapper is released under the MIT License.

The inner pool is based on `guanxiaol/WindsurfPoolAPI`, which is also licensed
under MIT. See the upstream repository for its full license and notices.
