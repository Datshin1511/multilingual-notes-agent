from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from typing import List, Optional

from db.database import get_db
from models.db_models import Session, Notes
from models.schemas import (
    SessionCreate, SessionUpdate, SessionResponse, SessionListResponse
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, db: DBSession = Depends(get_db)):
    session = Session(
        name=payload.name,
        description=payload.description,
        model_size=payload.model_size,
        target_language=payload.target_language,
        tags=payload.tags,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=SessionListResponse)
def list_sessions(
    skip: int = 0,
    limit: int = 50,
    tag: Optional[str] = None,
    db: DBSession = Depends(get_db),
):
    query = db.query(Session).order_by(Session.created_at.desc())
    all_sessions = query.offset(skip).limit(limit).all()

    # Filter by tag in Python (SQLite JSON query support is limited)
    if tag:
        all_sessions = [s for s in all_sessions if tag in (s.tags or [])]

    return {"sessions": all_sessions, "total": len(all_sessions)}


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(session_id: str, payload: SessionUpdate, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if payload.name is not None:
        session.name = payload.name
    if payload.description is not None:
        session.description = payload.description
    if payload.target_language is not None:
        session.target_language = payload.target_language
    if payload.tags is not None:
        session.tags = payload.tags

    # Update user_notes on the Notes child record
    if payload.user_notes is not None:
        if session.notes:
            session.notes.user_notes = payload.user_notes
        else:
            notes = Notes(session_id=session.id, user_notes=payload.user_notes)
            db.add(notes)

    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Clean up audio file
    import os
    from config import settings
    if session.audio_filename:
        audio_path = os.path.join(settings.UPLOAD_DIR, session_id, session.audio_filename)
        if os.path.exists(audio_path):
            os.remove(audio_path)
        session_dir = os.path.join(settings.UPLOAD_DIR, session_id)
        if os.path.exists(session_dir) and not os.listdir(session_dir):
            os.rmdir(session_dir)

    db.delete(session)
    db.commit()