import io
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models.automaton import AutomatonModel

def _create_styles():
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0284c7"),
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0369a1"),
        spaceBefore=10,
        spaceAfter=4,
        fontName='Helvetica-Bold'
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['BodyText'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )

    cell_style = ParagraphStyle(
        'DocCell',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b")
    )

    cell_bold = ParagraphStyle(
        'DocCellBold',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#0f172a")
    )

    cell_accent = ParagraphStyle(
        'DocCellAccent',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#0284c7")
    )

    cell_mismatch = ParagraphStyle(
        'DocCellMismatch',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#dc2626")
    )

    return {
        'title': title_style,
        'subtitle': subtitle_style,
        'h2': h2_style,
        'body': body_style,
        'cell': cell_style,
        'cell_bold': cell_bold,
        'cell_accent': cell_accent,
        'cell_mismatch': cell_mismatch,
    }


def _make_spec_table(automaton: AutomatonModel, prefix: str = ""):
    spec_data = [
        ["Tuple Component", "Symbol", "Mathematical Set Definition"],
        ["States", f"Q{prefix}", f"{{{', '.join(automaton.states) or '∅'}}}"],
        ["Alphabet", "Σ", f"{{{', '.join(automaton.alphabet) or '∅'}}}"],
        ["Initial State", f"q₀{prefix}", automaton.initial_state or "∅"],
        ["Final / Accepting States", f"F{prefix}", f"{{{', '.join(automaton.accepting_states) or '∅'}}}"],
        ["Automaton Type", "Type", automaton.type.value]
    ]
    t = Table(spec_data, colWidths=[120, 60, 350])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def _make_trans_table(automaton: AutomatonModel, delta_label: str = "δ"):
    headers = [delta_label] + list(automaton.alphabet)
    if automaton.type.value == "ENFA":
        headers.append("ε")

    table_data = [headers]
    for s in automaton.states:
        marker = ""
        if s == automaton.initial_state:
            marker += "→ "
        if s in automaton.accepting_states:
            marker += "* "
        row = [f"{marker}{s}"]
        for sym in automaton.alphabet:
            dests = automaton.transitions.get(s, {}).get(sym, [])
            if dests:
                if len(dests) == 1:
                    row.append(dests[0])
                else:
                    row.append(f"{{{', '.join(dests)}}}")
            else:
                row.append("∅")
        if automaton.type.value == "ENFA":
            eps_dests = automaton.epsilon_transitions.get(s, [])
            row.append(f"{{{', '.join(eps_dests)}}}" if eps_dests else "∅")
        table_data.append(row)

    col_count = len(headers)
    first_col_w = 90
    other_col_w = max(45, (530 - first_col_w) // max(1, col_count - 1))
    col_widths = [first_col_w] + [other_col_w] * (col_count - 1)

    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def generate_pdf_report(
    automaton: AutomatonModel,
    title: str = "AutomataX Academic Verification Report",
    conversion_summary: str = "",
    test_results: List[Dict[str, Any]] = None,
    notes: str = ""
) -> bytes:
    """Standard single-automaton report."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = _create_styles()
    elements = []

    elements.append(Paragraph(title, styles['title']))
    elements.append(Paragraph(f"<b>Automaton:</b> {automaton.name} | <b>Type:</b> {automaton.type.value} | <b>Alphabet:</b> {{{', '.join(automaton.alphabet)}}}", styles['subtitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=10))

    elements.append(Paragraph("1. Formal 5-Tuple Specification", styles['h2']))
    elements.append(_make_spec_table(automaton))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("2. Transition Function Table", styles['h2']))
    elements.append(_make_trans_table(automaton))
    elements.append(Spacer(1, 10))

    if notes:
        elements.append(Paragraph("3. Notes & Observations", styles['h2']))
        elements.append(Paragraph(notes, styles['body']))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def generate_conversion_pdf_report(
    source_automaton: AutomatonModel,
    target_automaton: AutomatonModel,
    title: str = "AutomataX Conversion Laboratory Report",
    conversion_type: str = "NFA_TO_DFA",
    state_mappings: List[Dict[str, Any]] = None,
    epsilon_closures: Dict[str, List[str]] = None,
    test_results: List[Dict[str, Any]] = None,
    notes: str = ""
) -> bytes:
    """
    Generates a full academic PDF report for NFA->DFA, ε-NFA->NFA, and ε-NFA->DFA conversions.
    Contains both 5-tuples, both transition tables, epsilon-closures, subset state mapping derivations,
    and test string verifications without conflicts or overlapping.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = _create_styles()
    elements = []

    type_name_map = {
        'NFA_TO_DFA': 'NFA to DFA Subset Construction',
        'ENFA_TO_NFA': 'ε-NFA to NFA (ε-Elimination)',
        'ENFA_TO_DFA': 'ε-NFA to DFA (Epsilon-Aware Subset Construction)'
    }
    mode_name = type_name_map.get(conversion_type, conversion_type)

    # Document Header
    elements.append(Paragraph(title, styles['title']))
    elements.append(Paragraph(f"Method: <b>{mode_name}</b> | Source: <b>{source_automaton.name}</b> ({source_automaton.type.value}) → Target: <b>{target_automaton.name}</b> ({target_automaton.type.value})", styles['subtitle']))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

    # SECTION 1: SOURCE AUTOMATON
    src_label = "Source ε-NFA" if source_automaton.type.value == "ENFA" else "Source NFA"
    elements.append(Paragraph(f"1. {src_label} Formal Specification M_src = (Q_src, Σ, δ_src, q0_src, F_src)", styles['h2']))
    elements.append(_make_spec_table(source_automaton, prefix="_src"))
    elements.append(Spacer(1, 8))

    elements.append(Paragraph(f"1.1 {src_label} Transition Table δ_src", styles['h2']))
    elements.append(_make_trans_table(source_automaton, delta_label="δ_src"))
    elements.append(Spacer(1, 12))

    # SECTION 2: EPSILON CLOSURES (if applicable)
    if epsilon_closures:
        elements.append(Paragraph("2. Epsilon-Reachability Closures (ε-Closures)", styles['h2']))
        eps_data = [["State (q)", "ε-Closure Set: ε-closure(q)", "Reachability Definition"]]
        for st in source_automaton.states:
            closure_set = epsilon_closures.get(st, [st])
            eps_data.append([
                st,
                f"{{{', '.join(closure_set)}}}",
                f"Set of all states reachable from {st} via zero or more spontaneous ε-transitions"
            ])
        t_eps = Table(eps_data, colWidths=[80, 160, 290])
        t_eps.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4c1d95")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#faf5ff"), colors.white]),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_eps)
        elements.append(Spacer(1, 12))

    # SECTION 3: SUBSET CONSTRUCTION STATE MAPPING & FORMULA DERIVATIONS
    if state_mappings and len(state_mappings) > 0:
        sec_num = "3" if epsilon_closures else "2"
        elements.append(Paragraph(f"{sec_num}. Subset Construction State Mapping & Transitions", styles['h2']))
        map_headers = ["DFA State", "NFA State Subset", "Transition Formula Derivations", "Status"]
        map_data = [map_headers]
        for m in state_mappings:
            label = m.get('label', '')
            subset_str = f"{{{', '.join(m.get('subset', []))}}}"
            derivations = m.get('derivations', '') or m.get('explanation', '')
            is_final = m.get('is_final', False)
            status_text = "Final State (*)" if is_final else "Intermediate State"

            map_data.append([
                Paragraph(f"<b>{label}</b>", styles['cell_bold']),
                Paragraph(subset_str, styles['cell']),
                Paragraph(derivations or "—", styles['cell']),
                Paragraph(status_text, styles['cell_mismatch'] if is_final else styles['cell'])
            ])

        t_map = Table(map_data, colWidths=[70, 130, 250, 80])
        t_map.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f766e")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f0fdfa"), colors.white]),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t_map)
        elements.append(Spacer(1, 12))

    # SECTION 4: RESULTING TARGET AUTOMATON (DFA)
    tgt_sec = "4" if (epsilon_closures and state_mappings) else ("3" if (epsilon_closures or state_mappings) else "2")
    elements.append(Paragraph(f"{tgt_sec}. Resulting Converted Automaton M_tgt = (Q_tgt, Σ, δ_tgt, q0_tgt, F_tgt)", styles['h2']))
    elements.append(_make_spec_table(target_automaton, prefix="_tgt"))
    elements.append(Spacer(1, 8))

    elements.append(Paragraph(f"{tgt_sec}.1 Resulting Complete Transition Table δ_tgt", styles['h2']))
    elements.append(_make_trans_table(target_automaton, delta_label="δ_tgt"))
    elements.append(Spacer(1, 12))

    # SECTION 5: TEST SUITE VERIFICATION
    if test_results and len(test_results) > 0:
        ver_sec = str(int(tgt_sec) + 1)
        elements.append(Paragraph(f"{ver_sec}. Dual Automaton Language Acceptance Verification", styles['h2']))
        test_rows = [["Test String (w)", "Source Automaton", "Resulting Automaton", "Language Equivalence"]]
        for t in test_results:
            w = t.get('string', t.get('test_string', ''))
            str_display = f"'{w}'" if w != "" else "ε (empty string)"
            src_acc = t.get('source_accepted', t.get('nfa_accepted', True))
            tgt_acc = t.get('target_accepted', t.get('dfa_accepted', True))
            matches = src_acc == tgt_acc
            test_rows.append([
                str_display,
                "ACCEPT" if src_acc else "REJECT",
                "ACCEPT" if tgt_acc else "REJECT",
                "PASS (Consistent ✓)" if matches else "FAIL (Mismatch ✗)"
            ])
        t_tests = Table(test_rows, colWidths=[130, 120, 120, 160])
        t_tests.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#334155")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_tests)
        elements.append(Spacer(1, 12))

    if notes:
        elements.append(Paragraph("Laboratory Notes & Formal Proof Remarks", styles['h2']))
        elements.append(Paragraph(notes, styles['body']))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def generate_equivalence_pdf_report(
    dfa1: AutomatonModel,
    dfa2: AutomatonModel,
    title: str = "AutomataX DFA Equivalence Verification Report",
    matrix_rows: List[Dict[str, Any]] = None,
    start_match: bool = True,
    is_equivalent: bool = True,
    counterexample: Optional[str] = None,
    explanation: str = "",
    notes: str = ""
) -> bytes:
    """
    Generates a full academic PDF report for DFA Equivalence.
    Strictly follows the 3-step classroom textbook method:
    Step 1: Initial state & Final state status check
    Step 2: 2D Cartesian cross-product state-pair transition table (with FS/IS classifications)
    Step 3: Equivalence conclusion banner & shortest counterexample.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = _create_styles()
    elements = []

    elements.append(Paragraph(title, styles['title']))
    elements.append(Paragraph(f"Method: <b>State-Pairing Cartesian Cross-Product</b> | Machine 1: <b>{dfa1.name}</b> vs Machine 2: <b>{dfa2.name}</b>", styles['subtitle']))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

    # SECTION 1: SPECIFICATIONS & TABLES FOR BOTH DFAS
    elements.append(Paragraph("1. Machine Specifications Under Comparison", styles['h2']))
    elements.append(Paragraph("<b>DFA 1 5-Tuple Definition:</b>", styles['body']))
    elements.append(_make_spec_table(dfa1, prefix="_1"))
    elements.append(Spacer(1, 6))

    elements.append(Paragraph("<b>DFA 2 5-Tuple Definition:</b>", styles['body']))
    elements.append(_make_spec_table(dfa2, prefix="_2"))
    elements.append(Spacer(1, 10))

    # SECTION 2: STEP 1 - INITIAL STATE STATUS CHECK
    elements.append(Paragraph("2. Step 1: Initial State & Final State Status Check", styles['h2']))
    start1 = dfa1.initial_state
    start2 = dfa2.initial_state
    start1_is_final = start1 in dfa1.accepting_states
    start2_is_final = start2 in dfa2.accepting_states
    type1 = "FS (Final State)" if start1_is_final else "IS (Intermediate / Non-Final State)"
    type2 = "FS (Final State)" if start2_is_final else "IS (Intermediate / Non-Final State)"

    step1_rows = [
        ["Machine", "Initial State (q₀)", "Acceptance Status", "Verification Result"],
        ["DFA 1", start1, type1, "Match ✓" if start_match else "MISMATCH ✗"],
        ["DFA 2", start2, type2, "Match ✓" if start_match else "MISMATCH ✗"]
    ]
    t_step1 = Table(step1_rows, colWidths=[90, 110, 200, 130])
    t_step1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_step1)
    elements.append(Spacer(1, 10))

    # SECTION 3: STEP 2 - 2D CARTESIAN PRODUCT STATE-PAIR TABLE
    elements.append(Paragraph("3. Step 2: State-Pair Transition Table (Cartesian Product Matrix)", styles['h2']))
    combined_alphabet = sorted(list(set(dfa1.alphabet + dfa2.alphabet)))

    if matrix_rows and len(matrix_rows) > 0:
        table_headers = ["State Pair"] + combined_alphabet
        matrix_table_data = [table_headers]

        for r in matrix_rows:
            pair = r.get('pair', ['', ''])
            is_initial = r.get('isInitial', False)
            pair_label = f"{'⇒ ' if is_initial else ''}{pair[0]} {pair[1]}\n({r.get('pairType1', '')} {r.get('pairType2', '')})"
            row_cells = [Paragraph(pair_label.replace('\n', '<br/>'), styles['cell_bold'])]

            trans_map = r.get('transitions', {})
            for sym in combined_alphabet:
                trans = trans_map.get(sym)
                if not trans:
                    row_cells.append(Paragraph("—", styles['cell']))
                    continue
                next_pair = trans.get('nextPair', ['', ''])
                next_t1 = trans.get('nextType1', '')
                next_t2 = trans.get('nextType2', '')
                is_match = trans.get('isMatch', True)
                is_new = trans.get('isNew', False)

                cell_html = f"<b>{next_pair[0]} {next_pair[1]}</b><br/>"
                if not is_match:
                    cell_html += f"<font color='#dc2626'><b>{next_t1} {next_t2} [MISMATCH ✗]</b></font>"
                else:
                    cell_html += f"<font color='#475569'>{next_t1} {next_t2}</font>"
                if is_new and is_match:
                    cell_html += " <font color='#0284c7'>[New]</font>"

                row_cells.append(Paragraph(cell_html, styles['cell']))
            matrix_table_data.append(row_cells)

        first_w = 110
        sym_w = max(60, (530 - first_w) // max(1, len(combined_alphabet)))
        col_widths = [first_w] + [sym_w] * len(combined_alphabet)

        t_matrix = Table(matrix_table_data, colWidths=col_widths)
        t_matrix.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(t_matrix)
        elements.append(Spacer(1, 12))

    # SECTION 4: STEP 3 - FINAL VERDICT
    elements.append(Paragraph("4. Step 3: Final Equivalence Verdict", styles['h2']))
    verdict_text = "Both the DFAs are equivalent to each other." if is_equivalent else "The DFAs are NOT equivalent to each other."
    verdict_color = "#16a34a" if is_equivalent else "#dc2626"
    verdict_bg = "#f0fdf4" if is_equivalent else "#fef2f2"

    v_data = [
        [Paragraph(f"<font color='{verdict_color}' size='12'><b>VERDICT: {verdict_text}</b></font>", styles['cell_bold'])],
        [Paragraph(explanation or "Cartesian product state-pairing evaluation completed.", styles['body'])]
    ]
    if not is_equivalent and counterexample is not None:
        ce_display = f"'{counterexample}'" if counterexample != "" else "ε (empty string)"
        v_data.append([Paragraph(f"<b>Shortest Distinguishing Counterexample String:</b> <font color='#dc2626'><b>{ce_display}</b></font>", styles['cell_bold'])])

    t_verdict = Table(v_data, colWidths=[530])
    t_verdict.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(verdict_bg)),
        ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor(verdict_color)),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t_verdict)

    if notes:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("5. Academic Instructor Notes", styles['h2']))
        elements.append(Paragraph(notes, styles['body']))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
