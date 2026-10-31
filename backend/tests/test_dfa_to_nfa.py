import pytest
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType
from app.algorithms.conversion_embed import convert_dfa_to_nfa
from app.simulation.simulator import simulate_string

def test_dfa_to_nfa_conversion():
    # DFA that checks if binary string has an even number of 0s
    dfa = AutomatonModel(
        id="even_zeros_dfa",
        name="Even Zeros DFA",
        type=AutomatonType.DFA,
        states=["rem_0", "rem_1"],
        alphabet=["0", "1"],
        initial_state="rem_0",
        accepting_states=["rem_0"],
        transitions={
            "rem_0": {"0": ["rem_1"], "1": ["rem_0"]},
            "rem_1": {"0": ["rem_0"], "1": ["rem_1"]}
        }
    )

    res = convert_dfa_to_nfa(dfa)

    # 1. Preserve all original states, alphabet, initial state and accepting states
    assert res.converted_automaton.states == dfa.states
    assert res.converted_automaton.alphabet == dfa.alphabet
    assert res.converted_automaton.initial_state == dfa.initial_state
    assert res.converted_automaton.accepting_states == dfa.accepting_states
    assert res.converted_automaton.type == AutomatonType.NFA

    # 2. Convert every DFA transition destination into a singleton set
    for s in res.converted_automaton.states:
        for sym in res.converted_automaton.alphabet:
            dests = res.converted_automaton.transitions[s][sym]
            assert isinstance(dests, list)
            assert len(dests) == 1, f"Transition from {s} on {sym} must be singleton, got {dests}"

    # 3. Validation test confirmed in verification payload
    assert res.verification is not None
    assert res.verification.all_transitions_singleton is True
    assert res.verification.validation_passed is True
    assert res.verification.total_transitions_checked == 4

    # 4. Equivalence verification
    assert res.verification.is_equivalent is True
    assert res.verification.counterexample is None

    # 5. Multiple input strings tested against both automata with identical results
    assert len(res.verification.test_simulations) > 0
    for sim in res.verification.test_simulations:
        assert sim.matches is True, f"Mismatch on string: {sim.input_string}"

    # 6. Formal transition function comparison table
    assert len(res.comparison_table) == 4
    for row in res.comparison_table:
        assert row.is_singleton is True
        assert "{" in row.nfa_notation and "}" in row.nfa_notation

    # 7. NFA engine supports multiple destinations
    multi_dest_nfa = AutomatonModel(
        id="multi_nfa",
        name="Multi Dest NFA",
        type=AutomatonType.NFA,
        states=["q0", "q1", "q2"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q2"],
        transitions={
            "q0": {"0": ["q0", "q1"]},  # Multiple destinations
            "q1": {"1": ["q2"]}
        }
    )
    # Simulate on string "01"
    sim_res = simulate_string(multi_dest_nfa, "01")
    assert sim_res.is_accepted is True
