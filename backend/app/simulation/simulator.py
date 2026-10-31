from typing import List, Set, Dict, Optional
from app.models.automaton import AutomatonModel, SimulationResult, SimulationStep, BatchSimulationResponse
from app.core.automaton_types import AutomatonType
from app.algorithms.epsilon_closure import compute_epsilon_closure
from app.core.validation import assert_valid_automaton

def simulate_string(automaton: AutomatonModel, input_string: str) -> SimulationResult:
    """
    Simulates an input string on an automaton (DFA, NFA, or ε-NFA).
    Tracks exact active state sets, transitions taken, and full explanation.
    Distinguishes invalid alphabet symbols from mathematical language rejection.
    """
    aut = automaton.canonicalize()
    alphabet_set = set(aut.alphabet)

    # 1. Check for invalid symbols
    for idx, char in enumerate(input_string):
        if char not in alphabet_set:
            return SimulationResult(
                input_string=input_string,
                is_accepted=False,
                is_valid_alphabet=False,
                final_states=[],
                steps=[],
                error_message=f"Invalid symbol '{char}' at index {idx}. Symbol is not in alphabet Σ = {{{', '.join(aut.alphabet)}}}."
            )

    steps: List[SimulationStep] = []
    is_enfa = (aut.type == AutomatonType.ENFA)
    accepting_set = set(aut.accepting_states)

    # Initial active states
    if is_enfa:
        active_set, init_trace = compute_epsilon_closure({aut.initial_state}, aut.epsilon_transitions)
        init_explanation = (
            f"Start at initial state {aut.initial_state} and take ε-closure:\n"
            f"Active States: {{{', '.join(sorted(active_set))}}}"
        )
    else:
        active_set = {aut.initial_state}
        init_explanation = f"Start at initial state {aut.initial_state}."

    steps.append(SimulationStep(
        step_index=0,
        symbol=None,
        active_states=sorted(list(active_set)),
        explanation=init_explanation
    ))

    # Process each symbol in the input string
    for idx, symbol in enumerate(input_string):
        next_states: Set[str] = set()
        transitions_taken: List[Dict[str, str]] = []

        for curr in sorted(list(active_set)):
            dests = aut.transitions.get(curr, {}).get(symbol, [])
            for d in dests:
                next_states.add(d)
                transitions_taken.append({"from": curr, "symbol": symbol, "to": d})

        # If ε-NFA, expand via ε-closure after consuming symbol
        if is_enfa:
            expanded_set, _ = compute_epsilon_closure(next_states, aut.epsilon_transitions)
            trans_str = ', '.join([f"{t['from']} → {t['to']}" for t in transitions_taken]) or 'No transition'
            explanation = (
                f"Consumed '{symbol}' (character {idx+1}/{len(input_string)}):\n"
                f"• Followed transitions: {{{trans_str}}}\n"
                f"• Immediate destinations: {{{', '.join(sorted(next_states)) or '∅'}}}\n"
                f"• After ε-closure: {{{', '.join(sorted(expanded_set)) or '∅'}}}"
            )
            active_set = expanded_set
        else:
            explanation = (
                f"Consumed '{symbol}' (character {idx+1}/{len(input_string)}):\n"
                f"• Next active states: {{{', '.join(sorted(next_states)) or '∅'}}}"
            )
            active_set = next_states

        steps.append(SimulationStep(
            step_index=idx + 1,
            symbol=symbol,
            active_states=sorted(list(active_set)),
            transitions_taken=transitions_taken,
            explanation=explanation
        ))

        # Optimization: If active set is empty, remaining string will also be rejected
        if not active_set and idx < len(input_string) - 1:
            remaining = input_string[idx+1:]
            steps.append(SimulationStep(
                step_index=len(input_string),
                symbol=None,
                active_states=[],
                explanation=f"Active state set became empty. Remaining suffix '{remaining}' cannot be accepted."
            ))
            break

    # Acceptance check
    final_states = sorted(list(active_set))
    is_accepted = any(s in accepting_set for s in final_states)

    return SimulationResult(
        input_string=input_string,
        is_accepted=is_accepted,
        is_valid_alphabet=True,
        final_states=final_states,
        steps=steps,
        error_message=None
    )

def batch_simulate(automaton: AutomatonModel, test_strings: List[str]) -> BatchSimulationResponse:
    results: List[SimulationResult] = []
    accepted = 0
    rejected = 0
    invalid = 0

    for s in test_strings:
        res = simulate_string(automaton, s)
        results.append(res)
        if not res.is_valid_alphabet:
            invalid += 1
        elif res.is_accepted:
            accepted += 1
        else:
            rejected += 1

    return BatchSimulationResponse(
        results=results,
        total=len(test_strings),
        accepted=accepted,
        rejected=rejected,
        invalid=invalid
    )
