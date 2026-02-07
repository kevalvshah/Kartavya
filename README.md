# TaskFlow – Notion-Style Task Manager (Teams + Notifications)

TaskFlow is a full-stack app:
- **Frontend:** React (served on port 3000)
- **Backend:** FastAPI (served on port 8001)
- **Database:** MongoDB
- **Auth:** Emergent Google OAuth (redirect-based)
- **Optional:** Browser Push Notifications (Web Push + Service Worker)

> This README explains prerequisites and a practical Linux deployment path.

---

## Features
- Tasks: add/edit/complete/delete
- Categories + priorities
- Due dates **with time**
- Dashboard summary by status
- Views: List + Kanban (drag & drop)
- Teams: owner/admin/member roles, invite members by email (invite becomes active when they log in)
- Assignments: assign to one/many members or whole team
- Notifications:
  - In-app notifications inbox (bell)
  - Assignment + completion notifications
  - Reminders (default: **due − 2 hours**, customizable per task)
  - Optional browser push notifications

---

## Architecture (How it works)

### Frontend
- React SPA routes:
  - `/login`, `/dashboard`, `/tasks`, `/board`, `/teams`, `/settings/categories`, `/settings/notifications`
- All API calls go to:
  - `process.env.REACT_APP_BACKEND_URL + /api/...`

### Backend
- FastAPI app exposes `/api/*` routes.
- Uses **cookie session** (`session_token`) created after Emergent OAuth.
- Background reminder scheduler runs in the backend process.

### Database
- MongoDB stores:
  - `users`, `user_sessions`
  - `tasks`, `categories`
  - `teams`, `team_members`
  - `notifications`, `push_subscriptions`
  - `app_settings` (stores VAPID keys for web push)

> MongoDB is the “source of truth”. The backend reads/writes MongoDB directly.

---

## Local Development (quick)

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** and **Yarn**
- **MongoDB 6+**

### Run
Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# set backend/.env (see below)
uvicorn server:app --host 0.0.0.0 --port 8001
```

Frontend:
```bash
cd frontend
yarn install
# set frontend/.env (see below)
yarn start
```

---

## Deploy on a Linux Server (Production)

### 1) What you need to install (prerequisites)
On Ubuntu/Debian, you typically need:
- **Git**
- **Python 3.10+** + `python3-venv`
- **Node.js 18+** + **Yarn**
- **MongoDB** (local or hosted) OR MongoDB Atlas
- **Nginx** (reverse proxy)
- A process manager:
  - Recommended: **systemd** (native)
  - Alternative: Supervisor / PM2

Example install commands (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install -y git nginx python3 python3-venv python3-pip

# Node 18 (example using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Yarn
sudo npm i -g yarn
```

### 2) Get the code on the server
```bash
cd /opt
sudo git clone <YOUR_REPO_URL> taskflow
sudo chown -R $USER:$USER /opt/taskflow
```

### 3) MongoDB (Database) setup
You have two options:

#### Option A: Use a managed MongoDB (recommended)
- Use **MongoDB Atlas**
- You’ll get a connection string like:
  - `mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority`

#### Option B: Run MongoDB on the same server
Install MongoDB and enable it:
```bash
# (Steps vary by distro; follow MongoDB official docs for your OS)
# Then:
sudo systemctl enable --now mongod
```

### 4) Environment variables (.env)
You must configure both env files.

#### Backend: `backend/.env`
Required:
- `MONGO_URL=...`
Optional:
- `DB_NAME=test_database`
- `CORS_ORIGINS=https://yourdomain.com`
- `VAPID_SUBJECT=mailto:admin@yourdomain.com`

#### Frontend: `frontend/.env`
Required:
- `REACT_APP_BACKEND_URL=https://yourdomain.com`

> Important: Frontend must point to the **public URL** where `/api` is reachable.

### 5) Build the frontend
For production you should build static assets:
```bash
cd /opt/taskflow/frontend
yarn install
yarn build
```
This generates `frontend/build/`.

### 6) Run the backend with systemd
Create `/etc/systemd/system/taskflow-backend.service`:
```ini
[Unit]
Description=TaskFlow Backend (FastAPI)
After=network.target

[Service]
WorkingDirectory=/opt/taskflow/backend
EnvironmentFile=/opt/taskflow/backend/.env
ExecStart=/opt/taskflow/backend/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:
```bash
cd /opt/taskflow/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl daemon-reload
sudo systemctl enable --now taskflow-backend
sudo systemctl status taskflow-backend --no-pager
```

### 7) Make it public (Nginx reverse proxy)
You’ll typically serve:
- React build as static files
- FastAPI as `/api` proxy to `http://127.0.0.1:8001`

Create `/etc/nginx/sites-available/taskflow`:
```nginx
server {
  listen 80;
  server_name yourdomain.com;

  # Frontend (React build)
  root /opt/taskflow/frontend/build;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  # Backend API
  location /api/ {
    proxy_pass http://127.0.0.1:8001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/taskflow
sudo nginx -t
sudo systemctl restart nginx
```

### 8) HTTPS (recommended)
Use Let’s Encrypt:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

> Web Push notifications require HTTPS in most browsers.

---

## Notifications (Web Push) Notes
- The service worker is at `frontend/public/sw.js`.
- The backend stores VAPID keys in MongoDB `app_settings`.
- Users enable push in **Settings → Notifications**.

Limitations:
- Native mobile push (iOS/Android) is not included yet. When you build a mobile app later, we can add device-token endpoints + FCM/APNs.

---

## Troubleshooting

### Auth redirect issues
- Make sure the app is reachable at a single public domain and HTTPS.
- Auth redirect uses `window.location.origin` so it must match your public URL.

### CORS / cookies
- For cookie-based auth across HTTPS, configure:
  - Backend: `allow_credentials=True`
  - `CORS_ORIGINS` should include your domain (not `*` in strict production).

### Checking logs
- Backend:
  - `sudo journalctl -u taskflow-backend -f`
- Nginx:
  - `sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log`

---

## API (high level)
- Auth: `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`
- Teams: `POST /api/teams`, `GET /api/teams`, `GET /api/teams/{team_id}`
- Team members: `POST /api/teams/{team_id}/members`, `PUT /api/teams/{team_id}/members/{member_id}`, `DELETE /api/teams/{team_id}/members/{member_id}`
- Tasks: `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/{task_id}`, `PATCH /api/tasks/{task_id}/toggle`, `PATCH /api/tasks/{task_id}/move`
- Notifications: `GET /api/notifications`, `POST /api/notifications/mark-read`, `POST /api/notifications/process`
- Push: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`

---

## License
Add your license here.
