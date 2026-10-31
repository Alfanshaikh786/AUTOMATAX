from typing import Dict, List, Set, Tuple, Optional
from collections import deque
import time
from app.models.automaton import AutomatonModel, ConversionResponse, ConversionStep
from app.core.automaton_types import AutomatonType, ConversionAlgorithm, StepActionType
from app.core.validation import assert_valid_automaton
from app.core.exceptions import ConversionError

def complete_dfa(dfa: AutomatonModel, sink_name: str = "q_sink") -> Tuple[AutomatonModel, bool]:
    """
    Ensures the DFA is complete by adding a sink state if any transition is missing.
    Returns (completed_dfa, added_sink).
    """
    states = list(dfa.states)
    transitions = {s: {sym: list(dests) for sym, dests in dfa.transitions.get(s, {}).items()} for s in states}
    alphabet = dfa.alphabet
    added_sink = False

    # Check if any state is missing transitions
    needs_sink = False
    for s in states:
        for sym in alphabet:
            if sym not in transitions[s] or not transitions[s][sym]:
                needs_sink = True
                break
        if needs_sink:
            break

    if needs_sink:
        # Determine unique sink name
        actual_sink = sink_name
        counter = 1
        while actual_sink in states:
            actual_sink = f"{sink_name}_{counter}"
            counter += 1

        states.append(actual_sink)
        transitions[actual_sink] = {sym: [actual_sink] for sym in alphabet}
        added_sink = True

        for s in states:
            if s not in transitions:
                transitions[s] = {}
            for sym in alphabet:
                if sym not in transitions[s] or not transitions[s][sym]:
                    transitions[s][sym] = [actual_sink]

    return AutomatonModel(
        id=dfa.id,
        name=dfa.name,
        type=AutomatonType.DFA,
        states=states,
        alphabet=alphabet,
        initial_state=dfa.initial_state,
        accepting_states=dfa.accepting_states,
        transitions=transitions,
        epsilon_transitions={}
    ), added_sink

def get_reachable_states(aut: AutomatonModel) -> Set[str]:
    """Finds all states reachable from the initial state."""
    if not aut.initial_state or aut.initial_state not in aut.states:
        return set()
    reachable: Set[str] = {aut.initial_state}
    queue = deque([aut.initial_state])

    while queue:
        curr = queue.popleft()
        for sym, dests in aut.transitions.get(curr, {}).items():
            for d in dests:
                if d not in reachable:
                    reachable.add(d)
                    queue.append(d)

    return reachable

def minimize_dfa_hopcroft(dfa: AutomatonModel) -> ConversionResponse:
    """
    Minimizes a DFA using Hopcroft's partition refinement algorithm.
    Includes unreachable state removal, completion, partition steps, and state merging.
    """
    start_time = time.time()
    aut = dfa.canonicalize()
    if aut.type != AutomatonType.DFA:
        raise ConversionError("DFA minimization requires an input automaton of type DFA.")

    assert_valid_automaton(aut)
    steps: List[ConversionStep] = []
    step_num = 1

    # 1. Unreachable State Removal
    reachable = get_reachable_states(aut)
    unreachable = set(aut.states) - reachable
    if unreachable:
        steps.append(ConversionStep(
            step_number=step_num,
            action_type=StepActionType.INITIALIZE,
            title="Remove Unreachable States",
            description=f"Identified and removed {len(unreachable)} unreachable state(s).",
            mathematical_explanation=(
                f"A state is unreachable if there is no directed path from the initial state {aut.initial_state}.\n"
                f"Removed unreachable states: {{{', '.join(sorted(unreachable))}}}\n"
                f"Remaining reachable states: {{{', '.join(sorted(reachable))}}}"
            ),
            highlight_states=sorted(list(unreachable))
        ))
        step_num += 1

    # Filter automaton to reachable states only
    r_states = sorted(list(reachable))
    r_accepting = [s for s in aut.accepting_states if s in reachable]
    r_transitions = {
        s: {sym: [d for d in dests if d in reachable] for sym, dests in aut.transitions.get(s, {}).items()}
        for s in r_states
    }
    reachable_aut = AutomatonModel(
        id=aut.id,
        name=aut.name,
        type=AutomatonType.DFA,
        states=r_states,
        alphabet=aut.alphabet,
        initial_state=aut.initial_state,
        accepting_states=r_accepting,
        transitions=r_transitions
    )

    # 2. Complete the DFA (if any transitions missing)
    completed_aut, added_sink = complete_dfa(reachable_aut)
    if added_sink:
        steps.append(ConversionStep(
            step_number=step_num,
            action_type=StepActionType.INITIALIZE,
            title="Complete DFA with Sink State",
            description="Completed missing transitions using a non-accepting dead/sink state.",
            mathematical_explanation=(
                "Hopcroft's partition refinement algorithm requires a complete transition function "
                "δ: Q × Σ → Q. Missing transitions are directed to an explicit dead state."
            ),
            highlight_states=[completed_aut.states[-1]]
        ))
        step_num += 1

    Q = set(completed_aut.states)
    F = set(completed_aut.accepting_states)
    non_F = Q - F
    Sigma = completed_aut.alphabet

    # 3. Initial Partition P = {F, Q \ F}
    P: List[Set[str]] = []
    if F:
        P.append(F)
    if non_F:
        P.append(non_F)

    # Worklist W contains the smaller of F and Q \ F
    W: List[Set[str]] = []
    if F and non_F:
        if len(F) <= len(non_F):
            W.append(F)
        else:
            W.append(non_F)
    elif F:
        W.append(F)
    elif non_F:
        W.append(non_F)

    def format_partition(partition: List[Set[str]]) -> str:
        blocks = ["{" + ", ".join(sorted(b)) + "}" for b in partition]
        return "{ " + ", ".join(blocks) + " }"

    steps.append(ConversionStep(
        step_number=step_num,
        action_type=StepActionType.PARTITION,
        title="Initial Partition P0 = {F, Q \\ F}",
        description="Split all states into accepting (F) and non-accepting (Q \\ F) equivalence classes.",
        mathematical_explanation=(
            f"0-equivalence partitions states into those that accept the empty string ε vs those that do not:\n"
            f"• Accepting Block F: {{{', '.join(sorted(F)) or '∅'}}}\n"
            f"• Non-accepting Block Q \\ F: {{{', '.join(sorted(non_F)) or '∅'}}}\n\n"
            f"Current Partition P = {format_partition(P)}"
        ),
        table_snapshot={"partition": [sorted(list(b)) for b in P]}
    ))
    step_num += 1

    # Inverted transitions: for each symbol c and dest state d, get all states q where δ(q, c) = d
    inv_delta: Dict[str, Dict[str, Set[str]]] = {sym: {s: set() for s in completed_aut.states} for sym in Sigma}
    for src, sym_map in completed_aut.transitions.items():
        for sym, dests in sym_map.items():
            if dests and sym in inv_delta:
                d = dests[0]
                if d in inv_delta[sym]:
                    inv_delta[sym][d].add(src)

    # 4. Hopcroft Partition Refinement
    refinement_round = 1
    while W:
        A = W.pop(0)

        for c in Sigma:
            # X = set of states that transition into A on symbol c
            X: Set[str] = set()
            for a_state in A:
                X.update(inv_delta[c].get(a_state, set()))

            new_P: List[Set[str]] = []
            partition_changed = False

            for Y in P:
                intersection = Y.intersection(X)
                difference = Y - X

                if intersection and difference:
                    partition_changed = True
                    new_P.append(intersection)
                    new_P.append(difference)

                    # Update W
                    if Y in W:
                        W.remove(Y)
                        W.append(intersection)
                        W.append(difference)
                    else:
                        if len(intersection) <= len(difference):
                            W.append(intersection)
                        else:
                            W.append(difference)

                    steps.append(ConversionStep(
                        step_number=step_num,
                        action_type=StepActionType.PARTITION,
                        title=f"Refinement: Split Block on symbol '{c}'",
                        description=f"Block {{{', '.join(sorted(Y))}}} is distinguished by transition on '{c}'.",
                        mathematical_explanation=(
                            f"Examining splitter block A = {{{', '.join(sorted(A))}}} on symbol '{c}':\n"
                            f"• Pre-image X = {{ q | δ(q, '{c}') ∈ A }} = {{{', '.join(sorted(X))}}}\n"
                            f"• Block {{{', '.join(sorted(Y))}}} splits into:\n"
                            f"    Y1 (transitions into A) = {{{', '.join(sorted(intersection))}}}\n"
                            f"    Y2 (does NOT transition into A) = {{{', '.join(sorted(difference))}}}\n"
                            f"Updated Partition: {format_partition(new_P + [b for b in P if b != Y])}"
                        ),
                        highlight_states=sorted(list(intersection)) + sorted(list(difference)),
                        input_symbol=c,
                        table_snapshot={"split_block": sorted(list(Y)), "new_blocks": [sorted(list(intersection)), sorted(list(difference))]}
                    ))
                    step_num += 1
                else:
                    new_P.append(Y)

            P = new_P
            refinement_round += 1

    # 5. Build Minimized DFA from final equivalence classes
    state_to_block_id: Dict[str, str] = {}
    block_names: List[str] = []
    block_representatives: Dict[str, str] = {}

    # Sort blocks so initial state's block comes first
    sorted_blocks = sorted(P, key=lambda b: (0 if completed_aut.initial_state in b else 1, sorted(list(b))[0]))

    for idx, block in enumerate(sorted_blocks):
        sorted_members = sorted(list(block))
        # Representative name
        if len(sorted_members) == 1:
            name = sorted_members[0]
        else:
            name = "{" + ",".join(sorted_members) + "}"

        block_names.append(name)
        block_representatives[name] = sorted_members[0]
        for member in block:
            state_to_block_id[member] = name

    min_initial = state_to_block_id[completed_aut.initial_state]
    min_accepting: Set[str] = set()
    min_transitions: Dict[str, Dict[str, List[str]]] = {}

    for b_name in block_names:
        rep = block_representatives[b_name]
        min_transitions[b_name] = {}
        for sym in Sigma:
            dest = completed_aut.transitions.get(rep, {}).get(sym, [])
            if dest:
                dest_block = state_to_block_id[dest[0]]
                min_transitions[b_name][sym] = [dest_block]

        # Accepting if representative (and all states in block) is accepting
        if rep in completed_aut.accepting_states:
            min_accepting.add(b_name)

    # Merged states report
    merged_info: List[str] = []
    for b in sorted_blocks:
        if len(b) > 1:
            merged_info.append(f"• Merged equivalent states {{{', '.join(sorted(b))}}} into single state '{state_to_block_id[list(b)[0]]}'")

    steps.append(ConversionStep(
        step_number=step_num,
        action_type=StepActionType.STATE_MERGE,
        title="Merge Equivalent States",
        description="Contract each equivalence class into a single state in the minimal DFA.",
        mathematical_explanation=(
            f"Final stable equivalence partition contains {len(block_names)} state(s):\n" +
            ( "\n".join(merged_info) if merged_info else "• All reachable states were already pairwise distinguishable (automaton was already minimal)." ) +
            f"\n\nMinimal DFA States: {{{', '.join(block_names)}}}\n"
            f"Minimal DFA Accepting: {{{', '.join(sorted(list(min_accepting))) or '∅'}}}"
        ),
        highlight_states=block_names
    ))

    minimized_aut = AutomatonModel(
        id=f"{aut.id}_min",
        name=f"{aut.name} (Minimal)",
        type=AutomatonType.DFA,
        states=block_names,
        alphabet=completed_aut.alphabet,
        initial_state=min_initial,
        accepting_states=sorted(list(min_accepting)),
        transitions=min_transitions,
        epsilon_transitions={},
        description=f"Minimized DFA obtained via Hopcroft's algorithm. Reduced from {len(aut.states)} to {len(block_names)} states."
    )

    elapsed_ms = (time.time() - start_time) * 1000.0

    return ConversionResponse(
        original_automaton=aut,
        converted_automaton=minimized_aut,
        algorithm=ConversionAlgorithm.HOPCROFT_MINIMIZATION,
        steps=steps,
        summary=f"Minimized DFA from {len(aut.states)} states to {len(block_names)} minimal states in {step_num} steps.",
        execution_time_ms=elapsed_ms
    )

