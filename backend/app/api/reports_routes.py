from fastapi import APIRouter, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import re
import urllib.parse
from app.models.automaton import AutomatonModel
from app.services.report_service import (
    generate_pdf_report,
    generate_conversion_pdf_report,
    generate_equivalence_pdf_report
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])

def _make_content_disposition(raw_filename: str) -> str:
    """
    Format a robust, RFC-compliant Content-Disposition header.
    Starlette encodes all HTTP headers strictly using latin-1.
    We provide a sanitized ASCII filename fallback plus an RFC 5987 percent-encoded UTF-8 filename.
    """
    safe_ascii = (
        raw_filename
        .replace('ε', 'eps')
        .replace('Σ', 'Sigma')
        .replace('δ', 'delta')
        .replace('∅', 'empty')
        .replace('→', 'to')
        .replace('⇒', 'to')
    )
    safe_ascii = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', safe_ascii).strip('_')
    if not safe_ascii.lower().endswith('.pdf'):
        safe_ascii += '.pdf'
    if not safe_ascii:
        safe_ascii = "automaton_report.pdf"

    encoded_utf8 = urllib.parse.quote(raw_filename.encode('utf-8'))
    return f'attachment; filename="{safe_ascii}"; filename*=UTF-8\'\'{encoded_utf8}'

class ReportRequest(BaseModel):
    automaton: AutomatonModel
    title: Optional[str] = "AutomataX Academic Verification Report"
    conversion_summary: Optional[str] = ""
    test_results: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = ""

class ConversionReportRequest(BaseModel):
    source_automaton: AutomatonModel
    target_automaton: AutomatonModel
    title: Optional[str] = "AutomataX Conversion Laboratory Report"
    conversion_type: Optional[str] = "NFA_TO_DFA"
    state_mappings: Optional[List[Dict[str, Any]]] = None
    epsilon_closures: Optional[Dict[str, List[str]]] = None
    test_results: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = ""

class EquivalenceReportRequest(BaseModel):
    dfa1: AutomatonModel
    dfa2: AutomatonModel
    title: Optional[str] = "AutomataX DFA Equivalence Verification Report"
    matrix_rows: Optional[List[Dict[str, Any]]] = None
    start_match: Optional[bool] = True
    is_equivalent: Optional[bool] = True
    counterexample: Optional[str] = None
    explanation: Optional[str] = ""
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
    filename = f"{req.automaton.name}_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": _make_content_disposition(filename)}
    )

@router.post("/conversion-pdf")
def api_generate_conversion_pdf(req: ConversionReportRequest):
    pdf_bytes = generate_conversion_pdf_report(
        source_automaton=req.source_automaton,
        target_automaton=req.target_automaton,
        title=req.title or "AutomataX Conversion Laboratory Report",
        conversion_type=req.conversion_type or "NFA_TO_DFA",
        state_mappings=req.state_mappings,
        epsilon_closures=req.epsilon_closures,
        test_results=req.test_results,
        notes=req.notes or ""
    )
    filename = f"{req.source_automaton.name}_to_{req.target_automaton.name}_conversion.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": _make_content_disposition(filename)}
    )

@router.post("/equivalence-pdf")
def api_generate_equivalence_pdf(req: EquivalenceReportRequest):
    pdf_bytes = generate_equivalence_pdf_report(
        dfa1=req.dfa1,
        dfa2=req.dfa2,
        title=req.title or "AutomataX DFA Equivalence Verification Report",
        matrix_rows=req.matrix_rows,
        start_match=req.start_match if req.start_match is not None else True,
        is_equivalent=req.is_equivalent if req.is_equivalent is not None else True,
        counterexample=req.counterexample,
        explanation=req.explanation or "",
        notes=req.notes or ""
    )
    filename = f"{req.dfa1.name}_vs_{req.dfa2.name}_equivalence.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": _make_content_disposition(filename)}
    )
