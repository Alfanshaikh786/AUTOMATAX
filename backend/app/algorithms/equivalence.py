from typing import Dict, List, Set, Tuple, Optional
from collections import deque
from app.models.automaton import AutomatonModel, EquivalenceResponse
from app.core.automaton_types import AutomatonType
from app.algorithms.subset_construction import convert_to_dfa_subset_construction
from app.algorithms.minimization import complete_dfa
from app.simulation.simulator import simulate_string

def to_complete_dfa_over_alphabet(aut: AutomatonModel, target_alphabet: List[str]) -> AutomatonModel:
    """Converts an automaton to a complete DFA over a target alphabet."""
    # Convert to DFA if needed
    if aut.type in (AutomatonType.NFA, AutomatonType.ENFA):
        conv_res = convert_to_dfa_subset_construction(aut)
        dfa = conv_res.converted_automaton
    else:
        dfa = aut

    # Ensure all symbols from target_alphabet are in the DFA's alphabet
    states = list(dfa.states)
    transitions = {s: {sym: list(dests) for sym, dests in dfa.transitions.get(s, {}).items()} for s in states}
    alphabet = sorted(list(set(dfa.alphabet).union(set(target_alphabet))))

    # Add sink state if incomplete
    sink_needed = False
    for s in states:
        for sym in alphabet:
            if sym not in transitions[s] or not transitions[s][sym]:
                sink_needed = True
                break
        if sink_needed:
            break

    if sink_needed:
        sink = "sink_state"
        counter = 1
        while sink in states:
            sink = f"sink_state_{counter}"
            counter += 1

        states.append(sink)
        transitions[sink] = {sym: [sink] for sym in alphabet}
        for s in states:
            if s not in transitions:
                transitions[s] = {}
            for sym in alphabet:
                if sym not in transitions[s] or not transitions[s][sym]:
                    transitions[s][sym] = [sink]

    return AutomatonModel(
        id=f"{dfa.id}_complete",
        name=dfa.name,
        type=AutomatonType.DFA,
        states=states,
        alphabet=alphabet,
        initial_state=dfa.initial_state,
        accepting_states=dfa.accepting_states,
        transitions=transitions,
        epsilon_transitions={}
    )

def check_automata_equivalence(aut_a: AutomatonModel, aut_b: AutomatonModel) -> EquivalenceResponse:
    """
    Checks if two automata accept identical formal languages: L(A) == L(B).
    Uses Cartesian product automaton construction with BFS to discover the
    SHORTEST distinguishing counterexample string.
    """
    # 1. Normalize Alphabets
    combined_alphabet = sorted(list(set(aut_a.alphabet).union(set(aut_b.alphabet))))
    if not combined_alphabet:
        # Edge case: empty alphabet
        is_empty_a = len(aut_a.accepting_states) > 0 and aut_a.initial_state in aut_a.accepting_states
        is_empty_b = len(aut_b.accepting_states) > 0 and aut_b.initial_state in aut_b.accepting_states
        if is_empty_a == is_empty_b:
            return EquivalenceResponse(
                is_equivalent=True,
                counterexample=None,
                explanation="Both automata have empty alphabets and accept identical languages.",
                details={"product_states_explored": 1}
            )
        else:
            return EquivalenceResponse(
                is_equivalent=False,
                counterexample="",
                explanation="Automata differ on the empty string ε.",
                details={"product_states_explored": 1}
            )

    # 2. Convert both to complete DFAs over the combined alphabet
    dfa_a = to_complete_dfa_over_alphabet(aut_a, combined_alphabet)
    dfa_b = to_complete_dfa_over_alphabet(aut_b, combined_alphabet)

    acc_a = set(dfa_a.accepting_states)
    acc_b = set(dfa_b.accepting_states)

    # 3. Product Automaton BFS
    start_pair = (dfa_a.initial_state, dfa_b.initial_state)

    # Check if empty string ε is a counterexample
    a_accepts_eps = start_pair[0] in acc_a
    b_accepts_eps = start_pair[1] in acc_b

    if a_accepts_eps != b_accepts_eps:
        # Counterexample found at empty string
        trace_a = simulate_string(aut_a, "")
        trace_b = simulate_string(aut_b, "")
        accepted_by = aut_a.name if a_accepts_eps else aut_b.name
        rejected_by = aut_b.name if a_accepts_eps else aut_a.name
        return EquivalenceResponse(
            is_equivalent=False,
            counterexample="",
            explanation=(
                f"NOT EQUIVALENT: The automata differ on the empty string ε.\n"
                f"• {accepted_by} accepts the empty string.\n"
                f"• {rejected_by} rejects the empty string."
            ),
            trace_a=trace_a,
            trace_b=trace_b,
            details={"distinguishing_symbol": "ε", "product_states_explored": 1}
        )

    visited: Set[Tuple[str, str]] = {start_pair}
    queue = deque([(start_pair, "")])
    explored_count = 0

    while queue:
        (curr_a, curr_b), path = queue.popleft()
        explored_count += 1

        for sym in combined_alphabet:
            next_a_list = dfa_a.transitions.get(curr_a, {}).get(sym, [])
            next_b_list = dfa_b.transitions.get(curr_b, {}).get(sym, [])

            if not next_a_list or not next_b_list:
                continue

            next_a = next_a_list[0]
            next_b = next_b_list[0]

            is_acc_a = next_a in acc_a
            is_acc_b = next_b in acc_b

            new_path = path + sym

            # Check if this state is distinguishing (one accepts, the other rejects)
            if is_acc_a != is_acc_b:
                trace_a = simulate_string(aut_a, new_path)
                trace_b = simulate_string(aut_b, new_path)
                accepted_by = aut_a.name if is_acc_a else aut_b.name
                rejected_by = aut_b.name if is_acc_a else aut_a.name

                return EquivalenceResponse(
                    is_equivalent=False,
                    counterexample=new_path,
                    explanation=(
                        f"NOT EQUIVALENT: Found shortest distinguishing counterexample '{new_path}' (length {len(new_path)}).\n"
                        f"• {accepted_by} accepts '{new_path}'.\n"
                        f"• {rejected_by} rejects '{new_path}'.\n"
                        f"Explored {explored_count} product state pairs before finding the distinguishing state ({next_a}, {next_b})."
                    ),
                    trace_a=trace_a,
                    trace_b=trace_b,
                    details={
                        "product_states_explored": explored_count,
                        "distinguishing_pair": [next_a, next_b],
                        "counterexample_length": len(new_path)
                    }
                )

            next_pair = (next_a, next_b)
            if next_pair not in visited:
                visited.add(next_pair)
                queue.append((next_pair, new_path))

    # All reachable product states explored without finding any distinguishing state
    return EquivalenceResponse(
        is_equivalent=True,
        counterexample=None,
        explanation=(
            f"EQUIVALENT: The two automata accept exactly the same formal language: L({aut_a.name}) = L({aut_b.name}).\n"
            f"Mathematical verification explored all {len(visited)} reachable product states in the Cartesian product "
            f"DFA_A × DFA_B. Zero distinguishing states exist."
        ),
        details={"product_states_explored": len(visited)}
    )
