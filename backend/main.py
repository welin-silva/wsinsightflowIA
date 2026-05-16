import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.api import router

# ── Allowed origins ────────────────────────────────────────────────────────────
# In production set ALLOWED_ORIGINS="https://your-app.vercel.app" in env vars.
# Multiple origins: comma-separated "https://a.vercel.app,https://custom.domain"
_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
_env_origins  = os.getenv("ALLOWED_ORIGINS", "")
_prod_origins = [o.strip() for o in _env_origins.split(",") if o.strip()]
ALLOWED_ORIGINS = _prod_origins if _prod_origins else _DEV_ORIGINS

app = FastAPI(
    title="InsightFlow AI",
    version="1.0.0",
    # Hide internal detail in production error responses
    docs_url=None if os.getenv("ENV") == "production" else "/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "online", "service": "InsightFlow AI"}
