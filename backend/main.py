"""
SevaHealth - Main FastAPI Application
Entry point for SevaHealth: Offline-First Smart Healthcare for Rural India.
SIH 2026 Student Hackathon Prototype.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import init_db
from backend.schemas import HealthResponse
from backend.routers import (
    auth, dashboard, patients, triage, consultations, referrals, followups, sync, inventory
)

# Initialize SQLite database schema and seed demo records safely
try:
    init_db()
except Exception as e:
    print("Database initialization notice:", e)


app = FastAPI(
    title="SevaHealth API",
    description="Offline-First Smart Healthcare for Rural India - SIH 2026 Hackathon Prototype",
    version="1.0.0"
)

# Enable CORS for local and PWA development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST Routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(patients.router)
app.include_router(triage.router)
app.include_router(consultations.router)
app.include_router(referrals.router)
app.include_router(followups.router)
app.include_router(sync.router)
app.include_router(inventory.router)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Heartbeat endpoint for connectivity checking."""
    return HealthResponse(
        status="ok",
        message="SevaHealth backend is running",
        version="1.0.0-SIH2026"
    )


# Mount frontend static directory
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    # Mount subdirectories explicitly so relative URLs work seamlessly
    if (FRONTEND_DIR / "css").exists():
        app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    if (FRONTEND_DIR / "js").exists():
        app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
    if (FRONTEND_DIR / "icons").exists():
        app.mount("/icons", StaticFiles(directory=FRONTEND_DIR / "icons"), name="icons")
    if (FRONTEND_DIR / "images").exists():
        app.mount("/images", StaticFiles(directory=FRONTEND_DIR / "images"), name="images")

    NO_CACHE_HEADERS = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }

    @app.get("/favicon.ico", include_in_schema=False)
    def read_favicon():
        if (FRONTEND_DIR / "icons" / "favicon.ico").exists():
            return FileResponse(FRONTEND_DIR / "icons" / "favicon.ico")
        return FileResponse(FRONTEND_DIR / "manifest.json")

    # Serve specific HTML routes and root with no-cache headers to prevent mobile stale caching
    @app.get("/", include_in_schema=False)
    def read_root():
        return FileResponse(FRONTEND_DIR / "index.html", headers=NO_CACHE_HEADERS)

    @app.get("/index.html", include_in_schema=False)
    def read_index():
        return FileResponse(FRONTEND_DIR / "index.html", headers=NO_CACHE_HEADERS)

    @app.get("/login.html", include_in_schema=False)
    def read_login():
        return FileResponse(FRONTEND_DIR / "login.html", headers=NO_CACHE_HEADERS)

    @app.get("/dashboard.html", include_in_schema=False)
    def read_dashboard():
        return FileResponse(FRONTEND_DIR / "dashboard.html", headers=NO_CACHE_HEADERS)

    @app.get("/patient.html", include_in_schema=False)
    def read_patient():
        return FileResponse(FRONTEND_DIR / "patient.html", headers=NO_CACHE_HEADERS)

    @app.get("/doctor.html", include_in_schema=False)
    def read_doctor():
        return FileResponse(FRONTEND_DIR / "doctor.html", headers=NO_CACHE_HEADERS)

    @app.get("/specialist.html", include_in_schema=False)
    def read_specialist():
        return FileResponse(FRONTEND_DIR / "specialist.html", headers=NO_CACHE_HEADERS)

    @app.get("/referrals.html", include_in_schema=False)
    def read_referrals():
        return FileResponse(FRONTEND_DIR / "referrals.html", headers=NO_CACHE_HEADERS)

    @app.get("/followups.html", include_in_schema=False)
    def read_followups():
        return FileResponse(FRONTEND_DIR / "followups.html", headers=NO_CACHE_HEADERS)

    @app.get("/manifest.json", include_in_schema=False)
    def read_manifest():
        return FileResponse(FRONTEND_DIR / "manifest.json", media_type="application/manifest+json", headers=NO_CACHE_HEADERS)

    @app.get("/service-worker.js", include_in_schema=False)
    def read_sw():
        return FileResponse(FRONTEND_DIR / "service-worker.js", media_type="application/javascript", headers=NO_CACHE_HEADERS)


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
