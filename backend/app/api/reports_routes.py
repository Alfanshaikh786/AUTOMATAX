from fastapi import APIRouter, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.models.automaton import AutomatonModel
from app.services.report_service import generate_pdf_report

router = APIRouter(prefix="/api/reports", tags=["Reports"])

class ReportRequest(BaseModel):
    automaton: AutomatonModel
    title: Optional[str] = "AutomataX Academic Verification Report"
    conversion_summary: Optional[str] = ""
    test_results: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = ""

@router.post("/pdf")
def api_generate_pdf(req: ReportRequest):
    pdf_bytes = generate_pdf_report(
        automaton=req.automaton,
        title=req.title or "AutomataX Academic Verification Report",
        conversion_summary=req.conversion_summary or "",
        test_results=req.test_results,
        notes=req.notes or ""
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={req.automaton.name}_report.pdf"}
    )
