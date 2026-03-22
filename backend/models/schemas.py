from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from models.db_models import SessionStatus


# ─────────────────────────────────────────────
# SESSION SCHEMAS
# ─────────────────────────────────────────────

class SessionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    model_size: str = Field(default="small", pattern="^(tiny|base|small|medium|large-v2|large-v3)$")
    target_language: str = Field(default="en", min_length=2, max_length=10)
    tags: List[str] = Field(default_factory=list)


class SessionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    target_language: Optional[str] = Field(None, min_length=2, max_length=10)
    tags: Optional[List[str]] = None
    user_notes: Optional[str] = None  # Passed through to Notes table


class SessionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    model_size: str
    source_language: Optional[str]
    target_language: str
    status: str
    error_message: Optional[str]
    audio_filename: Optional[str]
    audio_duration_seconds: Optional[float]
    tags: List[str]
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]
    total: int


# ─────────────────────────────────────────────
# TRANSCRIPT SCHEMAS
# ─────────────────────────────────────────────

class SegmentSchema(BaseModel):
    id: int
    start: float
    end: float
    text: str
    translated_text: Optional[str] = None


class TranscriptResponse(BaseModel):
    id: str
    session_id: str
    raw_text: Optional[str]
    detected_language: Optional[str]
    detected_language_probability: Optional[float]
    translated_text: Optional[str]
    translation_model_used: Optional[str]
    segments: List[Dict[str, Any]]
    word_count: Optional[int]
    duration_seconds: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# NOTES SCHEMAS
# ─────────────────────────────────────────────

class NotesResponse(BaseModel):
    id: str
    session_id: str
    summary: Optional[str]
    bullet_points: List[str]
    key_topics: List[str]
    action_items: List[str]
    important_quotes: List[str]
    user_notes: Optional[str]
    generation_backend: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class NotesUpdate(BaseModel):
    user_notes: Optional[str] = None
    bullet_points: Optional[List[str]] = None
    key_topics: Optional[List[str]] = None
    action_items: Optional[List[str]] = None


# ─────────────────────────────────────────────
# TRANSCRIPTION REQUEST SCHEMA
# ─────────────────────────────────────────────

class TranscriptionStatus(BaseModel):
    session_id: str
    status: str
    message: str
    progress: Optional[int] = None  # 0–100


# ─────────────────────────────────────────────
# LANGUAGE + MODEL METADATA
# ─────────────────────────────────────────────

class SupportedLanguage(BaseModel):
    code: str
    name: str
    native_name: str


class SupportedModel(BaseModel):
    id: str
    name: str
    description: str
    recommended_device: str
    vram_required_gb: Optional[float]


class MetadataResponse(BaseModel):
    languages: List[SupportedLanguage]
    whisper_models: List[SupportedModel]
    translation_backend: str
    notes_backend: str


# ─────────────────────────────────────────────
# EXPORT SCHEMA
# ─────────────────────────────────────────────

class ExportRequest(BaseModel):
    include_transcript: bool = True
    include_translated: bool = True
    include_notes: bool = True
    include_segments: bool = False


# ─────────────────────────────────────────────
# ERROR SCHEMA
# ─────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None