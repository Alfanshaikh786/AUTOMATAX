import time
from app.models.automaton import AutomatonModel, ConversionResponse, ConversionStep
from app.core.automaton_types import AutomatonType, ConversionAlgorithm, StepActionType
from app.core.validation import assert_valid_automaton

def convert_dfa_to_nfa(dfa: AutomatonModel) -> ConversionResponse:
    """
    Converts a DFA to an equivalent NFA.
    Formal Basis:
      Every DFA is a special case of an NFA where the transition function
      δ: Q × Σ → Q is embedded into δ_NFA: Q × Σ → P(Q) such that
      δ_NFA(q, a) = { δ_DFA(q, a) } (a singleton set).
      States, alphabet, initial state, and accepting states are strictly preserved.
    """
    start_time = time.time()
    aut = dfa.canonicalize()
    assert_valid_automaton(aut)

    steps = [
        ConversionStep(
            step_number=1,
            action_type=StepActionType.INITIALIZE,
            title="DFA Subclass Embedding",
            description="A DFA is mathematically a deterministic specialization of an NFA.",
            mathematical_explanation=(
                f"1. States: Q_NFA = Q_DFA = {{{', '.join(aut.states)}}}\n"
                f"2. Alphabet: Σ_NFA = Σ_DFA = {{{', '.join(aut.alphabet)}}}\n"
                f"3. Initial State: q0 = {aut.initial_state}\n"
                f"4. Accepting States: F_NFA = F_DFA = {{{', '.join(aut.accepting_states) or '∅'}}}"
            ),
            highlight_states=aut.states
        ),
        ConversionStep(
            step_number=2,
            action_type=StepActionType.FINALIZE,
            title="Represent Transitions as Singleton Sets",
            description="Each transition δ(q, a) = p is represented as δ(q, a) = {p}.",
            mathematical_explanation=(
                "For every deterministic transition in the DFA, the destination set contains exactly one element:\n"
                "δ_NFA(q, a) = { δ_DFA(q, a) }.\n"
                "Because every singleton set is a valid element of the power set P(Q), the automaton is now a valid NFA."
            ),
            highlight_states=aut.accepting_states
        )
    ]

    converted = AutomatonModel(
        id=f"{aut.id}_nfa",
        name=f"{aut.name} (NFA)",
        type=AutomatonType.NFA,
        states=aut.states,
        alphabet=aut.alphabet,
        initial_state=aut.initial_state,
        accepting_states=aut.accepting_states,
        transitions=aut.transitions,
        epsilon_transitions={},
        layout=aut.layout,
        description=f"Converted from DFA '{aut.name}' into an NFA representation."
    )

    return ConversionResponse(
        original_automaton=aut,
        converted_automaton=converted,
        algorithm=ConversionAlgorithm.SUBSET_CONSTRUCTION,
        steps=steps,
        summary=f"Converted DFA '{aut.name}' to equivalent NFA representation.",
        execution_time_ms=(time.time() - start_time) * 1000.0
    )

def convert_dfa_or_nfa_to_enfa(automaton: AutomatonModel) -> ConversionResponse:
    """
    Converts a DFA or NFA into an equivalent ε-NFA with an empty epsilon-transition table.
    """
    start_time = time.time()
    aut = automaton.canonicalize()
    assert_valid_automaton(aut)

    steps = [
        ConversionStep(
            step_number=1,
            action_type=StepActionType.INITIALIZE,
            title="ε-NFA Embedding",
            description=f"Embed {aut.type.value} into ε-NFA format.",
            mathematical_explanation=(
                f"An ε-NFA is a 5-tuple M = (Q, Σ, δ, q0, F) where transitions on the empty string ε are permitted.\n"
                f"Embedding '{aut.name}' into an ε-NFA introduces the capability for ε-transitions without adding any spontaneous transitions:\n"
                f"∀ q ∈ Q, ε-transitions(q) = ∅."
            ),
            highlight_states=aut.states
        )
    ]

    converted = AutomatonModel(
        id=f"{aut.id}_enfa",
        name=f"{aut.name} (ε-NFA)",
        type=AutomatonType.ENFA,
        states=aut.states,
        alphabet=aut.alphabet,
        initial_state=aut.initial_state,
        accepting_states=aut.accepting_states,
        transitions=aut.transitions,
        epsilon_transitions={s: [] for s in aut.states},
        layout=aut.layout,
        description=f"Converted from {aut.type.value} '{aut.name}' into ε-NFA representation."
    )

    return ConversionResponse(
        original_automaton=aut,
        converted_automaton=converted,
        algorithm=ConversionAlgorithm.EPSILON_ELIMINATION,
        steps=steps,
        summary=f"Converted {aut.type.value} '{aut.name}' to equivalent ε-NFA with empty ε-transitions.",
        execution_time_ms=(time.time() - start_time) * 1000.0
    )

