from typing import Dict, List, Set, Union, Tuple
from collections import deque

def compute_epsilon_closure_single(
    state: str,
    epsilon_transitions: Dict[str, List[str]]
) -> Tuple[Set[str], List[Dict[str, str]]]:
    """
    Computes the epsilon-closure of a single state q.
    ε-closure(q) = { p | p is reachable from q by zero or more ε-transitions }.
    Returns (closure_set, step_trace).
    """
    closure: Set[str] = {state}
    queue = deque([state])
    trace: List[Dict[str, str]] = [
        {"action": "base", "from_state": state, "to_state": state, "explanation": f"Base case: {state} is in its own ε-closure."}
    ]

    while queue:
        current = queue.popleft()
        for dest in epsilon_transitions.get(current, []):
            if dest not in closure:
                closure.add(dest)
                queue.append(dest)
                trace.append({
                    "action": "expand",
                    "from_state": current,
                    "to_state": dest,
                    "explanation": f"Followed ε-transition from {current} to {dest}."
                })

    return closure, trace

def compute_epsilon_closure(
    states: Union[str, List[str], Set[str]],
    epsilon_transitions: Dict[str, List[str]]
) -> Tuple[Set[str], List[Dict[str, str]]]:
    """
    Computes the epsilon-closure of a set of states S.
    ε-closure(S) = union_{q in S} ε-closure(q).
    """
    if isinstance(states, str):
        state_list = [states]
    else:
        state_list = sorted(list(states))

    total_closure: Set[str] = set()
    combined_trace: List[Dict[str, str]] = []

    for s in state_list:
        sub_closure, sub_trace = compute_epsilon_closure_single(s, epsilon_transitions)
        total_closure.update(sub_closure)
        combined_trace.extend(sub_trace)

    return total_closure, combined_trace

