"""
Multilingual Notes Agent — FastAPI Backend
"""

import logging
import sys
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.APP_ENV == "production" else logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# APP FACTORY
# ─────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title="Multilingual Notes Agent",
        description="Audio transcription, translation, and structured note generation API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── DATABASE — Create all tables ──
    from db.database import engine, Base
    import models.db_models  # noqa: F401 — registers models with Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified.")

    # ── ROUTES ──
    from api.routes import sessions, transcribe, notes, export, meta

    app.include_router(sessions.router, prefix="/api")
    app.include_router(transcribe.router, prefix="/api")
    app.include_router(notes.router, prefix="/api")
    app.include_router(export.router, prefix="/api")
    app.include_router(meta.router, prefix="/api")

    # ── STATIC FILES (uploaded audio, optional) ──
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # ── HEALTH CHECK ──
    @app.get("/health", tags=["Health"])
    def health():
        return {
            "status": "ok",
            "whisper_model": settings.WHISPER_MODEL_SIZE,
            "translation_backend": settings.TRANSLATION_BACKEND,
            "notes_backend": settings.NOTES_BACKEND,
            "device": settings.WHISPER_DEVICE,
        }

    logger.info(f"App ready | env={settings.APP_ENV} | whisper={settings.WHISPER_MODEL_SIZE} | "
                f"translation={settings.TRANSLATION_BACKEND} | notes={settings.NOTES_BACKEND}")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_ENV == "development",
        log_level="info",
    )