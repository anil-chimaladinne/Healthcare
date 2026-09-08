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

# Startup / Lifespan handler
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema and seed demo records
    init_db()
    yield


app = FastAPI(
    title="SevaHealth API",
    description="Offline-First Smart Healthcare for Rural India - SIH 2026 Hackathon Prototype",
    version="1.0.0",
    lifespan=lifespan
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

    # Serve specific HTML routes and root
    @app.get("/", include_in_schema=False)
    def read_root():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/index.html", include_in_schema=False)
    def read_index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/login.html", include_in_schema=False)
    def read_login():
        return FileResponse(FRONTEND_DIR / "login.html")

    @app.get("/dashboard.html", include_in_schema=False)
    def read_dashboard():
        return FileResponse(FRONTEND_DIR / "dashboard.html")

    @app.get("/patient.html", include_in_schema=False)
    def read_patient():
        return FileResponse(FRONTEND_DIR / "patient.html")

    @app.get("/doctor.html", include_in_schema=False)
    def read_doctor():
        return FileResponse(FRONTEND_DIR / "doctor.html")

    @app.get("/referrals.html", include_in_schema=False)
    def read_referrals():
        return FileResponse(FRONTEND_DIR / "referrals.html")

    @app.get("/followups.html", include_in_schema=False)
    def read_followups():
        return FileResponse(FRONTEND_DIR / "followups.html")

    @app.get("/manifest.json", include_in_schema=False)
    def read_manifest():
        return FileResponse(FRONTEND_DIR / "manifest.json", media_type="application/manifest+json")

    @app.get("/service-worker.js", include_in_schema=False)
    def read_sw():
        return FileResponse(FRONTEND_DIR / "service-worker.js", media_type="application/javascript")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
