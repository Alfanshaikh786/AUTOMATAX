from typing import Dict, List, Set, Tuple, Optional
from collections import deque
from app.models.automaton import AutomatonModel
from app.core.automaton_types import AutomatonType
from app.algorithms.subset_construction import convert_to_dfa_subset_construction
from app.algorithms.minimization import complete_dfa
from app.algorithms.equivalence import to_complete_dfa_over_alphabet

def prefix_states(aut: AutomatonModel, prefix: str) -> AutomatonModel:
    """Prefixes state names to avoid collision when combining two automata."""
    p_states = [f"{prefix}_{s}" for s in aut.states]
    p_initial = f"{prefix}_{aut.initial_state}"
    p_accepting = [f"{prefix}_{s}" for s in aut.accepting_states]

    p_trans: Dict[str, Dict[str, List[str]]] = {}
    for s, sym_map in aut.transitions.items():
        p_trans[f"{prefix}_{s}"] = {
            sym: [f"{prefix}_{d}" for d in dests]
            for sym, dests in sym_map.items()
        }

    p_eps: Dict[str, List[str]] = {}
    for s, dests in aut.epsilon_transitions.items():
        p_eps[f"{prefix}_{s}"] = [f"{prefix}_{d}" for d in dests]

    return AutomatonModel(
        id=f"{prefix}_{aut.id}",
        name=aut.name,
        type=aut.type,
        states=p_states,
        alphabet=aut.alphabet,
        initial_state=p_initial,
        accepting_states=p_accepting,
        transitions=p_trans,
        epsilon_transitions=p_eps
    )

def operate_union(aut_a: AutomatonModel, aut_b: AutomatonModel) -> AutomatonModel:
    """Constructs an automaton accepting L(A) ∪ L(B)."""
    a = prefix_states(aut_a.canonicalize(), "A")
    b = prefix_states(aut_b.canonicalize(), "B")

    s0 = "start_union"
    while s0 in a.states or s0 in b.states:
        s0 = f"_{s0}"

    all_states = [s0] + a.states + b.states
    combined_alpha = sorted(list(set(a.alphabet).union(set(b.alphabet))))
    all_accepting = sorted(list(set(a.accepting_states).union(set(b.accepting_states))))

    trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
    eps: Dict[str, List[str]] = {s: [] for s in all_states}

    for s in a.states:
        trans[s] = a.transitions.get(s, {})
        eps[s] = list(a.epsilon_transitions.get(s, []))

    for s in b.states:
        trans[s] = b.transitions.get(s, {})
        eps[s] = list(b.epsilon_transitions.get(s, []))

    eps[s0] = [a.initial_state, b.initial_state]

    return AutomatonModel(
        name=f"({aut_a.name} ∪ {aut_b.name})",
        type=AutomatonType.ENFA,
        states=all_states,
        alphabet=combined_alpha,
        initial_state=s0,
        accepting_states=all_accepting,
        transitions=trans,
        epsilon_transitions=eps,
        description=f"Union of '{aut_a.name}' and '{aut_b.name}' accepting strings in either language."
    )

def operate_intersection(aut_a: AutomatonModel, aut_b: AutomatonModel) -> AutomatonModel:
    """
    Constructs an automaton accepting L(A) ∩ L(B)
    using Cartesian product construction on complete DFAs.
    """
    combined_alpha = sorted(list(set(aut_a.alphabet).union(set(aut_b.alphabet))))
    dfa_a = to_complete_dfa_over_alphabet(aut_a, combined_alpha)
    dfa_b = to_complete_dfa_over_alphabet(aut_b, combined_alpha)

    acc_a = set(dfa_a.accepting_states)
    acc_b = set(dfa_b.accepting_states)

    # Product BFS
    start_pair = (dfa_a.initial_state, dfa_b.initial_state)
    start_name = f"({start_pair[0]},{start_pair[1]})"

    pair_to_name: Dict[Tuple[str, str], str] = {start_pair: start_name}
    queue = deque([start_pair])

    states: List[str] = [start_name]
    accepting: List[str] = []
    transitions: Dict[str, Dict[str, List[str]]] = {}

    if start_pair[0] in acc_a and start_pair[1] in acc_b:
        accepting.append(start_name)

    while queue:
        p_curr = queue.popleft()
        curr_name = pair_to_name[p_curr]
        transitions[curr_name] = {}

        for sym in combined_alpha:
            dest_a = dfa_a.transitions.get(p_curr[0], {}).get(sym, [""])[0]
            dest_b = dfa_b.transitions.get(p_curr[1], {}).get(sym, [""])[0]

            p_dest = (dest_a, dest_b)
            if p_dest not in pair_to_name:
                dst_name = f"({dest_a},{dest_b})"
                pair_to_name[p_dest] = dst_name
                states.append(dst_name)
                queue.append(p_dest)

                if dest_a in acc_a and dest_b in acc_b:
                    accepting.append(dst_name)
            else:
                dst_name = pair_to_name[p_dest]

            transitions[curr_name][sym] = [dst_name]

    return AutomatonModel(
        name=f"({aut_a.name} ∩ {aut_b.name})",
        type=AutomatonType.DFA,
        states=states,
        alphabet=combined_alpha,
        initial_state=start_name,
        accepting_states=sorted(accepting),
        transitions=transitions,
        epsilon_transitions={},
        description=f"Intersection of '{aut_a.name}' and '{aut_b.name}' via product construction."
    )

def operate_complement(aut: AutomatonModel) -> AutomatonModel:
    r"""
    Constructs the complement automaton accepting Σ* \ L(aut).
    Requires completing the DFA first, then exchanging accepting and non-accepting states.
    """
    if aut.type in (AutomatonType.NFA, AutomatonType.ENFA):
        res = convert_to_dfa_subset_construction(aut)
        base_dfa = res.converted_automaton
    else:
        base_dfa = aut.canonicalize()

    completed_dfa, _ = complete_dfa(base_dfa)
    all_states = set(completed_dfa.states)
    orig_acc = set(completed_dfa.accepting_states)
    comp_acc = sorted(list(all_states - orig_acc))

    return AutomatonModel(
        name=f"Comp({aut.name})",
        type=AutomatonType.DFA,
        states=completed_dfa.states,
        alphabet=completed_dfa.alphabet,
        initial_state=completed_dfa.initial_state,
        accepting_states=comp_acc,
        transitions=completed_dfa.transitions,
        epsilon_transitions={},
        description=f"Complement of '{aut.name}' with swapped accepting states on complete DFA."
    )

def operate_difference(aut_a: AutomatonModel, aut_b: AutomatonModel) -> AutomatonModel:
    r"""
    Constructs an automaton accepting L(A) \ L(B) = L(A) ∩ L(B)^c.
    """
    comp_b = operate_complement(aut_b)
    diff_aut = operate_intersection(aut_a, comp_b)
    diff_aut.name = f"({aut_a.name} \\ {aut_b.name})"
    diff_aut.description = f"Difference L({aut_a.name}) \\ L({aut_b.name})."
    return diff_aut

def operate_concatenation(aut_a: AutomatonModel, aut_b: AutomatonModel) -> AutomatonModel:
    """
    Constructs an automaton accepting L(A) · L(B).
    Connects accepting states of A to initial state of B with ε-transitions.
    """
    a = prefix_states(aut_a.canonicalize(), "A")
    b = prefix_states(aut_b.canonicalize(), "B")

    all_states = a.states + b.states
    combined_alpha = sorted(list(set(a.alphabet).union(set(b.alphabet))))

    trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
    eps: Dict[str, List[str]] = {s: [] for s in all_states}

    for s in a.states:
        trans[s] = a.transitions.get(s, {})
        eps[s] = list(a.epsilon_transitions.get(s, []))

    for s in b.states:
        trans[s] = b.transitions.get(s, {})
        eps[s] = list(b.epsilon_transitions.get(s, []))

    # ε-transitions from A's accepting states to B's initial state
    for f in a.accepting_states:
        eps[f].append(b.initial_state)

    # Accepting states of result
    all_accepting = list(b.accepting_states)
    if b.initial_state in b.accepting_states:
        all_accepting.extend(a.accepting_states)

    all_accepting = sorted(list(set(all_accepting)))

    return AutomatonModel(
        name=f"({aut_a.name} · {aut_b.name})",
        type=AutomatonType.ENFA,
        states=all_states,
        alphabet=combined_alpha,
        initial_state=a.initial_state,
        accepting_states=all_accepting,
        transitions=trans,
        epsilon_transitions=eps,
        description=f"Concatenation of '{aut_a.name}' and '{aut_b.name}'."
    )

def operate_kleene_star(aut: AutomatonModel) -> AutomatonModel:
    """
    Constructs an automaton accepting L(aut)*.
    """
    base = prefix_states(aut.canonicalize(), "K")
    s0 = "start_star"
    while s0 in base.states:
        s0 = f"_{s0}"
    sf = "final_star"
    while sf in base.states or sf == s0:
        sf = f"_{sf}"

    all_states = [s0] + base.states + [sf]
    trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
    eps: Dict[str, List[str]] = {s: [] for s in all_states}

    for s in base.states:
        trans[s] = base.transitions.get(s, {})
        eps[s] = list(base.epsilon_transitions.get(s, []))

    # Epsilon transitions for Kleene star
    eps[s0].append(sf)               # Accept empty string ε
    eps[s0].append(base.initial_state) # Enter base automaton
    for f in base.accepting_states:
        eps[f].append(base.initial_state) # Loopback
        eps[f].append(sf)                 # Exit to final

    return AutomatonModel(
        name=f"({aut.name})*",
        type=AutomatonType.ENFA,
        states=all_states,
        alphabet=base.alphabet,
        initial_state=s0,
        accepting_states=[sf],
        transitions=trans,
        epsilon_transitions=eps,
        description=f"Kleene star closure of '{aut.name}'."
    )

def operate_reversal(aut: AutomatonModel) -> AutomatonModel:
    """
    Constructs an automaton accepting L(aut)^R (reversed strings).
    Reverses all transition arrows, swaps initial and accepting states.
    """
    base = aut.canonicalize()
    s0 = "rev_start"
    while s0 in base.states:
        s0 = f"_{s0}"

    all_states = [s0] + list(base.states)
    trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
    eps: Dict[str, List[str]] = {s: [] for s in all_states}

    # Reverse normal transitions: if u --(a)--> v, then v --(a)--> u
    for u, sym_map in base.transitions.items():
        for sym, dests in sym_map.items():
            for v in dests:
                if sym not in trans[v]:
                    trans[v][sym] = []
                trans[v][sym].append(u)

    # Reverse epsilon transitions
    for u, dests in base.epsilon_transitions.items():
        for v in dests:
            eps[v].append(u)

    # New start state branches to all original accepting states via ε
    eps[s0].extend(base.accepting_states)

    return AutomatonModel(
        name=f"Rev({aut.name})",
        type=AutomatonType.ENFA,
        states=all_states,
        alphabet=base.alphabet,
        initial_state=s0,
        accepting_states=[base.initial_state],
        transitions=trans,
        epsilon_transitions=eps,
        description=f"Reversal of '{aut.name}'."
    )
