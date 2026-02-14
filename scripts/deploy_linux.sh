#!/usr/bin/env bash
set -euo pipefail

# TaskFlow deploy helper (Linux)
# Works in two modes:
# 1) Run inside an already-cloned repo (recommended)
# 2) Provide --dir and optionally --repo to clone/pull
#
# What it does:
# - Ensures backend venv exists and installs requirements
# - Installs frontend deps and builds production assets
# - Optionally restarts systemd/nginx if present

APP_DIR=""
REPO_URL=""
RESTART_SYSTEMD=0
RESTART_NGINX=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy_linux.sh [options]

Options:
  --dir <path>           App directory (default: current directory)
  --repo <git_url>       If directory is empty, clone this repo into --dir
  --restart-systemd      Restart taskflow-backend systemd service if it exists
  --restart-nginx        Restart nginx if it exists
  -h, --help             Show help

Examples:
  # Run from inside /opt/taskflow:
  cd /opt/taskflow && ./scripts/deploy_linux.sh --restart-systemd --restart-nginx

  # Clone then deploy:
  sudo mkdir -p /opt/taskflow && sudo chown -R $USER:$USER /opt/taskflow
  ./scripts/deploy_linux.sh --dir /opt/taskflow --repo https://github.com/<org>/<repo>.git
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      APP_DIR="$2"; shift 2;;
    --repo)
      REPO_URL="$2"; shift 2;;
    --restart-systemd)
      RESTART_SYSTEMD=1; shift;;
    --restart-nginx)
      RESTART_NGINX=1; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1"; usage; exit 1;;
  esac
done

if [[ -z "$APP_DIR" ]]; then
  APP_DIR="$(pwd)"
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

need_cmd git
need_cmd python3
need_cmd node
need_cmd yarn

mkdir -p "$APP_DIR"

# Clone/pull if needed
if [[ -n "$REPO_URL" ]]; then
  if [[ ! -d "$APP_DIR/.git" ]]; then
    echo "Cloning repo into $APP_DIR …"
    git clone "$REPO_URL" "$APP_DIR"
  else
    echo "Repo already present. Pulling latest…"
    (cd "$APP_DIR" && git pull)
  fi
fi

# Validate structure
if [[ ! -f "$APP_DIR/backend/server.py" || ! -f "$APP_DIR/frontend/package.json" ]]; then
  echo "ERROR: APP_DIR does not look like TaskFlow repo: $APP_DIR"
  echo "Expected: backend/server.py and frontend/package.json"
  exit 1
fi

# Env files (do not overwrite)
if [[ ! -f "$APP_DIR/backend/.env" ]]; then
  if [[ -f "$APP_DIR/backend/.env.example" ]]; then
    cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
    echo "Created backend/.env from .env.example. Please edit it before production.";
  else
    echo "WARNING: backend/.env missing and no .env.example found.";
  fi
fi

if [[ ! -f "$APP_DIR/frontend/.env" ]]; then
  if [[ -f "$APP_DIR/frontend/.env.example" ]]; then
    cp "$APP_DIR/frontend/.env.example" "$APP_DIR/frontend/.env"
    echo "Created frontend/.env from .env.example. Please edit it before production.";
  else
    echo "WARNING: frontend/.env missing and no .env.example found.";
  fi
fi

# Backend
echo "Deploying backend…"
(
  cd "$APP_DIR/backend"
  if [[ ! -d ".venv" ]]; then
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
)

# Frontend
echo "Deploying frontend…"
(
  cd "$APP_DIR/frontend"
  yarn install
  yarn build
)

# Restarts
if [[ $RESTART_SYSTEMD -eq 1 ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-units --type=service 2>/dev/null | grep -q "taskflow-backend.service"; then
      echo "Restarting systemd service taskflow-backend…"
      sudo systemctl restart taskflow-backend
    else
      echo "NOTE: taskflow-backend systemd service not found; skipping."
    fi
  else
    echo "NOTE: systemctl not available on this host; skipping systemd restart."
  fi
fi

if [[ $RESTART_NGINX -eq 1 ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-units --type=service 2>/dev/null | grep -q "nginx.service"; then
      echo "Restarting nginx…"
      sudo systemctl restart nginx
    else
      echo "NOTE: nginx service not found; skipping."
    fi
  else
    echo "NOTE: systemctl not available on this host; skipping nginx restart."
  fi
fi

echo "Done."
echo "Next: ensure backend is running (systemd/uvicorn) and reverse proxy routes /api to :8001."
