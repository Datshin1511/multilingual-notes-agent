from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session as DBSession

from db.database import get_db
from models.db_models import Session, Transcript, Notes, SessionStatus
from models.schemas import ExportRequest

router = APIRouter(prefix="/export", tags=["Export"])


@router.post("/{session_id}/pdf")
def export_pdf(
    session_id: str,
    options: ExportRequest = None,
    db: DBSession = Depends(get_db),
):
    """Generate and return a styled PDF for a session."""
    if options is None:
        options = ExportRequest()

    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != SessionStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Session is not completed yet (status: {session.status}). Wait for processing to finish."
        )

    transcript = db.query(Transcript).filter(Transcript.session_id == session_id).first()
    notes = db.query(Notes).filter(Notes.session_id == session_id).first()

    from services.pdf_service import generate_pdf

    try:
        pdf_bytes = generate_pdf(
            session=session,
            transcript=transcript,
            notes=notes,
            options=options.model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    safe_name = session.name.replace(" ", "_").replace("/", "-")[:60]

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_notes.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )