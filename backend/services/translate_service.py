"""
Translation service.
Backends:
  - helsinki : HuggingFace Helsinki-NLP/opus-mt models (local, free, offline)
  - libretranslate : Self-hosted LibreTranslate REST API

Helsinki models are downloaded on first use (~300MB per language pair).
Models are cached in HuggingFace's default cache directory.
"""

import logging
import httpx
from typing import Optional, List, Dict, Any
from config import settings

logger = logging.getLogger(__name__)

# ── Helsinki model cache: {"en-fr": (tokenizer, model)} ──
_helsinki_cache: Dict[str, Any] = {}

# Supported language codes for Helsinki-NLP routing
# Helsinki uses opus-mt-{src}-{tgt} naming, but some pairs are grouped.
# This map handles common groupings.
HELSINKI_GROUP_MAP = {
    # Multi-language source packs
    "zh": "zh",   # Chinese (simplified)
    "ar": "ar",
    "hi": "hi",
    "ja": "jap",
    "ko": "ko",
}


def _get_helsinki_model(src_lang: str, tgt_lang: str):
    """Load or retrieve a cached Helsinki-NLP translation model."""
    from transformers import MarianMTModel, MarianTokenizer

    key = f"{src_lang}-{tgt_lang}"

    if key not in _helsinki_cache:
        # Resolve grouped language codes
        src = HELSINKI_GROUP_MAP.get(src_lang, src_lang)
        tgt = HELSINKI_GROUP_MAP.get(tgt_lang, tgt_lang)
        model_name = f"Helsinki-NLP/opus-mt-{src}-{tgt}"

        logger.info(f"Loading Helsinki translation model: {model_name}")
        try:
            tokenizer = MarianTokenizer.from_pretrained(model_name)
            model = MarianMTModel.from_pretrained(model_name)
            _helsinki_cache[key] = (tokenizer, model, model_name)
            logger.info(f"Translation model loaded: {model_name}")
        except Exception as e:
            # Try reverse direction or multilingual fallback
            logger.warning(f"Model {model_name} not found. Trying multilingual fallback.")
            fallback = f"Helsinki-NLP/opus-mt-mul-en"
            tokenizer = MarianTokenizer.from_pretrained(fallback)
            model = MarianMTModel.from_pretrained(fallback)
            _helsinki_cache[key] = (tokenizer, model, fallback)
            logger.info(f"Loaded fallback model: {fallback}")

    return _helsinki_cache[key]


def _translate_helsinki(text: str, src_lang: str, tgt_lang: str) -> str:
    """Translate text using a local Helsinki-NLP Marian MT model."""
    if not text.strip():
        return text

    tokenizer, model, model_name = _get_helsinki_model(src_lang, tgt_lang)

    # Split into chunks to respect max token length (Helsinki models: 512 tokens)
    sentences = _split_into_chunks(text, max_chars=1000)
    translated_parts = []

    for chunk in sentences:
        inputs = tokenizer(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512)
        translated_tokens = model.generate(**inputs)
        translated_chunk = tokenizer.decode(translated_tokens[0], skip_special_tokens=True)
        translated_parts.append(translated_chunk)

    return " ".join(translated_parts)


def _translate_libretranslate(text: str, src_lang: str, tgt_lang: str) -> str:
    """Translate text via a LibreTranslate REST API endpoint."""
    if not text.strip():
        return text

    url = f"{settings.LIBRETRANSLATE_URL}/translate"
    payload = {
        "q": text,
        "source": src_lang,
        "target": tgt_lang,
        "format": "text",
    }
    if settings.LIBRETRANSLATE_API_KEY:
        payload["api_key"] = settings.LIBRETRANSLATE_API_KEY

    response = httpx.post(url, json=payload, timeout=60.0)
    response.raise_for_status()
    return response.json().get("translatedText", text)


def _split_into_chunks(text: str, max_chars: int = 1000) -> List[str]:
    """Split long text into chunks at sentence boundaries."""
    if len(text) <= max_chars:
        return [text]

    chunks = []
    current = []
    current_len = 0

    for sentence in text.replace("। ", ". ").split(". "):
        sentence = sentence.strip()
        if not sentence:
            continue
        if current_len + len(sentence) > max_chars and current:
            chunks.append(". ".join(current) + ".")
            current = [sentence]
            current_len = len(sentence)
        else:
            current.append(sentence)
            current_len += len(sentence)

    if current:
        chunks.append(". ".join(current))

    return chunks


def translate_text(
    text: str,
    src_lang: str,
    tgt_lang: str,
    backend: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main translation entry point.

    Returns:
        {
            "translated_text": str,
            "model_used": str,
            "src_lang": str,
            "tgt_lang": str,
        }
    """
    if not text or not text.strip():
        return {"translated_text": "", "model_used": "none", "src_lang": src_lang, "tgt_lang": tgt_lang}

    # If source == target, skip translation
    if src_lang.lower() == tgt_lang.lower():
        return {"translated_text": text, "model_used": "passthrough", "src_lang": src_lang, "tgt_lang": tgt_lang}

    active_backend = backend or settings.TRANSLATION_BACKEND

    logger.info(f"Translating {src_lang} → {tgt_lang} using backend: {active_backend}")

    try:
        if active_backend == "helsinki":
            translated = _translate_helsinki(text, src_lang, tgt_lang)
            model_used = f"Helsinki-NLP/opus-mt-{src_lang}-{tgt_lang}"
        elif active_backend == "libretranslate":
            translated = _translate_libretranslate(text, src_lang, tgt_lang)
            model_used = f"LibreTranslate ({settings.LIBRETRANSLATE_URL})"
        else:
            raise ValueError(f"Unknown translation backend: {active_backend}")

        return {
            "translated_text": translated,
            "model_used": model_used,
            "src_lang": src_lang,
            "tgt_lang": tgt_lang,
        }

    except Exception as e:
        logger.error(f"Translation failed: {e}")
        raise


def translate_segments(
    segments: List[Dict[str, Any]],
    src_lang: str,
    tgt_lang: str,
) -> List[Dict[str, Any]]:
    """Translate each segment's text and add translated_text field."""
    if src_lang.lower() == tgt_lang.lower():
        for seg in segments:
            seg["translated_text"] = seg["text"]
        return segments

    for seg in segments:
        try:
            result = translate_text(seg["text"], src_lang, tgt_lang)
            seg["translated_text"] = result["translated_text"]
        except Exception as e:
            logger.warning(f"Segment translation failed (id={seg.get('id')}): {e}")
            seg["translated_text"] = seg["text"]

    return segments