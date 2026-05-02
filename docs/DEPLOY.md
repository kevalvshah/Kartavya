# Kartavya — Deployment Guide
by Aekam Inc

## Stack
- Frontend: React → Vercel (`kartavya-kevalvshah.vercel.app` free subdomain)
- Backend: FastAPI → Railway
- Database: MongoDB Atlas
- Android: Expo + React Native (same JWT backend)

## Step 1 — MongoDB Atlas
1. Create free cluster at cloud.mongodb.com
2. Add DB user + whitelist 0.0.0.0/0
3. Copy connection string

## Step 2 — Railway (Backend)
1. railway.app → New Project → Deploy from GitHub
2. Root directory: `backend`
3. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Railway Environment Variables
```
MONGO_URL=mongodb+srv://...
DB_NAME=kartavya
JWT_SECRET=<64-char-random-hex>
CORS_ORIGINS=https://kartavya-kevalvshah.vercel.app
COOKIE_SECURE=true
VAPID_SUBJECT=mailto:admin@aekaminc.com
```

## Step 3 — Vercel (Frontend)
1. vercel.com → New Project → Import kevalvshah/taskapp
2. Root directory: `frontend`
3. Framework: Create React App

### Vercel Environment Variables
```
REACT_APP_BACKEND_URL=https://your-app.up.railway.app
```

Vercel gives you a free URL like:
```
https://kartavya-kevalvshah.vercel.app
```

## Step 4 — Update CORS
Once you have your Vercel URL, update Railway:
```
CORS_ORIGINS=https://kartavya-kevalvshah.vercel.app
```

## Step 5 — Wire auth into server.py
```python
from auth_router import router as auth_router, require_user
from health import router as health_router
app.include_router(auth_router)
app.include_router(health_router)
# Replace all get_current_user deps with: Depends(require_user)
```

## Generate JWT Secret
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Branch Strategy
- `main` → live (Vercel auto-deploy)
- `staging` → staging preview (Vercel preview URL for Aekam India review)

## Future: Custom Domain
When ready to go live on aekaminc.com:
```
CNAME  kartavya  →  cname.vercel-dns.com
```
Then add `kartavya.aekaminc.com` in Vercel → Settings → Domains.
