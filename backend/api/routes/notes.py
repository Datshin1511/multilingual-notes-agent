from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from db.database import get_db
from models.db_models import Notes, Session
from models.schemas import NotesResponse, NotesUpdate

router = APIRouter(prefix="/notes", tags=["Notes"])


@router.get("/{session_id}", response_model=NotesResponse)
def get_notes(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    notes = db.query(Notes).filter(Notes.session_id == session_id).first()
    if not notes:
        raise HTTPException(status_code=404, detail="Notes not found for this session. Has transcription completed?")
    return notes


@router.patch("/{session_id}", response_model=NotesResponse)
def update_notes(session_id: str, payload: NotesUpdate, db: DBSession = Depends(get_db)):
    notes = db.query(Notes).filter(Notes.session_id == session_id).first()
    if not notes:
        raise HTTPException(status_code=404, detail="Notes not found")

    if payload.user_notes is not None:
        notes.user_notes = payload.user_notes
    if payload.bullet_points is not None:
        notes.bullet_points = payload.bullet_points
    if payload.key_topics is not None:
        notes.key_topics = payload.key_topics
    if payload.action_items is not None:
        notes.action_items = payload.action_items

    db.commit()
    db.refresh(notes)
    return notes


@router.post("/{session_id}/regenerate", response_model=NotesResponse)
def regenerate_notes(session_id: str, db: DBSession = Depends(get_db)):
    """Re-run notes generation for a completed session (useful to switch backends)."""
    from models.db_models import Transcript, SessionStatus
    from services.notes_service import generate_notes

    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Session must be completed before regenerating notes")

    transcript = db.query(Transcript).filter(Transcript.session_id == session_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="No transcript found for this session")

    text = transcript.translated_text or transcript.raw_text
    notes_data = generate_notes(text)

    notes = db.query(Notes).filter(Notes.session_id == session_id).first()
    if notes:
        user_notes_backup = notes.user_notes
        notes.summary = notes_data.get("summary")
        notes.bullet_points = notes_data.get("bullet_points", [])
        notes.key_topics = notes_data.get("key_topics", [])
        notes.action_items = notes_data.get("action_items", [])
        notes.important_quotes = notes_data.get("important_quotes", [])
        notes.generation_backend = notes_data.get("generation_backend")
        notes.user_notes = user_notes_backup  # Always preserve user edits
    else:
        notes = Notes(
            session_id=session_id,
            summary=notes_data.get("summary"),
            bullet_points=notes_data.get("bullet_points", []),
            key_topics=notes_data.get("key_topics", []),
            action_items=notes_data.get("action_items", []),
            important_quotes=notes_data.get("important_quotes", []),
            generation_backend=notes_data.get("generation_backend"),
        )
        db.add(notes)

    db.commit()
    db.refresh(notes)
    return notes