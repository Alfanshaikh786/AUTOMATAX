from typing import Dict, List, Set
import time
from app.models.automaton import AutomatonModel, ConversionResponse, ConversionStep
from app.core.automaton_types import AutomatonType, ConversionAlgorithm, StepActionType
from app.core.validation import assert_valid_automaton
from app.algorithms.epsilon_closure import compute_epsilon_closure

def convert_enfa_to_nfa(enfa: AutomatonModel) -> ConversionResponse:
    """
    Converts an ε-NFA to an equivalent NFA using epsilon-elimination.
    Algorithm:
      For each state q in Q and symbol a in Σ:
        δ'(q, a) = ε-closure(move(ε-closure(q), a))
      F' = { q in Q | ε-closure(q) ∩ F != ∅ }
    """
    start_time = time.time()
    aut = enfa.canonicalize()
    assert_valid_automaton(aut)

    steps: List[ConversionStep] = []
    step_num = 1

    # Step 1: Initial state & closures calculation
    closures: Dict[str, Set[str]] = {}
    for q in aut.states:
        c_set, _ = compute_epsilon_closure(q, aut.epsilon_transitions)
        closures[q] = c_set

    steps.append(ConversionStep(
        step_number=step_num,
        action_type=StepActionType.INITIALIZE,
        title="Compute Epsilon Closures",
        description="Compute the ε-closure for every state in the automaton.",
        mathematical_explanation=(
            "For each state q ∈ Q, ε-closure(q) represents all states reachable from q "
            "by following zero or more ε-transitions. A state always belongs to its own ε-closure.\n" +
            "\n".join([f"• ε-closure({q}) = {{{', '.join(sorted(closures[q]))}}}" for q in aut.states])
        ),
        highlight_states=aut.states,
        table_snapshot={"closures": {k: sorted(list(v)) for k, v in closures.items()}}
    ))
    step_num += 1

    # Step 2: Compute new transitions for each state and symbol
    new_transitions: Dict[str, Dict[str, List[str]]] = {q: {} for q in aut.states}

    for q in aut.states:
        cq = closures[q]
        for a in aut.alphabet:
            # move(cq, a)
            move_set: Set[str] = set()
            for p in cq:
                if p in aut.transitions and a in aut.transitions[p]:
                    move_set.update(aut.transitions[p][a])

            # ε-closure(move(cq, a))
            dest_closure, _ = compute_epsilon_closure(move_set, aut.epsilon_transitions)
            sorted_dest = sorted(list(dest_closure))
            if sorted_dest:
                new_transitions[q][a] = sorted_dest

            steps.append(ConversionStep(
                step_number=step_num,
                action_type=StepActionType.EPSILON_CLOSURE,
                title=f"Calculate δ'({q}, '{a}')",
                description=f"Determine the new transitions from {q} on symbol '{a}' without ε-transitions.",
                mathematical_explanation=(
                    f"1. ε-closure({q}) = {{{', '.join(sorted(cq))}}}\n"
                    f"2. move(ε-closure({q}), '{a}') = {{{', '.join(sorted(move_set)) or '∅'}}}\n"
                    f"3. δ'({q}, '{a}') = ε-closure(move(...)) = {{{', '.join(sorted_dest) or '∅'}}}"
                ),
                highlight_states=[q] + sorted_dest,
                highlight_transitions=[{"from": q, "to": d, "symbol": a} for d in sorted_dest],
                current_state_or_subset=q,
                input_symbol=a,
                resulting_set=sorted_dest
            ))
            step_num += 1

    # Step 3: Compute new accepting states
    orig_f = set(aut.accepting_states)
    new_accepting: List[str] = []
    f_explanations: List[str] = []

    for q in aut.states:
        intersection = closures[q].intersection(orig_f)
        if intersection:
            new_accepting.append(q)
            f_explanations.append(f"• {q} is accepting because ε-closure({q}) ∩ F = {{{', '.join(sorted(intersection))}}} ≠ ∅")
        else:
            f_explanations.append(f"• {q} is non-accepting because ε-closure({q}) contains no accepting state from F")

    new_accepting.sort()

    steps.append(ConversionStep(
        step_number=step_num,
        action_type=StepActionType.FINALIZE,
        title="Determine Updated Accepting States F'",
        description="A state q is accepting in the new NFA if its ε-closure contains at least one original accepting state.",
        mathematical_explanation=(
            "F' = { q ∈ Q | ε-closure(q) ∩ F ≠ ∅ }\n" +
            "\n".join(f_explanations) +
            f"\n\nResulting Accepting States: {{{', '.join(new_accepting) or '∅'}}}"
        ),
        highlight_states=new_accepting
    ))

    converted = AutomatonModel(
        id=f"{aut.id}_nfa",
        name=f"{aut.name} (NFA)",
        type=AutomatonType.NFA,
        states=aut.states,
        alphabet=aut.alphabet,
        initial_state=aut.initial_state,
        accepting_states=new_accepting,
        transitions=new_transitions,
        epsilon_transitions={},
        layout=aut.layout,
        description=f"Converted from ε-NFA via epsilon elimination."
    )

    elapsed_ms = (time.time() - start_time) * 1000.0

    return ConversionResponse(
        original_automaton=aut,
        converted_automaton=converted,
        algorithm=ConversionAlgorithm.EPSILON_ELIMINATION,
        steps=steps,
        summary=f"Successfully converted ε-NFA ({len(aut.states)} states) to equivalent NFA with {len(new_accepting)} accepting states in {step_num} steps.",
        execution_time_ms=elapsed_ms
    )

