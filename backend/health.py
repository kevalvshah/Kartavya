from fastapi import APIRouter, Request
from datetime import datetime
router = APIRouter(tags=["health"])

@router.get("/api/health")
async def health(request: Request):
    db_ok = False
    try:
        await request.app.state.db.command("ping")
        db_ok = True
    except Exception:
        pass
    return {"status": "ok" if db_ok else "degraded", "db": "connected" if db_ok else "unreachable", "app": "Kartavya", "by": "Aekam Inc", "time": datetime.utcnow().isoformat()}
