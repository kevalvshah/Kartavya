# Deployment scripts

## Linux
From repo root:
```bash
chmod +x ./scripts/deploy_linux.sh
./scripts/deploy_linux.sh --restart-systemd --restart-nginx
```

## Windows
From repo root PowerShell:
```powershell
.\scripts\deploy_windows.ps1
```

These scripts:
- Install backend dependencies into `backend/.venv`
- Install frontend dependencies and run `yarn build`
- Do **not** overwrite your `.env` files
