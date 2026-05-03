from fastapi import APIRouter
from datetime import datetime
from db import get_pool

router = APIRouter(tags=["health"])

@router.get("/api/health")
async def health():
    db_ok = False
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        db_ok = True
    except Exception:
        pass
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "unreachable",
        "app": "Kartavya",
        "by": "Aekam Inc",
        "time": datetime.utcnow().isoformat()
    }
