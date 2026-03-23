"""
PDF export service using WeasyPrint.
Generates a styled PDF from session data (transcript + notes).
"""

import json
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# SAFE COERCIONS
# ─────────────────────────────────────────────

def _as_list(value) -> list:
    """
    Safely coerce a field to a plain Python list.
    Handles: None, already-a-list, JSON string, and any other scalar.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, ValueError):
            return []
    return []


def _as_str(value, fallback: str = "") -> str:
    """Return a string or a safe fallback — never None."""
    if value is None:
        return fallback
    return str(value)


# ─────────────────────────────────────────────
# LANGUAGE CODE → NAME MAP
# ─────────────────────────────────────────────

LANGUAGE_NAMES = {
    "en": "English", "fr": "French", "de": "German", "es": "Spanish",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "ru": "Russian",
    "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "ar": "Arabic",
    "hi": "Hindi", "tr": "Turkish", "pl": "Polish", "sv": "Swedish",
    "da": "Danish", "fi": "Finnish", "no": "Norwegian", "cs": "Czech",
    "ro": "Romanian", "hu": "Hungarian", "uk": "Ukrainian",
}


def _lang_name(code: Optional[str]) -> str:
    if not code:
        return "Unknown"
    return LANGUAGE_NAMES.get(code.lower(), code.upper())


def _format_duration(seconds: Optional[float]) -> str:
    if not seconds:
        return "Unknown"
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    if hours:
        return f"{hours}h {mins}m {secs}s"
    return f"{mins}m {secs}s"


def _tag_html(tags) -> str:
    items = _as_list(tags)
    if not items:
        return '<span class="no-tags">No tags</span>'
    return "".join(f'<span class="tag">{t}</span>' for t in items)


def _bullet_html(items, empty_msg: str = "None") -> str:
    coerced = _as_list(items)
    if not coerced:
        return f'<p class="empty">{empty_msg}</p>'
    return "<ul>" + "".join(f"<li>{item}</li>" for item in coerced) + "</ul>"


def _segment_rows(segments, show_translation: bool) -> str:
    items = _as_list(segments)
    if not items:
        return '<tr><td colspan="3" class="empty">No segments available</td></tr>'
    rows = []
    for seg in items:
        if not isinstance(seg, dict):
            continue
        start = seg.get("start", 0) or 0
        end   = seg.get("end",   0) or 0
        ts    = f"{int(start//60):02d}:{int(start%60):02d} – {int(end//60):02d}:{int(end%60):02d}"
        text  = _as_str(seg.get("text", ""))
        trans = _as_str(seg.get("translated_text", ""))
        if show_translation and trans and trans != text:
            rows.append(f"<tr><td class='ts'>{ts}</td><td>{text}</td><td>{trans}</td></tr>")
        else:
            rows.append(f"<tr><td class='ts'>{ts}</td><td colspan='2'>{text}</td></tr>")
    return "\n".join(rows)


# ─────────────────────────────────────────────
# HTML TEMPLATE
# ─────────────────────────────────────────────

# System-safe font stack — no network request, no crash.
# WeasyPrint will pick up whatever sans-serif the OS has (DejaVu, Liberation, etc.)
_FONT_CSS = """
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif;
  }
"""


def _build_html(session, transcript, notes, options: dict) -> str:
    include_transcript = options.get("include_transcript", True)
    include_translated = options.get("include_translated", True)
    include_notes      = options.get("include_notes", True)
    include_segments   = options.get("include_segments", False)

    export_date = datetime.now().strftime("%B %d, %Y at %H:%M")

    # Safe field reads — never trust ORM fields to be the expected Python type
    detected_lang  = _as_str(getattr(transcript, "detected_language", None), "?")
    target_lang    = _as_str(getattr(session,    "target_language",   None), "?")
    src_lang       = _lang_name(detected_lang)
    tgt_lang       = _lang_name(target_lang)
    duration       = _format_duration(getattr(transcript, "duration_seconds", None) if transcript else None)
    words          = getattr(transcript, "word_count", 0) or 0
    tags_html      = _tag_html(getattr(session, "tags", None))
    audio_filename = _as_str(getattr(session, "audio_filename", None), "N/A")
    description    = _as_str(getattr(session, "description",    None))

    # ── Notes section ─────────────────────────────────────────────────────────
    notes_section = ""
    if include_notes and notes:
        summary      = _as_str(getattr(notes, "summary",          None))
        action_items = _as_list(getattr(notes, "action_items",     None))
        bullet_pts   = _as_list(getattr(notes, "bullet_points",    None))
        key_topics   = _as_list(getattr(notes, "key_topics",       None))
        imp_quotes   = _as_list(getattr(notes, "important_quotes", None))
        user_notes   = _as_str(getattr(notes, "user_notes",       None))

        summary_html = f"<p>{summary}</p>" if summary else '<p class="empty">No summary available.</p>'
        action_html  = _bullet_html(action_items, "No action items identified.")
        bullet_html  = _bullet_html(bullet_pts,   "No key points extracted.")
        topics_html  = "".join(f'<span class="topic-chip">{t}</span>' for t in key_topics)
        quotes_html  = "".join(
            f'<blockquote>{q}</blockquote>' for q in imp_quotes
        ) or '<p class="empty">No notable quotes.</p>'
        user_notes_html = f"<p>{user_notes}</p>" if user_notes else ""

        notes_section = f"""
        <div class="section notes-section">
            <h2><span class="section-icon">📝</span> Notes</h2>
            <div class="subsection">
                <h3>Summary</h3>
                {summary_html}
            </div>
            <div class="subsection">
                <h3>Key Points</h3>
                {bullet_html}
            </div>
            <div class="subsection">
                <h3>Key Topics</h3>
                <div class="topics-row">{topics_html if topics_html else '<p class="empty">None</p>'}</div>
            </div>
            <div class="subsection">
                <h3>Action Items</h3>
                {action_html}
            </div>
            <div class="subsection">
                <h3>Notable Quotes</h3>
                {quotes_html}
            </div>
            {f'<div class="subsection"><h3>Personal Notes</h3>{user_notes_html}</div>' if user_notes_html else ''}
        </div>
        """

    # ── Transcript section ────────────────────────────────────────────────────
    transcript_section = ""
    if include_transcript and transcript:
        raw_text        = _as_str(getattr(transcript, "raw_text",        None))
        translated_text = _as_str(getattr(transcript, "translated_text", None))
        segments        = getattr(transcript, "segments", None)

        trans_block = ""
        if include_translated and translated_text and translated_text != raw_text:
            trans_block = f"""
            <div class="subsection">
                <h3>Translated Transcript <span class="lang-badge">{tgt_lang}</span></h3>
                <p class="transcript-text">{translated_text}</p>
            </div>
            """

        segments_block = ""
        if include_segments and segments:
            has_trans    = bool(translated_text and translated_text != raw_text)
            header_cols  = "<th>Timestamp</th><th>Original</th>" + ("<th>Translation</th>" if has_trans else "")
            segments_block = f"""
            <div class="subsection">
                <h3>Segments</h3>
                <table class="segments-table">
                    <thead><tr>{header_cols}</tr></thead>
                    <tbody>{_segment_rows(segments, has_trans)}</tbody>
                </table>
            </div>
            """

        transcript_section = f"""
        <div class="section transcript-section">
            <h2><span class="section-icon">🎙️</span> Transcript</h2>
            <div class="subsection">
                <h3>Original <span class="lang-badge">{src_lang}</span></h3>
                <p class="transcript-text">{raw_text if raw_text else '<span class="empty">No transcript text available.</span>'}</p>
            </div>
            {trans_block}
            {segments_block}
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  :root {{
    --primary: #6C63FF;
    --primary-light: #EEF0FF;
    --accent: #FF6584;
    --dark: #1A1A2E;
    --mid: #374151;
    --light: #6B7280;
    --border: #E5E7EB;
    --bg: #F9FAFB;
    --white: #FFFFFF;
    --green: #10B981;
    --amber: #F59E0B;
  }}

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    /* No Google Fonts import — zero network calls from WeasyPrint */
    font-family: -apple-system, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif;
    background: var(--bg);
    color: var(--mid);
    font-size: 10pt;
    line-height: 1.7;
  }}

  /* ── COVER ── */
  .cover {{
    background: linear-gradient(135deg, var(--dark) 0%, #16213E 50%, #0F3460 100%);
    color: white;
    padding: 60px 50px 50px;
    min-height: 200px;
    position: relative;
    overflow: hidden;
  }}
  .cover::before {{
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: rgba(108,99,255,0.15);
  }}
  .cover::after {{
    content: '';
    position: absolute;
    bottom: -80px; left: -40px;
    width: 250px; height: 250px;
    border-radius: 50%;
    background: rgba(255,101,132,0.1);
  }}
  .cover-badge {{
    display: inline-block;
    background: rgba(108,99,255,0.4);
    border: 1px solid rgba(108,99,255,0.6);
    color: #C4C0FF;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 20px;
    margin-bottom: 20px;
  }}
  .cover h1 {{
    font-size: 26pt;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }}
  .cover-meta {{
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-top: 24px;
    position: relative;
    z-index: 1;
  }}
  .meta-item {{
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 8px 16px;
    border-radius: 8px;
  }}
  .meta-item .label {{
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.5);
    display: block;
  }}
  .meta-item .value {{
    font-size: 10pt;
    font-weight: 600;
    color: white;
  }}

  /* ── TAGS ── */
  .tags-row {{
    padding: 16px 50px;
    background: var(--white);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }}
  .tags-label {{
    font-size: 8pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--light);
    margin-right: 4px;
  }}
  .tag {{
    background: var(--primary-light);
    color: var(--primary);
    border: 1px solid rgba(108,99,255,0.25);
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 8.5pt;
    font-weight: 500;
  }}
  .no-tags {{ color: var(--light); font-size: 8.5pt; font-style: italic; }}

  /* ── CONTENT ── */
  .content {{ padding: 30px 50px 50px; }}

  .section {{
    background: var(--white);
    border-radius: 12px;
    border: 1px solid var(--border);
    margin-bottom: 28px;
    overflow: hidden;
    page-break-inside: avoid;
  }}
  .section h2 {{
    font-size: 13pt;
    font-weight: 700;
    color: var(--dark);
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
  }}
  .section-icon {{ font-size: 14pt; }}
  .subsection {{
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
  }}
  .subsection:last-child {{ border-bottom: none; }}
  .subsection h3 {{
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--light);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .lang-badge {{
    background: var(--primary-light);
    color: var(--primary);
    font-size: 7.5pt;
    padding: 1px 8px;
    border-radius: 20px;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }}

  p {{ margin: 0; color: var(--mid); }}
  .empty {{ color: var(--light); font-style: italic; font-size: 9pt; }}

  ul {{ padding-left: 20px; }}
  ul li {{
    margin-bottom: 6px;
    color: var(--mid);
    line-height: 1.6;
  }}
  ul li::marker {{ color: var(--primary); }}

  blockquote {{
    border-left: 3px solid var(--primary);
    padding: 8px 16px;
    margin: 8px 0;
    background: var(--primary-light);
    border-radius: 0 8px 8px 0;
    font-style: italic;
    color: var(--dark);
    font-size: 9.5pt;
  }}

  .topics-row {{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }}
  .topic-chip {{
    background: linear-gradient(135deg, var(--primary-light), #F0EDFF);
    color: var(--primary);
    border: 1px solid rgba(108,99,255,0.2);
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 8.5pt;
    font-weight: 500;
  }}

  .transcript-text {{
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    line-height: 1.9;
    font-size: 9.5pt;
    color: var(--mid);
  }}

  /* ── SEGMENTS TABLE ── */
  .segments-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }}
  .segments-table th {{
    background: var(--bg);
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    color: var(--light);
    border-bottom: 1px solid var(--border);
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .segments-table td {{
    padding: 8px 10px;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
  }}
  .segments-table tr:last-child td {{ border-bottom: none; }}
  .segments-table tr:nth-child(even) td {{ background: var(--bg); }}
  .ts {{ color: var(--primary); font-weight: 600; white-space: nowrap; font-size: 8pt; }}

  /* ── FOOTER ── */
  .footer {{
    text-align: center;
    padding: 20px 50px;
    font-size: 8pt;
    color: var(--light);
    border-top: 1px solid var(--border);
  }}
  .footer strong {{ color: var(--primary); }}

  @page {{
    margin: 0;
    size: A4;
  }}
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-badge">🎙 Multilingual Notes Agent</div>
  <h1>{session.name}</h1>
  {f'<p style="color:rgba(255,255,255,0.65);margin-top:8px;position:relative;z-index:1">{description}</p>' if description else ''}
  <div class="cover-meta">
    <div class="meta-item">
      <span class="label">Source Language</span>
      <span class="value">{src_lang}</span>
    </div>
    <div class="meta-item">
      <span class="label">Target Language</span>
      <span class="value">{tgt_lang}</span>
    </div>
    <div class="meta-item">
      <span class="label">Duration</span>
      <span class="value">{duration}</span>
    </div>
    <div class="meta-item">
      <span class="label">Word Count</span>
      <span class="value">{words:,}</span>
    </div>
    <div class="meta-item">
      <span class="label">Exported</span>
      <span class="value">{export_date}</span>
    </div>
  </div>
</div>

<!-- TAGS -->
<div class="tags-row">
  <span class="tags-label">Tags</span>
  {tags_html}
</div>

<!-- MAIN CONTENT -->
<div class="content">
  {notes_section}
  {transcript_section}
</div>

<!-- FOOTER -->
<div class="footer">
  Generated by <strong>Multilingual Notes Agent</strong> · {export_date} · {audio_filename}
</div>

</body>
</html>"""


# ─────────────────────────────────────────────
# MAIN EXPORT FUNCTION
# ─────────────────────────────────────────────

def generate_pdf(session, transcript, notes, options: dict = None) -> bytes:
    """
    Generate a PDF from session data.

    Args:
        session:    Session ORM object
        transcript: Transcript ORM object (or None)
        notes:      Notes ORM object (or None)
        options:    ExportRequest dict

    Returns:
        PDF as bytes
    """
    from weasyprint import HTML

    if options is None:
        options = {}

    html_content = _build_html(session, transcript, notes, options)

    try:
        # presentational_hints=True lets WeasyPrint honour basic HTML attributes
        pdf_bytes = HTML(string=html_content).write_pdf(presentational_hints=True)
        logger.info("PDF generated for session %s — %d bytes", session.id, len(pdf_bytes))
        return pdf_bytes
    except Exception as e:
        logger.exception("WeasyPrint render failed for session %s", session.id)
        raise