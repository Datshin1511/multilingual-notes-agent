"""
PDF export service using WeasyPrint.
Generates a styled PDF from session data (transcript + notes).
"""

import logging
import os
from datetime import datetime
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)


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


def _lang_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code.lower(), code.upper())


def _format_duration(seconds: Optional[float]) -> str:
    if not seconds:
        return "Unknown"
    mins, secs = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    if hours:
        return f"{hours}h {mins}m {secs}s"
    return f"{mins}m {secs}s"


def _tag_html(tags: list) -> str:
    if not tags:
        return '<span class="no-tags">No tags</span>'
    return "".join(f'<span class="tag">{t}</span>' for t in tags)


def _bullet_html(items: list, empty_msg: str = "None") -> str:
    if not items:
        return f'<p class="empty">{empty_msg}</p>'
    return "<ul>" + "".join(f"<li>{item}</li>" for item in items) + "</ul>"


def _segment_rows(segments: list, show_translation: bool) -> str:
    if not segments:
        return '<tr><td colspan="3" class="empty">No segments available</td></tr>'
    rows = []
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        ts = f"{int(start//60):02d}:{int(start%60):02d} – {int(end//60):02d}:{int(end%60):02d}"
        text = seg.get("text", "")
        trans = seg.get("translated_text") or ""
        if show_translation and trans and trans != text:
            rows.append(f"<tr><td class='ts'>{ts}</td><td>{text}</td><td>{trans}</td></tr>")
        else:
            rows.append(f"<tr><td class='ts'>{ts}</td><td colspan='2'>{text}</td></tr>")
    return "\n".join(rows)


# ─────────────────────────────────────────────
# HTML TEMPLATE
# ─────────────────────────────────────────────

def _build_html(session, transcript, notes, options: dict) -> str:
    include_transcript = options.get("include_transcript", True)
    include_translated = options.get("include_translated", True)
    include_notes = options.get("include_notes", True)
    include_segments = options.get("include_segments", False)

    export_date = datetime.now().strftime("%B %d, %Y at %H:%M")
    src_lang = _lang_name(transcript.detected_language or "?") if transcript else "?"
    tgt_lang = _lang_name(session.target_language)
    duration = _format_duration(transcript.duration_seconds if transcript else None)
    words = transcript.word_count if transcript else 0
    tags_html = _tag_html(session.tags or [])

    # Notes section HTML
    notes_section = ""
    if include_notes and notes:
        summary_html = f"<p>{notes.summary}</p>" if notes.summary else '<p class="empty">No summary available.</p>'
        action_html = _bullet_html(notes.action_items or [], "No action items identified.")
        bullet_html = _bullet_html(notes.bullet_points or [], "No key points extracted.")
        topics_html = "".join(f'<span class="topic-chip">{t}</span>' for t in (notes.key_topics or []))
        quotes_html = "".join(
            f'<blockquote>{q}</blockquote>' for q in (notes.important_quotes or [])
        ) or '<p class="empty">No notable quotes.</p>'
        user_notes_html = f"<p>{notes.user_notes}</p>" if notes and notes.user_notes else ""

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

    # Transcript section HTML
    transcript_section = ""
    if include_transcript and transcript:
        raw_text = transcript.raw_text or ""
        translated_text = transcript.translated_text or ""

        trans_block = ""
        if include_translated and translated_text and translated_text != raw_text:
            trans_block = f"""
            <div class="subsection">
                <h3>Translated Transcript <span class="lang-badge">{tgt_lang}</span></h3>
                <p class="transcript-text">{translated_text}</p>
            </div>
            """

        segments_block = ""
        if include_segments and transcript.segments:
            has_trans = bool(translated_text and translated_text != raw_text)
            header_cols = "<th>Timestamp</th><th>Original</th>" + ("<th>Translation</th>" if has_trans else "")
            segments_block = f"""
            <div class="subsection">
                <h3>Segments</h3>
                <table class="segments-table">
                    <thead><tr>{header_cols}</tr></thead>
                    <tbody>{_segment_rows(transcript.segments, has_trans)}</tbody>
                </table>
            </div>
            """

        transcript_section = f"""
        <div class="section transcript-section">
            <h2><span class="section-icon">🎙️</span> Transcript</h2>
            <div class="subsection">
                <h3>Original <span class="lang-badge">{src_lang}</span></h3>
                <p class="transcript-text">{raw_text}</p>
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

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
    font-family: 'Inter', sans-serif;
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
  {f'<p style="color:rgba(255,255,255,0.65);margin-top:8px;position:relative;z-index:1">{session.description}</p>' if session.description else ''}
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
  Generated by <strong>Multilingual Notes Agent</strong> · {export_date} · {session.audio_filename or 'N/A'}
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
        session: Session ORM object
        transcript: Transcript ORM object (or None)
        notes: Notes ORM object (or None)
        options: ExportRequest dict

    Returns:
        PDF as bytes
    """
    from weasyprint import HTML, CSS

    if options is None:
        options = {}

    html_content = _build_html(session, transcript, notes, options)

    try:
        pdf_bytes = HTML(string=html_content).write_pdf()
        logger.info(f"PDF generated for session {session.id}, size: {len(pdf_bytes):,} bytes")
        return pdf_bytes
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise