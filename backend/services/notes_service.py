"""
Notes generation service.
Backends:
  - anthropic : Claude API (fast, accurate, costs money)
  - ollama    : Local LLM via Ollama (free, slower, needs Ollama running)
  - none      : Rule-based extraction (no LLM, always works)

Rule-based is the safe fallback — it extracts sentences with
high keyword density as "key points" and numbers as "action items".
"""

import re
import logging
import httpx
from typing import Dict, Any, List
from config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# PROMPT TEMPLATE
# ─────────────────────────────────────────────

NOTES_PROMPT = """You are an expert note-taker. Analyze the following transcript and produce structured notes.

TRANSCRIPT:
{transcript}

Respond ONLY with a valid JSON object with this exact structure:
{{
  "summary": "2-3 sentence summary of the entire content",
  "bullet_points": ["key point 1", "key point 2", "key point 3", ...],
  "key_topics": ["topic1", "topic2", ...],
  "action_items": ["action item 1", "action item 2", ...],
  "important_quotes": ["quote 1", "quote 2", ...]
}}

Rules:
- bullet_points: 5–10 most important points, each a complete sentence
- key_topics: 3–8 short topic labels (1–3 words each)
- action_items: only include if explicitly mentioned in transcript; else empty list
- important_quotes: verbatim notable quotes from transcript; max 5
- No markdown, no explanation, just the JSON object
"""


# ─────────────────────────────────────────────
# ANTHROPIC BACKEND
# ─────────────────────────────────────────────

def _generate_anthropic(transcript: str) -> Dict[str, Any]:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": NOTES_PROMPT.format(transcript=transcript[:12000])}],
    )

    raw = message.content[0].text
    return _parse_json_response(raw)


# ─────────────────────────────────────────────
# OLLAMA BACKEND
# ─────────────────────────────────────────────

def _generate_ollama(transcript: str) -> Dict[str, Any]:
    prompt = NOTES_PROMPT.format(transcript=transcript[:8000])

    response = httpx.post(
        f"{settings.OLLAMA_URL}/api/generate",
        json={
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        },
        timeout=120.0,
    )
    response.raise_for_status()
    raw = response.json().get("response", "")
    return _parse_json_response(raw)


# ─────────────────────────────────────────────
# RULE-BASED FALLBACK (no LLM)
# ─────────────────────────────────────────────

def _generate_rule_based(transcript: str) -> Dict[str, Any]:
    """
    Extracts structured notes without an LLM.
    Not as smart, but always works and has zero latency cost.
    """
    if not transcript or not transcript.strip():
        return _empty_notes()

    sentences = _split_sentences(transcript)
    words = transcript.lower().split()
    total_words = len(words)

    # ── Summary: first 3 sentences ──
    summary = " ".join(sentences[:3]) if sentences else transcript[:300]

    # ── Bullet points: high-information sentences ──
    scored = []
    for sent in sentences:
        score = _sentence_score(sent, words)
        scored.append((score, sent))
    scored.sort(reverse=True)
    bullet_points = [s for _, s in scored[:8] if len(s.split()) > 5]

    # ── Key topics: most frequent non-stopword nouns ──
    key_topics = _extract_topics(transcript)

    # ── Action items: sentences with action keywords ──
    action_keywords = {"should", "must", "need to", "will", "going to", "plan to",
                       "todo", "action", "follow up", "schedule", "send", "review"}
    action_items = [
        s for s in sentences
        if any(kw in s.lower() for kw in action_keywords) and len(s.split()) > 4
    ][:5]

    # ── Important quotes: sentences with quoted text ──
    quotes = re.findall(r'"([^"]{20,200})"', transcript)
    important_quotes = quotes[:5]

    return {
        "summary": summary,
        "bullet_points": bullet_points[:8],
        "key_topics": key_topics[:8],
        "action_items": action_items,
        "important_quotes": important_quotes,
        "generation_backend": "rule-based",
    }


def _split_sentences(text: str) -> List[str]:
    """Simple sentence splitter."""
    raw = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in raw if len(s.strip()) > 10]


STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "that", "this", "these",
    "those", "it", "its", "i", "we", "you", "he", "she", "they", "them",
    "their", "our", "my", "your", "his", "her", "not", "so", "if", "as",
    "about", "into", "than", "then", "when", "also", "just", "more",
}


def _sentence_score(sentence: str, all_words: List[str]) -> float:
    """Score a sentence by word frequency relative to full transcript."""
    words = [w.lower().strip(".,!?") for w in sentence.split() if w.lower() not in STOPWORDS]
    if not words:
        return 0.0
    freq_sum = sum(all_words.count(w) for w in words)
    return freq_sum / len(words)


def _extract_topics(text: str) -> List[str]:
    """Extract top N frequent non-stopword words as topic labels."""
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    freq: Dict[str, int] = {}
    for w in words:
        if w not in STOPWORDS:
            freq[w] = freq.get(w, 0) + 1
    sorted_words = sorted(freq, key=lambda w: freq[w], reverse=True)
    return sorted_words[:10]


def _parse_json_response(raw: str) -> Dict[str, Any]:
    """Parse JSON from LLM response, stripping markdown fences if present."""
    import json
    clean = re.sub(r"```json|```", "", raw).strip()
    try:
        parsed = json.loads(clean)
        parsed.setdefault("summary", "")
        parsed.setdefault("bullet_points", [])
        parsed.setdefault("key_topics", [])
        parsed.setdefault("action_items", [])
        parsed.setdefault("important_quotes", [])
        return parsed
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON response: {e}\nRaw: {raw[:500]}")
        return _empty_notes()


def _empty_notes() -> Dict[str, Any]:
    return {
        "summary": "",
        "bullet_points": [],
        "key_topics": [],
        "action_items": [],
        "important_quotes": [],
    }


# ─────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────

def generate_notes(transcript: str, backend: str = None) -> Dict[str, Any]:
    """
    Generate structured notes from a transcript.

    Args:
        transcript: Full transcript text (translated or raw)
        backend: Override the NOTES_BACKEND setting

    Returns dict with: summary, bullet_points, key_topics, action_items,
                       important_quotes, generation_backend
    """
    active_backend = backend or settings.NOTES_BACKEND

    if not transcript or not transcript.strip():
        result = _empty_notes()
        result["generation_backend"] = "none"
        return result

    logger.info(f"Generating notes with backend: {active_backend}")

    try:
        if active_backend == "anthropic":
            result = _generate_anthropic(transcript)
            result["generation_backend"] = "anthropic"
        elif active_backend == "ollama":
            result = _generate_ollama(transcript)
            result["generation_backend"] = "ollama"
        else:
            result = _generate_rule_based(transcript)
            result["generation_backend"] = "rule-based"

        return result

    except Exception as e:
        logger.error(f"Notes generation failed with backend '{active_backend}': {e}. Falling back to rule-based.")
        result = _generate_rule_based(transcript)
        result["generation_backend"] = "rule-based-fallback"
        return result