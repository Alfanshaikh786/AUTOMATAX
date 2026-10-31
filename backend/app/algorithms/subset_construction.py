from typing import Dict, List, Set, Tuple, Optional
from collections import deque
import time
from app.models.automaton import AutomatonModel, ConversionResponse, ConversionStep
from app.core.automaton_types import AutomatonType, ConversionAlgorithm, StepActionType
from app.core.validation import assert_valid_automaton
from app.algorithms.epsilon_closure import compute_epsilon_closure
from app.core.exceptions import ConversionError

def format_subset_name(subset: Set[str]) -> str:
    """Formats a canonical state name for a subset of states."""
    if not subset:
        return "∅"
    sorted_members = sorted(list(subset))
    return "{" + ",".join(sorted_members) + "}"

def convert_to_dfa_subset_construction(
    automaton: AutomatonModel,
    max_states: int = 512,
    include_dead_state: bool = True
) -> ConversionResponse:
    """
    Converts an NFA or ε-NFA to a DFA using reachable subset construction.
    Supports canonical subset hashing, progress tracking, and step-by-step generation.
    """
    start_time = time.time()
    aut = automaton.canonicalize()
    assert_valid_automaton(aut)

    steps: List[ConversionStep] = []
    step_num = 1
    is_enfa = (aut.type == AutomatonType.ENFA)

    # 1. Determine Initial DFA State
    if is_enfa:
        initial_set, init_trace = compute_epsilon_closure({aut.initial_state}, aut.epsilon_transitions)
        init_explanation = (
            f"For an ε-NFA, the initial DFA state is the ε-closure of the initial state {aut.initial_state}:\n"
            f"ε-closure({{{aut.initial_state}}}) = {format_subset_name(initial_set)}"
        )
    else:
        initial_set = {aut.initial_state}
        init_explanation = (
            f"For a standard NFA, the initial DFA state is the singleton set containing the initial state: "
            f"{format_subset_name(initial_set)}"
        )

    initial_name = format_subset_name(initial_set)

    steps.append(ConversionStep(
        step_number=step_num,
        action_type=StepActionType.INITIALIZE,
        title="Initialize Subset Construction",
        description="Compute the starting DFA state as the initial subset.",
        mathematical_explanation=init_explanation,
        current_state_or_subset=sorted(list(initial_set)),
        highlight_states=[initial_name]
    ))
    step_num += 1

    # 2. Reachable Subset Exploration Queue
    # Map frozenset -> canonical name
    subset_to_name: Dict[frozenset, str] = {frozenset(initial_set): initial_name}
    name_to_subset: Dict[str, Set[str]] = {initial_name: initial_set}
    queue = deque([initial_set])

    dfa_transitions: Dict[str, Dict[str, List[str]]] = {}
    dfa_states: List[str] = [initial_name]
    dfa_accepting: Set[str] = set()

    orig_f = set(aut.accepting_states)
    if initial_set.intersection(orig_f):
        dfa_accepting.add(initial_name)

    dead_state_needed = False

    while queue:
        if len(dfa_states) > max_states:
            raise ConversionError(
                f"State explosion safeguard exceeded: Reached limit of {max_states} DFA subsets. "
                f"Subset construction stopped safely to prevent memory exhaustion."
            )

        current_set = queue.popleft()
        current_name = subset_to_name[frozenset(current_set)]
        dfa_transitions[current_name] = {}

        for a in aut.alphabet:
            # Step A: Compute move(current_set, a)
            move_set: Set[str] = set()
            for q in current_set:
                if q in aut.transitions and a in aut.transitions[q]:
                    move_set.update(aut.transitions[q][a])

            # Step B: If ε-NFA, compute ε-closure(move_set)
            if is_enfa:
                dest_set, _ = compute_epsilon_closure(move_set, aut.epsilon_transitions)
            else:
                dest_set = move_set

            dest_frozen = frozenset(dest_set)
            is_empty = len(dest_set) == 0

            if is_empty:
                if include_dead_state:
                    dead_state_needed = True
                    dest_name = "∅"
                    if frozenset() not in subset_to_name:
                        subset_to_name[frozenset()] = "∅"
                        name_to_subset["∅"] = set()
                        dfa_states.append("∅")
                        dfa_transitions["∅"] = {sym: ["∅"] for sym in aut.alphabet}
                    dfa_transitions[current_name][a] = ["∅"]
                else:
                    # Incomplete transition
                    continue
            else:
                if dest_frozen not in subset_to_name:
                    dest_name = format_subset_name(dest_set)
                    subset_to_name[dest_frozen] = dest_name
                    name_to_subset[dest_name] = dest_set
                    dfa_states.append(dest_name)
                    queue.append(dest_set)

                    if dest_set.intersection(orig_f):
                        dfa_accepting.add(dest_name)

                    discovered_new = True
                else:
                    dest_name = subset_to_name[dest_frozen]
                    discovered_new = False

                dfa_transitions[current_name][a] = [dest_name]

            # Explanation for this transition
            if is_enfa:
                calc_desc = (
                    f"1. move({current_name}, '{a}') = {{{', '.join(sorted(move_set)) or '∅'}}}\n"
                    f"2. ε-closure(move(...)) = {format_subset_name(dest_set)}"
                )
            else:
                calc_desc = f"move({current_name}, '{a}') = {format_subset_name(dest_set)}"

            new_flag = " (New state discovered!)" if not is_empty and discovered_new else ""
            acc_flag = " [Accepting Subset]" if dest_set.intersection(orig_f) else ""

            steps.append(ConversionStep(
                step_number=step_num,
                action_type=StepActionType.SUBSET_EXPAND,
                title=f"δ_D({current_name}, '{a}') → {dest_name}{new_flag}",
                description=f"Transition on symbol '{a}' from subset {current_name}.",
                mathematical_explanation=(
                    f"Processing symbol '{a}' for current subset {current_name}:\n"
                    f"{calc_desc}\n"
                    f"Resulting DFA State: {dest_name}{acc_flag}"
                ),
                highlight_states=[current_name, dest_name],
                highlight_transitions=[{"from": current_name, "to": dest_name, "symbol": a}],
                current_state_or_subset=sorted(list(current_set)),
                input_symbol=a,
                resulting_set=sorted(list(dest_set))
            ))
            step_num += 1

    # Final summary step
    steps.append(ConversionStep(
        step_number=step_num,
        action_type=StepActionType.FINALIZE,
        title="Subset Construction Complete",
        description="All reachable subsets have been explored and transitions determined.",
        mathematical_explanation=(
            f"• Total Reachable DFA States: {len(dfa_states)}\n"
            f"• DFA Alphabet: {{{', '.join(aut.alphabet)}}}\n"
            f"• Initial State: {initial_name}\n"
            f"• Accepting States: {{{', '.join(sorted(list(dfa_accepting))) or '∅'}}}"
        ),
        highlight_states=sorted(list(dfa_accepting))
    ))

    converted_dfa = AutomatonModel(
        id=f"{aut.id}_dfa",
        name=f"{aut.name} (DFA)",
        type=AutomatonType.DFA,
        states=dfa_states,
        alphabet=aut.alphabet,
        initial_state=initial_name,
        accepting_states=sorted(list(dfa_accepting)),
        transitions=dfa_transitions,
        epsilon_transitions={},
        description="Converted to DFA via reachable subset construction."
    )

    elapsed_ms = (time.time() - start_time) * 1000.0

    return ConversionResponse(
        original_automaton=aut,
        converted_automaton=converted_dfa,
        algorithm=ConversionAlgorithm.SUBSET_CONSTRUCTION,
        steps=steps,
        summary=f"Successfully constructed DFA with {len(dfa_states)} states from {aut.type.value} in {step_num} steps.",
        execution_time_ms=elapsed_ms
    )

