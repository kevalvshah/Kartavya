# Kartavya startup — patch CORS to always allow Vercel domains
import os

# Build CORS origins list — always includes Vercel + localhost
_origins = [
    "https://kartavya-aekam.vercel.app",
    "https://kartavya-kevalvshah03-6145s-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:8080",
]

# Also add anything from CORS_ORIGINS env var
_env = os.environ.get("CORS_ORIGINS", "")
for _o in _env.split(","):
    _o = _o.strip()
    if _o and _o not in _origins:
        _origins.append(_o)

CORS_ORIGINS = _origins
