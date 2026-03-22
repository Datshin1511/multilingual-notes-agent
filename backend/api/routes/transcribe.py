"""
Transcription route.
POST /api/transcribe/{session_id}  — Upload audio + run full pipeline
GET  /api/transcribe/{session_id}  — Get transcription result
"""

import os
import shutil
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session as DBSession

from db.database import get_db
from models.db_models import Session, Transcript, Notes, SessionStatus
from models.schemas import TranscriptResponse, TranscriptionStatus
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcribe", tags=["Transcription"])

ALLOWED_AUDIO_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/mp4", "audio/m4a", "audio/ogg", "audio/webm",
    "audio/flac", "audio/x-flac", "video/mp4",
    "application/octet-stream",  # Fallback for some browsers
}

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".ogg", ".webm", ".flac", ".aac"}


def _validate_audio_file(file: UploadFile):
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )


def _run_pipeline(session_id: str):
    """
    Full processing pipeline — runs in background.
    Steps: save file → transcribe → translate → generate notes → save to DB
    """
    from db.database import SessionLocal
    from services.whisper_service import transcribe_audio
    from services.translate_service import translate_text, translate_segments
    from services.notes_service import generate_notes

    db = SessionLocal()

    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            logger.error(f"Pipeline: session {session_id} not found")
            return

        audio_path = os.path.join(settings.UPLOAD_DIR, session_id, session.audio_filename)

        # ── STEP 1: TRANSCRIBE ──
        session.status = SessionStatus.TRANSCRIBING
        db.commit()

        logger.info(f"[{session_id}] Transcribing with model={session.model_size}")
        transcription = transcribe_audio(audio_path, model_size=session.model_size)

        detected_lang = transcription["detected_language"]
        session.source_language = detected_lang
        db.commit()

        # ── STEP 2: TRANSLATE ──
        session.status = SessionStatus.TRANSLATING
        db.commit()

        translated_text = transcription["raw_text"]
        translated_segments = transcription["segments"]
        translation_model = "passthrough"

        if detected_lang != session.target_language:
            logger.info(f"[{session_id}] Translating {detected_lang} → {session.target_language}")
            trans_result = translate_text(
                transcription["raw_text"],
                src_lang=detected_lang,
                tgt_lang=session.target_language,
            )
            translated_text = trans_result["translated_text"]
            translation_model = trans_result["model_used"]

            translated_segments = translate_segments(
                transcription["segments"],
                src_lang=detected_lang,
                tgt_lang=session.target_language,
            )

        # ── STEP 3: SAVE TRANSCRIPT ──
        existing_transcript = db.query(Transcript).filter(Transcript.session_id == session_id).first()
        if existing_transcript:
            db.delete(existing_transcript)
            db.commit()

        transcript = Transcript(
            session_id=session_id,
            raw_text=transcription["raw_text"],
            detected_language=detected_lang,
            detected_language_probability=transcription["detected_language_probability"],
            translated_text=translated_text,
            translation_model_used=translation_model,
            segments=translated_segments,
            word_count=transcription["word_count"],
            duration_seconds=transcription["duration_seconds"],
        )
        db.add(transcript)
        session.audio_duration_seconds = transcription["duration_seconds"]
        db.commit()

        # ── STEP 4: GENERATE NOTES ──
        session.status = SessionStatus.GENERATING_NOTES
        db.commit()

        text_for_notes = translated_text or transcription["raw_text"]
        notes_data = generate_notes(text_for_notes)

        existing_notes = db.query(Notes).filter(Notes.session_id == session_id).first()
        if existing_notes:
            # Preserve user_notes on re-run
            user_notes = existing_notes.user_notes
            db.delete(existing_notes)
            db.commit()
        else:
            user_notes = None

        notes = Notes(
            session_id=session_id,
            summary=notes_data.get("summary"),
            bullet_points=notes_data.get("bullet_points", []),
            key_topics=notes_data.get("key_topics", []),
            action_items=notes_data.get("action_items", []),
            important_quotes=notes_data.get("important_quotes", []),
            user_notes=user_notes,
            generation_backend=notes_data.get("generation_backend"),
        )
        db.add(notes)

        # ── STEP 5: MARK COMPLETE ──
        session.status = SessionStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"[{session_id}] Pipeline complete.")

    except Exception as e:
        logger.error(f"[{session_id}] Pipeline failed: {e}", exc_info=True)
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.status = SessionStatus.FAILED
            session.error_message = str(e)
            db.commit()
    finally:
        db.close()


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@router.post("/{session_id}", response_model=TranscriptionStatus)
async def upload_and_transcribe(
    session_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
):
    """Upload an audio file and kick off the transcription pipeline."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status in (SessionStatus.TRANSCRIBING, SessionStatus.TRANSLATING, SessionStatus.GENERATING_NOTES):
        raise HTTPException(status_code=409, detail="Session is already being processed")

    _validate_audio_file(file)

    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )

    # Save the audio file
    session_upload_dir = os.path.join(settings.UPLOAD_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "audio.mp3")[-1].lower()
    safe_filename = f"audio{ext}"
    audio_path = os.path.join(session_upload_dir, safe_filename)

    with open(audio_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    session.audio_filename = safe_filename
    session.status = SessionStatus.UPLOADING
    session.error_message = None
    db.commit()

    # Kick off background pipeline
    background_tasks.add_task(_run_pipeline, session_id)

    return TranscriptionStatus(
        session_id=session_id,
        status="processing",
        message="Audio uploaded. Transcription pipeline started.",
        progress=0,
    )


@router.get("/{session_id}", response_model=TranscriptResponse)
def get_transcript(session_id: str, db: DBSession = Depends(get_db)):
    """Retrieve the transcript for a completed session."""
    transcript = db.query(Transcript).filter(Transcript.session_id == session_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found for this session")
    return transcript