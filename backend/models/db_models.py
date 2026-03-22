from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, ForeignKey, JSON, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class SessionStatus(str, enum.Enum):
    CREATED = "created"
    UPLOADING = "uploading"
    TRANSCRIBING = "transcribing"
    TRANSLATING = "translating"
    GENERATING_NOTES = "generating_notes"
    COMPLETED = "completed"
    FAILED = "failed"


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Model + language config
    model_size = Column(String(50), default="small")       # whisper model size
    source_language = Column(String(10), nullable=True)    # auto-detected
    target_language = Column(String(10), nullable=False, default="en")

    # Processing state
    status = Column(String(50), default=SessionStatus.CREATED)
    error_message = Column(Text, nullable=True)

    # Audio file info
    audio_filename = Column(String(500), nullable=True)
    audio_duration_seconds = Column(Float, nullable=True)

    # Tags: stored as JSON list of strings
    tags = Column(JSON, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    transcript = relationship("Transcript", back_populates="session", uselist=False, cascade="all, delete-orphan")
    notes = relationship("Notes", back_populates="session", uselist=False, cascade="all, delete-orphan")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Raw transcription (source language)
    raw_text = Column(Text, nullable=True)
    detected_language = Column(String(10), nullable=True)
    detected_language_probability = Column(Float, nullable=True)

    # Translation (target language)
    translated_text = Column(Text, nullable=True)
    translation_model_used = Column(String(200), nullable=True)

    # Segments: list of {id, start, end, text, translated_text}
    segments = Column(JSON, default=list)

    # Stats
    word_count = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("Session", back_populates="transcript")


class Notes(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Structured notes
    summary = Column(Text, nullable=True)
    bullet_points = Column(JSON, default=list)     # List[str]
    key_topics = Column(JSON, default=list)        # List[str]
    action_items = Column(JSON, default=list)      # List[str]
    important_quotes = Column(JSON, default=list)  # List[str]

    # User-edited notes (free text, editable in UI)
    user_notes = Column(Text, nullable=True)

    # Which backend generated these notes
    generation_backend = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    session = relationship("Session", back_populates="notes")