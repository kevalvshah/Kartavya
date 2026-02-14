<#
TaskFlow deploy helper (Windows 11)

Works best when run from inside the repo root:
  PS> .\scripts\deploy_windows.ps1

Or specify a directory:
  PS> .\scripts\deploy_windows.ps1 -AppDir "C:\apps\taskflow"

What it does:
- Creates backend venv if missing, installs requirements
- Installs frontend deps and builds production assets
- Copies .env.example -> .env if missing (does not overwrite)

NOTE: Making it public typically requires a reverse proxy + HTTPS.
Recommended on Windows: Caddy.
#>

param(
  [string]$AppDir = (Get-Location).Path
)

function Require-Cmd($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Error "Missing required command: $name"
    exit 1
  }
}

Require-Cmd git
Require-Cmd python
Require-Cmd node
Require-Cmd yarn

if (!(Test-Path "$AppDir\backend\server.py") -or !(Test-Path "$AppDir\frontend\package.json")) {
  Write-Error "APP_DIR does not look like TaskFlow repo: $AppDir (expected backend\server.py and frontend\package.json)"
  exit 1
}

# Env files (do not overwrite)
if (!(Test-Path "$AppDir\backend\.env") -and (Test-Path "$AppDir\backend\.env.example")) {
  Copy-Item "$AppDir\backend\.env.example" "$AppDir\backend\.env"
  Write-Host "Created backend\.env from .env.example. Please edit it for your environment."
}

if (!(Test-Path "$AppDir\frontend\.env") -and (Test-Path "$AppDir\frontend\.env.example")) {
  Copy-Item "$AppDir\frontend\.env.example" "$AppDir\frontend\.env"
  Write-Host "Created frontend\.env from .env.example. Please edit it for your environment."
}

# Backend
Write-Host "Deploying backend…"
Push-Location "$AppDir\backend"
if (!(Test-Path ".venv")) {
  python -m venv .venv
}
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Pop-Location

# Frontend
Write-Host "Deploying frontend…"
Push-Location "$AppDir\frontend"
yarn install
yarn build
Pop-Location

Write-Host "Done."
Write-Host "Next: run backend (uvicorn) and serve frontend/build via a reverse proxy (Caddy recommended) with /api -> 127.0.0.1:8001."
