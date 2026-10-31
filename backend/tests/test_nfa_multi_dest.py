import pytest
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType
from app.simulation.simulator import simulate_string, batch_simulate
from app.algorithms.subset_construction import convert_to_dfa_subset_construction
from app.algorithms.equivalence import check_automata_equivalence
from app.core.validation import validate_automaton, assert_valid_automaton

def test_nfa_multiple_destinations_model_and_simulation():
    """
    Tests the exact NFA from Requirement 1:
      δ(q0, 0) = {q0, q1}
      δ(q0, 1) = {q1, q2}
      δ(q1, 0) = {q2}
      δ(q1, 1) = {q0, q2}
      δ(q2, 0) = ∅
      δ(q2, 1) = {q1}
    Initial state: q0, Accepting: q2
    """
    nfa = AutomatonModel(
        id="nfa_multi_dest_001",
        name="Multi-Destination NFA Example",
        type=AutomatonType.NFA,
        states=["q0", "q1", "q2"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q2"],
        transitions={
            "q0": {
                "0": ["q0", "q1"],
                "1": ["q1", "q2"]
            },
            "q1": {
                "0": ["q2"],
                "1": ["q0", "q2"]
            },
            "q2": {
                "0": [],
                "1": ["q1"]
            }
        }
    )

    # 1. Validation test
    is_valid, errors = validate_automaton(nfa)
    assert is_valid, f"Validation failed with errors: {errors}"
    assert errors == []

    # 2. Simulation test:
    # String "0":
    # q0 -0-> q0, q1. Active final states: {q0, q1}. q2 not in {q0, q1} => REJECT
    res_0 = simulate_string(nfa, "0")
    assert res_0.is_accepted is False
    assert set(res_0.final_states) == {"q0", "q1"}

    # String "1":
    # q0 -1-> q1, q2. Active final states: {q1, q2}. q2 in {q1, q2} => ACCEPT
    res_1 = simulate_string(nfa, "1")
    assert res_1.is_accepted is True
    assert set(res_1.final_states) == {"q1", "q2"}

    # String "00":
    # q0 -0-> q0, q1
    # q0 -0-> q0, q1; q1 -0-> q2
    # Combined next states: {q0, q1, q2}. q2 in {q0, q1, q2} => ACCEPT
    res_00 = simulate_string(nfa, "00")
    assert res_00.is_accepted is True
    assert set(res_00.final_states) == {"q0", "q1", "q2"}

    # String "01":
    # q0 -0-> q0, q1
    # q0 -1-> q1, q2; q1 -1-> q0, q2
    # Combined: {q0, q1, q2} => ACCEPT
    res_01 = simulate_string(nfa, "01")
    assert res_01.is_accepted is True
    assert set(res_01.final_states) == {"q0", "q1", "q2"}

    # String "10":
    # q0 -1-> q1, q2
    # q1 -0-> q2; q2 -0-> ∅
    # Combined: {q2} => ACCEPT
    res_10 = simulate_string(nfa, "10")
    assert res_10.is_accepted is True
    assert set(res_10.final_states) == {"q2"}

    # String "100":
    # q0 -1-> q1, q2
    # q1 -0-> q2; q2 -0-> ∅ (active = {q2})
    # q2 -0-> ∅ (active = ∅) => REJECT
    res_100 = simulate_string(nfa, "100")
    assert res_100.is_accepted is False
    assert set(res_100.final_states) == set()

    # 3. NFA to DFA Subset Construction
    conv_res = convert_to_dfa_subset_construction(nfa)
    dfa = conv_res.converted_automaton
    assert dfa.type == AutomatonType.DFA

    # Verify that initial DFA state is "{q0}"
    assert dfa.initial_state == "{q0}"

    # Verify DFA transition from {q0} on 0 leads to {q0,q1}
    assert dfa.transitions["{q0}"]["0"] == ["{q0,q1}"]
    # Verify DFA transition from {q0} on 1 leads to {q1,q2}
    assert dfa.transitions["{q0}"]["1"] == ["{q1,q2}"]

    # 4. Equivalence between NFA and constructed DFA
    eq_res = check_automata_equivalence(nfa, dfa)
    assert eq_res.is_equivalent is True
    assert eq_res.counterexample is None

def test_validation_rejects_malformed_and_duplicate_destinations():
    # Duplicate destinations in NFA
    bad_nfa = AutomatonModel(
        type=AutomatonType.NFA,
        states=["q0", "q1"],
        alphabet=["0"],
        initial_state="q0",
        accepting_states=["q1"],
        transitions={
            "q0": {"0": ["q1", "q1"]} # Duplicate!
        }
    )
    is_valid, errors = validate_automaton(bad_nfa)
    assert is_valid is False
    assert any("Duplicate" in err for err in errors)

    # Undefined destination in NFA
    bad_nfa2 = AutomatonModel(
        type=AutomatonType.NFA,
        states=["q0", "q1"],
        alphabet=["0"],
        initial_state="q0",
        accepting_states=["q1"],
        transitions={
            "q0": {"0": ["q0", "q_undefined"]}
        }
    )
    is_valid2, errors2 = validate_automaton(bad_nfa2)
    assert is_valid2 is False
    assert any("q_undefined" in err for err in errors2)

def test_single_two_three_destinations_and_self_loops():
    """
    Explicitly tests:
    - 1 destination
    - 2 destinations
    - 3 destinations
    - Empty transitions (∅)
    - Self-loops
    """
    nfa = AutomatonModel(
        type=AutomatonType.NFA,
        states=["s0", "s1", "s2"],
        alphabet=["a", "b", "c"],
        initial_state="s0",
        accepting_states=["s2"],
        transitions={
            # s0 on 'a': 3 destinations (s0 self-loop, s1, s2)
            "s0": {
                "a": ["s0", "s1", "s2"],
                "b": ["s0", "s1"],       # 2 destinations (s0 self-loop, s1)
                "c": ["s1"]               # 1 destination
            },
            # s1 on 'a': empty transition
            "s1": {
                "a": [],
                "b": ["s2"],
                "c": []
            },
            "s2": {
                "a": ["s2"],             # 1 destination self-loop
                "b": [],
                "c": ["s0"]
            }
        }
    )

    is_valid, errors = validate_automaton(nfa)
    assert is_valid is True, f"Validation errors: {errors}"

    # Test string "a": branches into {s0, s1, s2}. Contains s2 => ACCEPT
    sim_a = simulate_string(nfa, "a")
    assert sim_a.is_accepted is True
    assert set(sim_a.final_states) == {"s0", "s1", "s2"}

    # Test string "c": leads to {s1}. s1 is not accepting => REJECT
    sim_c = simulate_string(nfa, "c")
    assert sim_c.is_accepted is False
    assert set(sim_c.final_states) == {"s1"}

    # Test string "cb": s0 -c-> s1 -b-> s2 => ACCEPT
    sim_cb = simulate_string(nfa, "cb")
    assert sim_cb.is_accepted is True
    assert set(sim_cb.final_states) == {"s2"}

    # Test string "ca": s0 -c-> s1 -a-> ∅ (branch dies) => REJECT
    sim_ca = simulate_string(nfa, "ca")
    assert sim_ca.is_accepted is False
    assert set(sim_ca.final_states) == set()

    # NFA to DFA conversion
    conv = convert_to_dfa_subset_construction(nfa)
    assert conv.converted_automaton.type == AutomatonType.DFA

    # Transition from {s0} on 'a' must be {s0,s1,s2}
    assert conv.converted_automaton.transitions["{s0}"]["a"] == ["{s0,s1,s2}"]
    # Transition from {s0} on 'b' must be {s0,s1}
    assert conv.converted_automaton.transitions["{s0}"]["b"] == ["{s0,s1}"]

    # Equivalence
    eq = check_automata_equivalence(nfa, conv.converted_automaton)
    assert eq.is_equivalent is True

def test_transition_string_normalization():
    """Verifies that Pydantic model validator normalizes comma strings and ∅ symbols."""
    raw_data = {
        "type": "NFA",
        "states": ["q0", "q1", "q2"],
        "alphabet": ["0", "1"],
        "initial_state": "q0",
        "accepting_states": ["q2"],
        "transitions": {
            "q0": {
                "0": "q0, q1",       # comma string input
                "1": "q1,  q2 "      # spaces
            },
            "q1": {
                "0": "q2",           # single string input
                "1": "q0, q2"
            },
            "q2": {
                "0": "∅",            # empty symbol
                "1": ["q1"]
            }
        }
    }
    aut = AutomatonModel(**raw_data)
    assert aut.transitions["q0"]["0"] == ["q0", "q1"]
    assert aut.transitions["q0"]["1"] == ["q1", "q2"]
    assert aut.transitions["q1"]["0"] == ["q2"]
    assert aut.transitions["q2"]["0"] == []
    assert aut.transitions["q2"]["1"] == ["q1"]
