# Kartavya
**Do what must be done.**

Team task management built for Indian businesses — by [Aekam Inc](https://www.aekaminc.com)

---

## Stack
- **Frontend:** React (Vercel)
- **Backend:** FastAPI / Python (Railway)
- **Database:** MongoDB Atlas
- **Auth:** Email/password + JWT
- **Mobile:** Expo + React Native (Android)

## Brand
- Primary: `#0082c6` → `#03a1b6` → `#05b7aa`
- Font: Harabara Mais (brand) + Nunito (UI)
- Sidebar: Dark solid `#050e1a`

## Quick Start (Local)

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your values
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env   # set REACT_APP_BACKEND_URL
yarn start
```

## Deploy
See [docs/DEPLOY.md](docs/DEPLOY.md) for full Railway + Vercel deployment guide.

## Branches
- `main` → live production
- `staging` → Aekam India team review

---
*Kartavya (कर्तव्य) — Sanskrit for "duty" or "that which must be done"*
