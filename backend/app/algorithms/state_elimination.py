from typing import Dict, List, Set, Tuple, Optional, Any
from app.models.automaton import AutomatonModel, ConversionResponse, ConversionStep
from app.core.automaton_types import AutomatonType, ConversionAlgorithm, StepActionType
from app.core.validation import assert_valid_automaton

def simplify_regex_str(expr: str) -> str:
    """Applies algebraic simplifications to regular expression string labels."""
    if not expr or expr == "∅":
        return "∅"
    if expr == "ε":
        return "ε"
    # Basic cleanup
    expr = expr.strip()
    return expr

def regex_concat(r1: str, r2: str) -> str:
    """Combines two regexes with concatenation: r1 · r2."""
    if r1 == "∅" or r2 == "∅":
        return "∅"
    if r1 == "ε":
        return r2
    if r2 == "ε":
        return r1

    # Add parentheses if union is inside
    term1 = f"({r1})" if "|" in r1 and not (r1.startswith("(") and r1.endswith(")")) else r1
    term2 = f"({r2})" if "|" in r2 and not (r2.startswith("(") and r2.endswith(")")) else r2

    return f"{term1}{term2}"

def regex_union(r1: str, r2: str) -> str:
    """Combines two regexes with union: r1 | r2."""
    if r1 == "∅":
        return r2
    if r2 == "∅":
        return r1
    if r1 == r2:
        return r1
    return f"{r1}|{r2}"

def regex_star(r: str) -> str:
    """Applies Kleene star: r*."""
    if r == "∅" or r == "ε":
        return "ε"
    if r.endswith("*") and not "|" in r:
        return r
    if len(r) == 1:
        return f"{r}*"
    if r.startswith("(") and r.endswith(")") and r.count("(") == 1:
        return f"{r}*"
    return f"({r})*"

def convert_automaton_to_regex(automaton: AutomatonModel) -> Dict[str, Any]:
    """
    Converts a DFA, NFA, or ε-NFA to an equivalent regular expression
    using the GNFA (Generalized Nondeterministic Finite Automaton) state elimination method.
    """
    aut = automaton.canonicalize()
    assert_valid_automaton(aut)

    # 1. Setup GNFA States: new start s_init, new final s_final, plus original states
    s_init = "s_init"
    while s_init in aut.states:
        s_init = f"_{s_init}"

    s_final = "s_final"
    while s_final in aut.states or s_final == s_init:
        s_final = f"_{s_final}"

    gnfa_states = [s_init] + list(aut.states) + [s_final]

    # Initialize transition matrix R[i][j] with '∅'
    R: Dict[str, Dict[str, str]] = {u: {v: "∅" for v in gnfa_states} for u in gnfa_states}

    # Populate R with original transitions
    for u in aut.states:
        # Standard transitions
        sym_map = aut.transitions.get(u, {})
        for sym, dests in sym_map.items():
            for v in dests:
                if v in gnfa_states:
                    R[u][v] = regex_union(R[u][v], sym)

        # Epsilon transitions
        if aut.type == AutomatonType.ENFA:
            for v in aut.epsilon_transitions.get(u, []):
                if v in gnfa_states:
                    R[u][v] = regex_union(R[u][v], "ε")

    # Connect new start s_init to original initial state with ε
    R[s_init][aut.initial_state] = "ε"

    # Connect all original accepting states to new final s_final with ε
    for f in aut.accepting_states:
        R[f][s_final] = "ε"

    steps: List[Dict[str, Any]] = []
    step_num = 1

    steps.append({
        "step_number": step_num,
        "action": "INITIALIZE_GNFA",
        "title": "Construct Initial GNFA",
        "description": "Introduced new single start state s_init and single accepting state s_final.",
        "mathematical_explanation": (
            f"1. Added new start state '{s_init}' with an ε-transition to original start '{aut.initial_state}'.\n"
            f"2. Added new accepting state '{s_final}' with ε-transitions from original accepting states: "
            f"{{{', '.join(aut.accepting_states) or '∅'}}}.\n"
            f"3. All original transitions are now represented as regular expression labels."
        ),
        "states_remaining": list(gnfa_states)
    })
    step_num += 1

    # 2. State Elimination Loop
    elimination_order = list(aut.states)
    remaining_states = set(gnfa_states)

    for k in elimination_order:
        remaining_states.remove(k)
        active_list = [s for s in gnfa_states if s in remaining_states]

        updates: List[Dict[str, str]] = []

        R_kk = R[k][k]
        R_kk_star = regex_star(R_kk)

        for i in active_list:
            if i == s_final:
                continue
            R_ik = R[i][k]
            if R_ik == "∅":
                continue

            for j in active_list:
                if j == s_init:
                    continue
                R_kj = R[k][j]
                if R_kj == "∅":
                    continue

                # R_ij = R_ij | (R_ik · (R_kk)* · R_kj)
                bypass = regex_concat(regex_concat(R_ik, R_kk_star), R_kj)
                old_R_ij = R[i][j]
                new_R_ij = regex_union(old_R_ij, bypass)
                R[i][j] = new_R_ij

                updates.append({
                    "from": i,
                    "to": j,
                    "old_label": old_R_ij,
                    "bypass": bypass,
                    "new_label": new_R_ij,
                    "formula": f"R({i},{j}) = {old_R_ij} ∪ ({R_ik})·({R_kk})*·({R_kj}) = {new_R_ij}"
                })

        steps.append({
            "step_number": step_num,
            "action": "ELIMINATE_STATE",
            "eliminated_state": k,
            "title": f"Eliminate State '{k}'",
            "description": f"Rerouted all transitions passing through state '{k}' using GNFA formula.",
            "mathematical_explanation": (
                f"Formula: R_ij ← R_ij ∪ R_ik (R_kk)* R_kj\n"
                f"• Self-loop on {k}: R({k},{k}) = {R_kk} ⇒ ({R_kk})* = {R_kk_star}\n" +
                ("\n".join([f"• {u['formula']}" for u in updates]) if updates else "• No active bypass paths passed through this state.")
            ),
            "states_remaining": list(active_list),
            "updates_count": len(updates)
        })
        step_num += 1

    # Final regular expression is R[s_init][s_final]
    final_regex = R[s_init][s_final]
    if not final_regex:
        final_regex = "∅"

    steps.append({
        "step_number": step_num,
        "action": "FINALIZE",
        "title": "State Elimination Complete",
        "description": f"Only start '{s_init}' and accepting state '{s_final}' remain.",
        "mathematical_explanation": f"The final equivalent regular expression is: {final_regex}",
        "states_remaining": [s_init, s_final]
    })

    return {
        "regex": final_regex,
        "steps": steps,
        "summary": f"Derived regular expression: {final_regex} by eliminating {len(elimination_order)} states."
    }
