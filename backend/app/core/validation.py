from typing import List, Tuple, Set, Dict
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType
from app.core.exceptions import ValidationError

def validate_automaton(aut: AutomatonModel, enforce_complete_dfa: bool = False) -> Tuple[bool, List[str]]:
    """
    Mathematically validates the finite automaton.
    Returns (is_valid, list_of_error_messages).
    """
    errors: List[str] = []

    # 1. State validation
    if not aut.states:
        errors.append("Automaton must have at least one state.")
        return False, errors

    state_set = set(aut.states)
    if len(state_set) != len(aut.states):
        errors.append("States must contain unique identifiers.")

    # 2. Initial state validation
    if not aut.initial_state:
        errors.append("Automaton must have an initial state specified.")
    elif aut.initial_state not in state_set:
        errors.append(f"Initial state '{aut.initial_state}' is not in the set of defined states.")

    # 3. Accepting states validation
    for acc in aut.accepting_states:
        if acc not in state_set:
            errors.append(f"Accepting state '{acc}' is not in the set of defined states.")

    # 4. Alphabet validation
    # Symbols must not be epsilon or empty
    alphabet_set = set(aut.alphabet)
    if "" in alphabet_set or "ε" in alphabet_set or "e" in alphabet_set:
        errors.append("Alphabet cannot contain empty string or epsilon as an ordinary input symbol.")

    # 5. Transitions validation
    for src, symbol_map in aut.transitions.items():
        if src not in state_set:
            errors.append(f"Transition source state '{src}' is not in the set of defined states.")
        if not isinstance(symbol_map, dict):
            errors.append(f"Transitions for state '{src}' must be a dictionary mapping symbols to destination state lists.")
            continue
        for sym, dests in symbol_map.items():
            if sym not in alphabet_set:
                errors.append(f"Transition symbol '{sym}' from state '{src}' is not in the defined alphabet.")
            if not isinstance(dests, list):
                errors.append(f"Transition destination for state '{src}' on symbol '{sym}' must be a list/array of states, not {type(dests).__name__}.")
                continue
            if len(dests) != len(set(dests)):
                errors.append(f"Duplicate destination states detected in transition from '{src}' on symbol '{sym}': {dests}.")
            for dst in dests:
                if dst not in state_set:
                    errors.append(f"Transition destination '{dst}' from state '{src}' on '{sym}' is not in states.")

    # 6. Epsilon transitions validation
    if aut.type in (AutomatonType.DFA, AutomatonType.NFA):
        if aut.epsilon_transitions and any(len(dests) > 0 for dests in aut.epsilon_transitions.values()):
            errors.append(f"{aut.type.value} cannot contain epsilon transitions. Use ENFA type instead.")
    else:
        for src, dests in aut.epsilon_transitions.items():
            if src not in state_set:
                errors.append(f"Epsilon transition source '{src}' is not in defined states.")
            if not isinstance(dests, list):
                errors.append(f"Epsilon destination for state '{src}' must be a list of states, not {type(dests).__name__}.")
                continue
            if len(dests) != len(set(dests)):
                errors.append(f"Duplicate epsilon destination states from state '{src}': {dests}.")
            for dst in dests:
                if dst not in state_set:
                    errors.append(f"Epsilon transition destination '{dst}' from '{src}' is not in defined states.")

    # 7. DFA determinism & completeness check
    if aut.type == AutomatonType.DFA:
        for src, symbol_map in aut.transitions.items():
            for sym, dests in symbol_map.items():
                if len(dests) > 1:
                    errors.append(f"DFA nondeterminism detected: State '{src}' has multiple destinations {dests} on symbol '{sym}'.")

        if enforce_complete_dfa:
            for s in aut.states:
                s_trans = aut.transitions.get(s, {})
                for sym in aut.alphabet:
                    if sym not in s_trans or len(s_trans[sym]) == 0:
                        errors.append(f"Incomplete DFA: State '{s}' has no transition defined for alphabet symbol '{sym}'.")

    return (len(errors) == 0, errors)

def assert_valid_automaton(aut: AutomatonModel, enforce_complete_dfa: bool = False):
    is_valid, errors = validate_automaton(aut, enforce_complete_dfa)
    if not is_valid:
        raise ValidationError("; ".join(errors), {"errors": errors})

