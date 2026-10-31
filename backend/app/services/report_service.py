import io
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.automaton import AutomatonModel

def generate_pdf_report(
    automaton: AutomatonModel,
    title: str = "AutomataX Academic Verification Report",
    conversion_summary: str = "",
    test_results: List[Dict[str, Any]] = None,
    notes: str = ""
) -> bytes:
    """
    Generates a professional academic PDF report for the automaton.
    Contains formal 5-tuple definition, transition table, conversion steps, and simulation verification.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=10
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0284c7"),
        spaceBefore=14,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['BodyText'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    elements = []

    # Title & Metadata
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"<b>Automaton:</b> {automaton.name} | <b>Type:</b> {automaton.type.value} | <b>ID:</b> {automaton.id}", body_style))
    if automaton.description:
        elements.append(Paragraph(f"<b>Description:</b> {automaton.description}", body_style))
    elements.append(Spacer(1, 12))

    # Formal 5-tuple Definition
    elements.append(Paragraph("1. Formal Mathematical Specification M = (Q, Σ, δ, q₀, F)", h2_style))
    spec_data = [
        ["Component", "Symbol", "Set Definition"],
        ["States", "Q", f"{{{', '.join(automaton.states) or '∅'}}}"],
        ["Alphabet", "Σ", f"{{{', '.join(automaton.alphabet) or '∅'}}}"],
        ["Initial State", "q₀", automaton.initial_state or "None"],
        ["Accepting States", "F", f"{{{', '.join(automaton.accepting_states) or '∅'}}}"],
        ["Automaton Class", "-", automaton.type.value]
    ]
    t_spec = Table(spec_data, colWidths=[110, 50, 360])
    t_spec.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_spec)
    elements.append(Spacer(1, 14))

    # Transition Table
    elements.append(Paragraph("2. Transition Function Table δ", h2_style))
    # Header: State | symbol 1 | symbol 2 ... | ε (if ENFA)
    headers = ["State (Q)"] + list(automaton.alphabet)
    if automaton.type.value == "ENFA":
        headers.append("ε")

    table_data = [headers]
    for s in automaton.states:
        row = [f"{'→' if s == automaton.initial_state else ''}{'*' if s in automaton.accepting_states else ''} {s}"]
        for sym in automaton.alphabet:
            dests = automaton.transitions.get(s, {}).get(sym, [])
            row.append(", ".join(dests) if dests else "∅")
        if automaton.type.value == "ENFA":
            eps_dests = automaton.epsilon_transitions.get(s, [])
            row.append(", ".join(eps_dests) if eps_dests else "∅")
        table_data.append(row)

    col_w = max(40, 520 // len(headers))
    col_widths = [100] + [col_w] * (len(headers) - 1)
    t_trans = Table(table_data, colWidths=col_widths)
    t_trans.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_trans)
    elements.append(Spacer(1, 14))

    # Conversion or Verification Summary if provided
    if conversion_summary:
        elements.append(Paragraph("3. Conversion & Optimization Record", h2_style))
        elements.append(Paragraph(conversion_summary, body_style))
        elements.append(Spacer(1, 12))

    # Test Results if provided
    if test_results:
        elements.append(Paragraph("4. Language Acceptance Test Suite", h2_style))
        test_rows = [["Test String", "Expected Result", "Actual Result", "Status"]]
        for t in test_results:
            passed = t.get("passed", True)
            test_rows.append([
                f"'{t.get('test_string', '')}'" if t.get('test_string') != "" else "ε (empty string)",
                "ACCEPT" if t.get("expected") else "REJECT",
                "ACCEPT" if t.get("actual") else "REJECT",
                "PASS" if passed else "FAIL"
            ])
        t_tests = Table(test_rows, colWidths=[140, 110, 110, 100])
        t_tests.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#334155")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_tests)
        elements.append(Spacer(1, 12))

    if notes:
        elements.append(Paragraph("5. Academic Instructor Notes", h2_style))
        elements.append(Paragraph(notes, body_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
