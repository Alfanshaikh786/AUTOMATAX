from typing import List, Dict, Set, Tuple, Optional
from collections import deque
from app.models.automaton import AutomatonModel, DebugReport, DebugIssue, DebugFixAction
from app.core.automaton_types import AutomatonType, IssueSeverity
from app.algorithms.minimization import get_reachable_states, complete_dfa

def get_live_states(aut: AutomatonModel) -> Set[str]:
    """
    Finds states that can reach at least one accepting state (productive/live states).
    Uses backward BFS from accepting states.
    """
    accepting = set(aut.accepting_states)
    if not accepting:
        return set()

    # Build inverse graph
    inv_graph: Dict[str, Set[str]] = {s: set() for s in aut.states}
    for src, sym_map in aut.transitions.items():
        for sym, dests in sym_map.items():
            for d in dests:
                if d in inv_graph:
                    inv_graph[d].add(src)

    for src, dests in aut.epsilon_transitions.items():
        for d in dests:
            if d in inv_graph:
                inv_graph[d].add(src)

    live: Set[str] = set(accepting)
    queue = deque(list(accepting))

    while queue:
        curr = queue.popleft()
        for predecessor in inv_graph.get(curr, set()):
            if predecessor not in live:
                live.add(predecessor)
                queue.append(predecessor)

    return live

def debug_automaton(automaton: AutomatonModel) -> DebugReport:
    """
    Performs comprehensive structural, syntactic, and semantic diagnostics
    on a finite automaton. Returns categorized issues and actionable fixes.
    """
    aut = automaton.canonicalize()
    issues: List[DebugIssue] = []
    issue_counter = 1

    states_set = set(aut.states)
    alpha_set = set(aut.alphabet)

    # 1. Initial state checks
    if not aut.initial_state:
        issues.append(DebugIssue(
            id=f"ISSUE_{issue_counter}",
            severity=IssueSeverity.ERROR,
            code="MISSING_INITIAL_STATE",
            title="Missing Initial State",
            description="The automaton has no initial start state defined.",
            mathematical_rationale="Formal finite automata M = (Q, Σ, δ, q0, F) require exactly one designated start state q0 ∈ Q.",
            affected_states=[],
            suggested_fix=DebugFixAction(
                action_id="SET_INITIAL_STATE",
                title="Set First State as Initial",
                description="Assigns the first available state as the initial start state.",
                patch_type="SET_INITIAL",
                parameters={"state": aut.states[0] if aut.states else "q0"}
            )
        ))
        issue_counter += 1

    # 2. Accepting states check
    if not aut.accepting_states:
        issues.append(DebugIssue(
            id=f"ISSUE_{issue_counter}",
            severity=IssueSeverity.WARNING,
            code="EMPTY_ACCEPTING_SET",
            title="Empty Accepting States Set F = ∅",
            description="No accepting/final states are defined. The automaton accepts the empty language ∅.",
            mathematical_rationale="If F = ∅, no string w ∈ Σ* can ever be accepted because δ*(q0, w) ∩ F = ∅.",
            affected_states=[]
        ))
        issue_counter += 1

    # 3. Reachability analysis
    reachable = get_reachable_states(aut)
    unreachable = states_set - reachable
    for u in sorted(list(unreachable)):
        issues.append(DebugIssue(
            id=f"ISSUE_{issue_counter}",
            severity=IssueSeverity.WARNING,
            code="UNREACHABLE_STATE",
            title=f"Unreachable State '{u}'",
            description=f"State '{u}' cannot be reached from initial state '{aut.initial_state}'.",
            mathematical_rationale=f"There is no sequence of input symbols w ∈ Σ* such that {u} ∈ δ*(q0, w). Unreachable states can be safely purged without altering the language.",
            affected_states=[u],
            suggested_fix=DebugFixAction(
                action_id="PURGE_UNREACHABLE",
                title=f"Remove State '{u}'",
                description=f"Safely removes unreachable state '{u}' and any attached transitions.",
                patch_type="REMOVE_STATE",
                parameters={"state": u}
            )
        ))
        issue_counter += 1

    # 4. Dead / Non-productive states analysis
    live_states = get_live_states(aut)
    dead_states = reachable - live_states
    for d in sorted(list(dead_states)):
        # A dead state is an error/sink state if non-accepting
        issues.append(DebugIssue(
            id=f"ISSUE_{issue_counter}",
            severity=IssueSeverity.SUGGESTION,
            code="DEAD_STATE",
            title=f"Dead State (Sink) '{d}'",
            description=f"Reachable state '{d}' cannot reach any accepting state.",
            mathematical_rationale=f"Once the automaton enters '{d}', it can never transition into any accepting state in F.",
            affected_states=[d]
        ))
        issue_counter += 1

    # 5. DFA specific checks
    if aut.type == AutomatonType.DFA:
        # Check nondeterminism
        for src, sym_map in aut.transitions.items():
            for sym, dests in sym_map.items():
                if len(dests) > 1:
                    issues.append(DebugIssue(
                        id=f"ISSUE_{issue_counter}",
                        severity=IssueSeverity.ERROR,
                        code="DFA_NONDETERMINISM",
                        title=f"Nondeterminism in DFA at State '{src}'",
                        description=f"State '{src}' has multiple destination states {{{', '.join(dests)}}} for symbol '{sym}'.",
                        mathematical_rationale="In a DFA, the transition function δ: Q × Σ → Q must map to at most one deterministic destination.",
                        affected_states=[src] + dests,
                        affected_transitions=[{"from": src, "to": d, "symbol": sym} for d in dests]
                    ))
                    issue_counter += 1

        # Check missing transitions
        missing_count = 0
        missing_trans: List[Dict[str, str]] = []
        for s in aut.states:
            s_map = aut.transitions.get(s, {})
            for sym in aut.alphabet:
                if sym not in s_map or not s_map[sym]:
                    missing_count += 1
                    missing_trans.append({"state": s, "symbol": sym})

        if missing_count > 0:
            issues.append(DebugIssue(
                id=f"ISSUE_{issue_counter}",
                severity=IssueSeverity.WARNING,
                code="INCOMPLETE_DFA",
                title=f"Incomplete DFA ({missing_count} Missing Transition(s))",
                description=f"DFA is missing transitions for some alphabet symbols across states.",
                mathematical_rationale="In standard automata theory, a complete DFA defines a transition for every pair (q, a) ∈ Q × Σ. Unspecified transitions implicitly lead to a rejection sink state.",
                affected_states=sorted(list(set(m["state"] for m in missing_trans))),
                suggested_fix=DebugFixAction(
                    action_id="COMPLETE_DFA_SINK",
                    title="Complete DFA with Dead Sink State",
                    description="Automatically creates a dead sink state and routes all missing transitions to it.",
                    patch_type="COMPLETE_DFA",
                    parameters={}
                )
            ))
            issue_counter += 1

    # 6. Epsilon redundancies in ENFA
    if aut.type == AutomatonType.ENFA:
        for src, dests in aut.epsilon_transitions.items():
            if src in dests:
                issues.append(DebugIssue(
                    id=f"ISSUE_{issue_counter}",
                    severity=IssueSeverity.SUGGESTION,
                    code="REDUNDANT_EPSILON_LOOP",
                    title=f"Redundant Epsilon Self-Loop on '{src}'",
                    description=f"State '{src}' has an ε-transition to itself.",
                    mathematical_rationale="Every state q is trivially in its own ε-closure by definition (reflexivity); self-loop ε-transitions are mathematically redundant.",
                    affected_states=[src],
                    suggested_fix=DebugFixAction(
                        action_id="REMOVE_EPSILON_LOOP",
                        title=f"Remove Epsilon Self-Loop on '{src}'",
                        description=f"Removes redundant self ε-transition on {src}.",
                        patch_type="REMOVE_EPSILON",
                        parameters={"from": src, "to": src}
                    )
                ))
                issue_counter += 1

    error_count = sum(1 for i in issues if i.severity == IssueSeverity.ERROR)
    warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
    suggestion_count = sum(1 for i in issues if i.severity == IssueSeverity.SUGGESTION)

    return DebugReport(
        automaton_id=aut.id,
        automaton_type=aut.type,
        is_valid=(error_count == 0),
        error_count=error_count,
        warning_count=warning_count,
        suggestion_count=suggestion_count,
        issues=issues,
        summary=f"Diagnostics complete: {error_count} error(s), {warning_count} warning(s), {suggestion_count} suggestion(s)."
    )
