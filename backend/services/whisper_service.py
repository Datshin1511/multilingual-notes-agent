"""
Whisper transcription service using faster-whisper.
Handles model loading (singleton), transcription, and segment extraction.
"""

import os
import logging
from typing import Optional, Tuple, List, Dict, Any
from config import settings

logger = logging.getLogger(__name__)

# Singleton model instance — loaded once on first use
_whisper_model = None
_loaded_model_size: Optional[str] = None


def get_whisper_model(model_size: Optional[str] = None):
    """
    Returns a cached faster-whisper model. Reloads only if model_size changes.
    Thread-safe enough for single-worker FastAPI. For multi-worker, use model server.
    """
    global _whisper_model, _loaded_model_size

    target_size = model_size or settings.WHISPER_MODEL_SIZE

    if _whisper_model is None or _loaded_model_size != target_size:
        from faster_whisper import WhisperModel

        logger.info(f"Loading Whisper model: {target_size} | device: {settings.WHISPER_DEVICE} | compute: {settings.WHISPER_COMPUTE_TYPE}")

        _whisper_model = WhisperModel(
            target_size,
            device=settings.WHISPER_DEVICE,
            compute_type=settings.WHISPER_COMPUTE_TYPE,
        )
        _loaded_model_size = target_size
        logger.info(f"Whisper model '{target_size}' loaded successfully.")

    return _whisper_model


def transcribe_audio(
    audio_path: str,
    model_size: Optional[str] = None,
    language: Optional[str] = None,  # Force language; None = auto-detect
    task: str = "transcribe",         # "transcribe" or "translate" (translate→English only)
) -> Dict[str, Any]:
    """
    Transcribes an audio file using faster-whisper.

    Returns:
        {
            "raw_text": str,
            "detected_language": str,
            "detected_language_probability": float,
            "segments": List[{id, start, end, text}],
            "word_count": int,
            "duration_seconds": float,
        }
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = get_whisper_model(model_size)

    logger.info(f"Starting transcription: {audio_path} | lang={language or 'auto'}")

    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        task=task,
        beam_size=5,
        vad_filter=True,                  # Voice activity detection — skips silence
        vad_parameters=dict(
            min_silence_duration_ms=500,
        ),
        word_timestamps=False,            # Disable for speed; enable if word-level needed
    )

    segments: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []
    total_duration = 0.0

    for seg in segments_iter:
        segment_data = {
            "id": seg.id,
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
            "translated_text": None,  # Filled later by translate service
        }
        segments.append(segment_data)
        full_text_parts.append(seg.text.strip())
        total_duration = max(total_duration, seg.end)

    raw_text = " ".join(full_text_parts)
    word_count = len(raw_text.split())

    result = {
        "raw_text": raw_text,
        "detected_language": info.language,
        "detected_language_probability": round(info.language_probability, 4),
        "segments": segments,
        "word_count": word_count,
        "duration_seconds": round(info.duration if hasattr(info, "duration") else total_duration, 2),
    }

    logger.info(
        f"Transcription complete. Language: {info.language} "
        f"({info.language_probability:.1%}), Words: {word_count}, Segments: {len(segments)}"
    )

    return result