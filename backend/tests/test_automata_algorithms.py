import pytest
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType
from app.algorithms.epsilon_closure import compute_epsilon_closure
from app.algorithms.epsilon_elimination import convert_enfa_to_nfa
from app.algorithms.subset_construction import convert_to_dfa_subset_construction
from app.algorithms.minimization import minimize_dfa_hopcroft
from app.algorithms.equivalence import check_automata_equivalence
from app.simulation.simulator import simulate_string, batch_simulate
from app.algorithms.regex_parser import RegexParser
from app.algorithms.thompson_glushkov import convert_regex_to_thompson, convert_regex_to_glushkov
from app.algorithms.state_elimination import convert_automaton_to_regex
from app.algorithms.automata_operations import (
    operate_union, operate_intersection, operate_complement, operate_difference,
    operate_concatenation, operate_kleene_star, operate_reversal
)
from app.models.grammar import RightLinearGrammar, GrammarProduction
from app.algorithms.grammar_conversion import convert_grammar_to_nfa, validate_right_linear_grammar
from app.optimization.debugger import debug_automaton

def test_epsilon_closure_and_cycles():
    # Epsilon transitions: q0 -> q1, q1 -> q2, q2 -> q0 (cycle), q2 -> q3
    eps = {
        "q0": ["q1"],
        "q1": ["q2"],
        "q2": ["q0", "q3"],
        "q3": []
    }
    closure_q0, _ = compute_epsilon_closure("q0", eps)
    assert closure_q0 == {"q0", "q1", "q2", "q3"}

    closure_q3, _ = compute_epsilon_closure("q3", eps)
    assert closure_q3 == {"q3"}

def test_enfa_to_nfa_conversion():
    # ENFA accepting 'a' or 'b' via epsilon branches
    enfa = AutomatonModel(
        type=AutomatonType.ENFA,
        states=["q0", "q1", "q2"],
        alphabet=["a", "b"],
        initial_state="q0",
        accepting_states=["q1", "q2"],
        transitions={
            "q0": {},
            "q1": {"a": ["q1"]},
            "q2": {"b": ["q2"]}
        },
        epsilon_transitions={
            "q0": ["q1", "q2"]
        }
    )
    res = convert_enfa_to_nfa(enfa)
    nfa = res.converted_automaton
    assert nfa.type == AutomatonType.NFA
    assert len(nfa.epsilon_transitions) == 0
    # q0 should be accepting because ε-closure(q0) = {q0, q1, q2} which intersects F = {q1, q2}
    assert "q0" in nfa.accepting_states

def test_nfa_to_dfa_subset_construction():
    # NFA for strings ending with '01'
    nfa = AutomatonModel(
        type=AutomatonType.NFA,
        states=["q0", "q1", "q2"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q2"],
        transitions={
            "q0": {"0": ["q0", "q1"], "1": ["q0"]},
            "q1": {"1": ["q2"]}
        }
    )
    res = convert_to_dfa_subset_construction(nfa)
    dfa = res.converted_automaton
    assert dfa.type == AutomatonType.DFA

    # Test equivalence between original NFA and constructed DFA
    eq_res = check_automata_equivalence(nfa, dfa)
    assert eq_res.is_equivalent is True

def test_dfa_minimization_hopcroft():
    # Redundant DFA with equivalent states:
    # A DFA accepting strings of even length with redundant duplicate states
    dfa = AutomatonModel(
        type=AutomatonType.DFA,
        states=["A", "B", "C", "D"],
        alphabet=["0", "1"],
        initial_state="A",
        accepting_states=["A", "C"],
        transitions={
            "A": {"0": ["B"], "1": ["D"]},
            "C": {"0": ["B"], "1": ["D"]},
            "B": {"0": ["C"], "1": ["A"]},
            "D": {"0": ["C"], "1": ["A"]}
        }
    )
    res = minimize_dfa_hopcroft(dfa)
    min_dfa = res.converted_automaton
    # A and C are equivalent (even length accepting); B and D are equivalent (odd length non-accepting)
    # The minimal DFA must have exactly 2 states!
    assert len(min_dfa.states) == 2
    eq_res = check_automata_equivalence(dfa, min_dfa)
    assert eq_res.is_equivalent is True

def test_equivalence_counterexample():
    # dfa1 accepts strings ending in 0
    dfa1 = AutomatonModel(
        type=AutomatonType.DFA,
        states=["q0", "q1"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q1"],
        transitions={
            "q0": {"0": ["q1"], "1": ["q0"]},
            "q1": {"0": ["q1"], "1": ["q0"]}
        }
    )
    # dfa2 accepts strings ending in 1
    dfa2 = AutomatonModel(
        type=AutomatonType.DFA,
        states=["p0", "p1"],
        alphabet=["0", "1"],
        initial_state="p0",
        accepting_states=["p1"],
        transitions={
            "p0": {"0": ["p0"], "1": ["p1"]},
            "p1": {"0": ["p0"], "1": ["p1"]}
        }
    )
    eq_res = check_automata_equivalence(dfa1, dfa2)
    assert eq_res.is_equivalent is False
    assert eq_res.counterexample in ("0", "1")

def test_simulation_dfa_and_nfa():
    dfa = AutomatonModel(
        type=AutomatonType.DFA,
        states=["q0", "q1"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q0"],
        transitions={
            "q0": {"0": ["q1"], "1": ["q0"]},
            "q1": {"0": ["q0"], "1": ["q1"]}
        }
    )
    sim_accept = simulate_string(dfa, "010")
    assert sim_accept.is_accepted is True
    assert sim_accept.is_valid_alphabet is True

    sim_reject = simulate_string(dfa, "011")
    assert sim_reject.is_accepted is False

    sim_invalid = simulate_string(dfa, "012")
    assert sim_invalid.is_valid_alphabet is False

def test_regex_parser_thompson_glushkov():
    pattern = "(a|b)*abb"
    parser = RegexParser(pattern)
    parse_res = parser.parse()
    assert parse_res.is_valid is True

    th_res = convert_regex_to_thompson(pattern)
    assert th_res.automaton.type == AutomatonType.ENFA
    # Test simulation on Thompson ε-NFA
    assert simulate_string(th_res.automaton, "abb").is_accepted is True
    assert simulate_string(th_res.automaton, "ababb").is_accepted is True
    assert simulate_string(th_res.automaton, "ab").is_accepted is False

    gl_res = convert_regex_to_glushkov(pattern)
    assert gl_res.automaton.type == AutomatonType.NFA
    assert simulate_string(gl_res.automaton, "abb").is_accepted is True
    assert simulate_string(gl_res.automaton, "babb").is_accepted is True
    assert simulate_string(gl_res.automaton, "ba").is_accepted is False

def test_gnfa_state_elimination():
    dfa = AutomatonModel(
        type=AutomatonType.DFA,
        states=["q0", "q1"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q1"],
        transitions={
            "q0": {"0": ["q1"], "1": ["q0"]},
            "q1": {"0": ["q1"], "1": ["q0"]}
        }
    )
    res = convert_automaton_to_regex(dfa)
    assert res["regex"] != "∅"
    assert len(res["steps"]) > 0

def test_grammar_conversion_and_cfg_rejection():
    # Valid right-linear grammar: S -> 0A | 1S | ε, A -> 1S
    grammar = RightLinearGrammar(
        non_terminals=["S", "A"],
        terminals=["0", "1"],
        start_symbol="S",
        productions=[
            GrammarProduction(head="S", body="0A"),
            GrammarProduction(head="S", body="1S"),
            GrammarProduction(head="S", body="ε"),
            GrammarProduction(head="A", body="1S")
        ]
    )
    is_valid, err = validate_right_linear_grammar(grammar)
    assert is_valid is True

    res = convert_grammar_to_nfa(grammar)
    assert res.is_valid is True
    assert res.automaton is not None

    # Invalid non-right-linear CFG: S -> A B
    cfg_grammar = RightLinearGrammar(
        non_terminals=["S", "A", "B"],
        terminals=["0", "1"],
        start_symbol="S",
        productions=[
            GrammarProduction(head="S", body="AB")
        ]
    )
    is_cfg_valid, cfg_err = validate_right_linear_grammar(cfg_grammar)
    assert is_cfg_valid is False
    assert "CFG production rejected" in cfg_err

def test_automata_operations():
    # L(A): even number of 0s
    aut_a = AutomatonModel(
        type=AutomatonType.DFA,
        states=["a0", "a1"],
        alphabet=["0", "1"],
        initial_state="a0",
        accepting_states=["a0"],
        transitions={
            "a0": {"0": ["a1"], "1": ["a0"]},
            "a1": {"0": ["a0"], "1": ["a1"]}
        }
    )
    # L(B): even number of 1s
    aut_b = AutomatonModel(
        type=AutomatonType.DFA,
        states=["b0", "b1"],
        alphabet=["0", "1"],
        initial_state="b0",
        accepting_states=["b0"],
        transitions={
            "b0": {"0": ["b0"], "1": ["b1"]},
            "b1": {"0": ["b1"], "1": ["b0"]}
        }
    )

    # Complement of A should accept odd number of 0s
    comp_a = operate_complement(aut_a)
    assert simulate_string(comp_a, "0").is_accepted is True
    assert simulate_string(comp_a, "00").is_accepted is False

    # Intersection of A and B: even 0s AND even 1s
    inter = operate_intersection(aut_a, aut_b)
    assert simulate_string(inter, "0011").is_accepted is True
    assert simulate_string(inter, "011").is_accepted is False # odd 0s
    assert simulate_string(inter, "001").is_accepted is False  # odd 1s

def test_debugger_diagnostics():
    # Automaton with unreachable state and dead state
    faulty_aut = AutomatonModel(
        type=AutomatonType.DFA,
        states=["q0", "q1", "q_unreachable", "q_dead"],
        alphabet=["0", "1"],
        initial_state="q0",
        accepting_states=["q1"],
        transitions={
            "q0": {"0": ["q1"], "1": ["q_dead"]},
            "q1": {"0": ["q1"], "1": ["q0"]},
            "q_dead": {"0": ["q_dead"], "1": ["q_dead"]},
            "q_unreachable": {"0": ["q1"], "1": ["q0"]}
        }
    )
    report = debug_automaton(faulty_aut)
    issue_codes = [i.code for i in report.issues]
    assert "UNREACHABLE_STATE" in issue_codes
    assert "DEAD_STATE" in issue_codes
