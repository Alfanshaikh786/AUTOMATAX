from typing import List, Dict, Set, Tuple, Optional
from app.models.grammar import RightLinearGrammar, GrammarProduction, GrammarConversionResponse
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType
from app.core.exceptions import GrammarParseError

def validate_right_linear_grammar(grammar: RightLinearGrammar) -> Tuple[bool, Optional[str]]:
    """
    Validates that the grammar is strictly a Right-Linear Regular Grammar:
    Every production must be of the form:
      A -> w B   (string of terminals w, followed by exactly one non-terminal B)
      A -> w     (string of terminals w)
      A -> ε
    Explicitly rejects general context-free productions (e.g. A -> B C or A -> a S b).
    """
    V = set(grammar.non_terminals)
    Sigma = set(grammar.terminals)

    if not grammar.start_symbol or grammar.start_symbol not in V:
        return False, f"Start symbol '{grammar.start_symbol}' is not in the set of non-terminals {V}."

    if V.intersection(Sigma):
        return False, f"Non-terminals and terminals must be disjoint. Overlap: {V.intersection(Sigma)}"

    for p in grammar.productions:
        if p.head not in V:
            return False, f"Production head '{p.head}' is not a defined non-terminal."

        body = p.body.strip()
        if body in ("ε", "λ", ""):
            # Valid: A -> ε
            continue

        # Check right-linear pattern
        # The body may end with a non-terminal in V, preceded by 0 or more terminals in Sigma;
        # OR consist entirely of terminals in Sigma.
        if len(body) > 1 and body[-1] in V:
            terminals_part = body[:-1]
            non_term_part = body[-1]
            for ch in terminals_part:
                if ch in V:
                    return False, (
                        f"CFG production rejected: '{p.head} -> {p.body}'. "
                        f"Non-terminal '{ch}' appears in non-rightmost position. "
                        f"Only Right-Linear regular grammars (A -> w B or A -> w) can be converted to finite automata."
                    )
                if ch not in Sigma:
                    return False, (
                        f"Invalid production '{p.head} -> {p.body}': Symbol '{ch}' is neither a defined terminal "
                        f"nor is this a valid right-linear production form (A -> wB or A -> w)."
                    )
        else:
            # Check if entire body is terminals
            for ch in body:
                if ch in V:
                    return False, (
                        f"CFG production rejected: '{p.head} -> {p.body}'. "
                        f"Non-terminal '{ch}' appears in non-rightmost position. "
                        f"Only Right-Linear regular grammars (A -> w B or A -> w) can be converted to finite automata."
                    )
                if ch not in Sigma:
                    return False, f"Symbol '{ch}' in production '{p.head} -> {p.body}' is not in defined terminals Σ."

    return True, None

def convert_grammar_to_nfa(grammar: RightLinearGrammar) -> GrammarConversionResponse:
    """
    Converts a valid right-linear grammar to an equivalent NFA/ε-NFA.
    Construction:
      - States: Non-terminals V, plus a dedicated final accepting state 'q_f'.
      - Initial state: Start symbol S.
      - Accepting states: {'q_f'}, plus any A where A -> ε is a production.
      - For A -> a B: transition δ(A, a) = B.
      - For A -> a: transition δ(A, a) = q_f.
      - For multi-character terminals A -> a1 a2 ... an B: chain intermediate states.
    """
    is_valid, err = validate_right_linear_grammar(grammar)
    if not is_valid:
        return GrammarConversionResponse(
            grammar=grammar,
            is_valid=False,
            error_message=err,
            automaton=None,
            steps=[],
            summary=f"Validation failed: {err}"
        )

    states = list(grammar.non_terminals)
    q_f = "q_f"
    while q_f in states:
        q_f = f"_{q_f}"

    states.append(q_f)
    accepting_states: Set[str] = {q_f}
    transitions: Dict[str, Dict[str, List[str]]] = {s: {} for s in states}
    epsilon_transitions: Dict[str, List[str]] = {s: [] for s in states}
    steps: List[Dict[str, Any]] = []

    intermediate_counter = 1

    for p in grammar.productions:
        body = p.body.strip()
        head = p.head

        if body in ("ε", "λ", ""):
            # A -> ε makes A an accepting state
            accepting_states.add(head)
            steps.append({
                "production": f"{head} -> ε",
                "action": f"Mark state '{head}' as accepting.",
                "description": f"Because {head} derives ε directly, {head} is marked as an accepting state."
            })
            continue

        # Case 1: A -> a B (single terminal followed by non-terminal)
        if len(body) >= 2 and body[-1] in grammar.non_terminals:
            terminal_part = body[:-1]
            target_nonterminal = body[-1]

            curr_state = head
            for i, ch in enumerate(terminal_part):
                if i == len(terminal_part) - 1:
                    next_s = target_nonterminal
                else:
                    next_s = f"q_aux_{intermediate_counter}"
                    intermediate_counter += 1
                    states.append(next_s)
                    transitions[next_s] = {}
                    epsilon_transitions[next_s] = []

                if ch not in transitions[curr_state]:
                    transitions[curr_state][ch] = []
                transitions[curr_state][ch].append(next_s)
                curr_state = next_s

            steps.append({
                "production": f"{head} -> {body}",
                "action": f"Add transition from '{head}' to '{target_nonterminal}' consuming '{terminal_part}'.",
                "description": f"Production {head} -> {body} corresponds to state transition on terminals."
            })

        # Case 2: A -> w (terminals only -> transitions into final state q_f)
        else:
            curr_state = head
            for i, ch in enumerate(body):
                if i == len(body) - 1:
                    next_s = q_f
                else:
                    next_s = f"q_aux_{intermediate_counter}"
                    intermediate_counter += 1
                    states.append(next_s)
                    transitions[next_s] = {}
                    epsilon_transitions[next_s] = []

                if ch not in transitions[curr_state]:
                    transitions[curr_state][ch] = []
                transitions[curr_state][ch].append(next_s)
                curr_state = next_s

            steps.append({
                "production": f"{head} -> {body}",
                "action": f"Add transition from '{head}' to final state '{q_f}' consuming '{body}'.",
                "description": f"Production {head} -> {body} terminates successfully in final state {q_f}."
            })

    aut = AutomatonModel(
        name=f"NFA from Grammar",
        type=AutomatonType.NFA,
        states=sorted(list(set(states))),
        alphabet=grammar.terminals,
        initial_state=grammar.start_symbol,
        accepting_states=sorted(list(accepting_states)),
        transitions=transitions,
        epsilon_transitions={},
        description="Constructed from Right-Linear Grammar."
    )

    return GrammarConversionResponse(
        grammar=grammar,
        is_valid=True,
        automaton=aut,
        steps=steps,
        summary=f"Successfully converted right-linear grammar into NFA with {len(aut.states)} states."
    )

def convert_nfa_to_grammar(automaton: AutomatonModel) -> RightLinearGrammar:
    """
    Converts a DFA or NFA into an equivalent Right-Linear Grammar.
    - Non-terminals: States of the automaton.
    - Terminals: Alphabet of the automaton.
    - Start symbol: Initial state.
    - Productions:
      * For transition δ(p, a) = q: add p -> a q
      * For accepting state f ∈ F: add f -> ε
    """
    aut = automaton.canonicalize()
    productions: List[GrammarProduction] = []

    # Transitions -> Productions
    for src, sym_map in aut.transitions.items():
        for sym, dests in sym_map.items():
            for dst in dests:
                productions.append(GrammarProduction(head=src, body=f"{sym}{dst}"))

    # Accepting states -> Epsilon productions
    for f in aut.accepting_states:
        productions.append(GrammarProduction(head=f, body="ε"))

    return RightLinearGrammar(
        non_terminals=aut.states,
        terminals=aut.alphabet,
        start_symbol=aut.initial_state,
        productions=productions,
        description=f"Generated right-linear regular grammar from {aut.type.value} '{aut.name}'."
    )
