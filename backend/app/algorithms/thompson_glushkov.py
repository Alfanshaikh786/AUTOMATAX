from typing import Dict, List, Set, Tuple, Optional, Any
from app.models.automaton import AutomatonModel
from app.models.regular_expression import RegexNode, RegexConversionResult
from app.core.automaton_types import AutomatonType
from app.algorithms.regex_parser import RegexParser
from app.core.exceptions import ConversionError

class ThompsonBuilder:
    def __init__(self):
        self.state_counter = 0

    def new_state(self) -> str:
        s = f"t{self.state_counter}"
        self.state_counter += 1
        return s

    def build(self, node: RegexNode) -> Tuple[AutomatonModel, List[Dict[str, Any]]]:
        steps: List[Dict[str, Any]] = []
        aut = self._build_recursive(node, steps)
        return aut, steps

    def _build_recursive(self, node: RegexNode, steps: List[Dict[str, Any]]) -> AutomatonModel:
        if node.type == 'SYMBOL':
            s_in = self.new_state()
            s_out = self.new_state()
            sym = node.value or ""
            aut = AutomatonModel(
                type=AutomatonType.ENFA,
                states=[s_in, s_out],
                alphabet=[sym],
                initial_state=s_in,
                accepting_states=[s_out],
                transitions={s_in: {sym: [s_out]}, s_out: {}},
                epsilon_transitions={s_in: [], s_out: []}
            )
            steps.append({
                "operation": "SYMBOL",
                "label": sym,
                "description": f"Construct base sub-automaton for literal symbol '{sym}': {s_in} --({sym})--> {s_out}",
                "states": [s_in, s_out]
            })
            return aut

        elif node.type == 'EPSILON':
            s_in = self.new_state()
            s_out = self.new_state()
            aut = AutomatonModel(
                type=AutomatonType.ENFA,
                states=[s_in, s_out],
                alphabet=[],
                initial_state=s_in,
                accepting_states=[s_out],
                transitions={s_in: {}, s_out: {}},
                epsilon_transitions={s_in: [s_out], s_out: []}
            )
            steps.append({
                "operation": "EPSILON",
                "label": "ε",
                "description": f"Construct base sub-automaton for epsilon 'ε': {s_in} --(ε)--> {s_out}",
                "states": [s_in, s_out]
            })
            return aut

        elif node.type == 'EMPTY':
            s_in = self.new_state()
            s_out = self.new_state()
            return AutomatonModel(
                type=AutomatonType.ENFA,
                states=[s_in, s_out],
                alphabet=[],
                initial_state=s_in,
                accepting_states=[s_out],
                transitions={s_in: {}, s_out: {}},
                epsilon_transitions={s_in: [], s_out: []}
            )

        elif node.type == 'UNION':
            left_aut = self._build_recursive(node.left, steps)
            right_aut = self._build_recursive(node.right, steps)

            s_in = self.new_state()
            s_out = self.new_state()

            all_states = [s_in] + left_aut.states + right_aut.states + [s_out]
            all_alpha = sorted(list(set(left_aut.alphabet).union(set(right_aut.alphabet))))

            trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
            eps: Dict[str, List[str]] = {s: [] for s in all_states}

            for s, s_map in left_aut.transitions.items():
                trans[s] = s_map
            for s, s_map in right_aut.transitions.items():
                trans[s] = s_map

            for s, d_list in left_aut.epsilon_transitions.items():
                eps[s] = list(d_list)
            for s, d_list in right_aut.epsilon_transitions.items():
                eps[s] = list(d_list)

            # Epsilon branches from new start to both sub-starts
            eps[s_in].extend([left_aut.initial_state, right_aut.initial_state])
            # Epsilon transitions from sub-finals to new final
            for f in left_aut.accepting_states:
                eps[f].append(s_out)
            for f in right_aut.accepting_states:
                eps[f].append(s_out)

            steps.append({
                "operation": "UNION",
                "label": "|",
                "description": f"Applied Union construction: created new start {s_in} branching to {left_aut.initial_state} and {right_aut.initial_state}, and joined finals to {s_out}.",
                "states": [s_in, s_out]
            })

            return AutomatonModel(
                type=AutomatonType.ENFA,
                states=all_states,
                alphabet=all_alpha,
                initial_state=s_in,
                accepting_states=[s_out],
                transitions=trans,
                epsilon_transitions=eps
            )

        elif node.type == 'CONCAT':
            left_aut = self._build_recursive(node.left, steps)
            right_aut = self._build_recursive(node.right, steps)

            all_states = left_aut.states + right_aut.states
            all_alpha = sorted(list(set(left_aut.alphabet).union(set(right_aut.alphabet))))

            trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
            eps: Dict[str, List[str]] = {s: [] for s in all_states}

            for s, s_map in left_aut.transitions.items():
                trans[s] = s_map
            for s, s_map in right_aut.transitions.items():
                trans[s] = s_map

            for s, d_list in left_aut.epsilon_transitions.items():
                eps[s] = list(d_list)
            for s, d_list in right_aut.epsilon_transitions.items():
                eps[s] = list(d_list)

            # Link left final states to right initial state
            for f in left_aut.accepting_states:
                eps[f].append(right_aut.initial_state)

            steps.append({
                "operation": "CONCAT",
                "label": "·",
                "description": f"Applied Concatenation: connected accepting state(s) of left operand to start state {right_aut.initial_state} via ε-transition.",
                "states": [left_aut.initial_state, right_aut.initial_state]
            })

            return AutomatonModel(
                type=AutomatonType.ENFA,
                states=all_states,
                alphabet=all_alpha,
                initial_state=left_aut.initial_state,
                accepting_states=right_aut.accepting_states,
                transitions=trans,
                epsilon_transitions=eps
            )

        elif node.type == 'STAR':
            inner_aut = self._build_recursive(node.left, steps)
            s_in = self.new_state()
            s_out = self.new_state()

            all_states = [s_in] + inner_aut.states + [s_out]
            trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in all_states}
            eps: Dict[str, List[str]] = {s: [] for s in all_states}

            for s, s_map in inner_aut.transitions.items():
                trans[s] = s_map
            for s, d_list in inner_aut.epsilon_transitions.items():
                eps[s] = list(d_list)

            # 1. Skip whole loop: s_in -> s_out
            eps[s_in].append(s_out)
            # 2. Enter inner: s_in -> inner_start
            eps[s_in].append(inner_aut.initial_state)
            # 3. Loopback & Exit from inner finals
            for f in inner_aut.accepting_states:
                eps[f].append(inner_aut.initial_state)
                eps[f].append(s_out)

            steps.append({
                "operation": "STAR",
                "label": "*",
                "description": f"Applied Kleene star construction: created new start {s_in} and final {s_out} with loopback from inner finals to {inner_aut.initial_state} and bypass to {s_out}.",
                "states": [s_in, s_out]
            })

            return AutomatonModel(
                type=AutomatonType.ENFA,
                states=all_states,
                alphabet=inner_aut.alphabet,
                initial_state=s_in,
                accepting_states=[s_out],
                transitions=trans,
                epsilon_transitions=eps
            )

        elif node.type == 'PLUS':
            # R+ is equivalent to R · R*
            concat_node = RegexNode(type='CONCAT', left=node.left, right=RegexNode(type='STAR', left=node.left))
            return self._build_recursive(concat_node, steps)

        elif node.type == 'OPTION':
            # R? is equivalent to R | ε
            union_node = RegexNode(type='UNION', left=node.left, right=RegexNode(type='EPSILON', value='ε'))
            return self._build_recursive(union_node, steps)

        else:
            raise ConversionError(f"Unsupported node type in regex: {node.type}")

def convert_regex_to_thompson(pattern: str) -> RegexConversionResult:
    parser = RegexParser(pattern)
    res = parser.parse()
    if not res.is_valid or not res.ast:
        raise ConversionError(f"Invalid regex: {res.error_message}")

    builder = ThompsonBuilder()
    aut, steps = builder.build(res.ast)
    aut.name = f"Thompson({pattern})"
    aut.description = f"Constructed via Thompson's construction from regex: {pattern}"

    return RegexConversionResult(
        regex=pattern,
        automaton=aut,
        steps=steps,
        summary=f"Thompson construction generated ε-NFA with {len(aut.states)} states and {len(steps)} sub-expressions."
    )

class GlushkovBuilder:
    def __init__(self):
        self.pos_counter = 1
        self.pos_to_symbol: Dict[int, str] = {}
        self.followpos: Dict[int, Set[int]] = {}

    def annotate(self, node: RegexNode):
        if node.type == 'SYMBOL':
            p = self.pos_counter
            self.pos_counter += 1
            node.position = p
            sym = node.value or ""
            self.pos_to_symbol[p] = sym
            self.followpos[p] = set()
            node.nullable = False
            node.firstpos = [p]
            node.lastpos = [p]
        elif node.type == 'EPSILON':
            node.nullable = True
            node.firstpos = []
            node.lastpos = []
        elif node.type == 'EMPTY':
            node.nullable = False
            node.firstpos = []
            node.lastpos = []
        elif node.type == 'UNION':
            self.annotate(node.left)
            self.annotate(node.right)
            node.nullable = node.left.nullable or node.right.nullable
            node.firstpos = sorted(list(set(node.left.firstpos).union(set(node.right.firstpos))))
            node.lastpos = sorted(list(set(node.left.lastpos).union(set(node.right.lastpos))))
        elif node.type == 'CONCAT':
            self.annotate(node.left)
            self.annotate(node.right)
            node.nullable = node.left.nullable and node.right.nullable
            if node.left.nullable:
                node.firstpos = sorted(list(set(node.left.firstpos).union(set(node.right.firstpos))))
            else:
                node.firstpos = node.left.firstpos

            if node.right.nullable:
                node.lastpos = sorted(list(set(node.left.lastpos).union(set(node.right.lastpos))))
            else:
                node.lastpos = node.right.lastpos

            # followpos update for concat: for each i in lastpos(left), followpos(i) includes firstpos(right)
            for i in node.left.lastpos:
                self.followpos[i].update(node.right.firstpos)

        elif node.type == 'STAR':
            self.annotate(node.left)
            node.nullable = True
            node.firstpos = node.left.firstpos
            node.lastpos = node.left.lastpos
            # followpos update for star: for each i in lastpos(left), followpos(i) includes firstpos(left)
            for i in node.left.lastpos:
                self.followpos[i].update(node.left.firstpos)

    def build_nfa(self, root: RegexNode) -> Tuple[AutomatonModel, Dict[str, Any]]:
        self.annotate(root)

        states = ["q0"] + [f"p{p}" for p in sorted(self.pos_to_symbol.keys())]
        alphabet = sorted(list(set(self.pos_to_symbol.values())))
        trans: Dict[str, Dict[str, List[str]]] = {s: {} for s in states}

        # Initial state q0 transitions to firstpos(root)
        for p in root.firstpos:
            sym = self.pos_to_symbol[p]
            dst = f"p{p}"
            if sym not in trans["q0"]:
                trans["q0"][sym] = []
            trans["q0"][sym].append(dst)

        # Transitions between positions using followpos
        for p, follow_set in self.followpos.items():
            src = f"p{p}"
            for f in sorted(list(follow_set)):
                sym = self.pos_to_symbol[f]
                dst = f"p{f}"
                if sym not in trans[src]:
                    trans[src][sym] = []
                trans[src][sym].append(dst)

        # Final states: all positions in lastpos(root), plus q0 if root is nullable
        accepting = [f"p{p}" for p in sorted(root.lastpos)]
        if root.nullable:
            accepting.append("q0")
        accepting.sort()

        table = {
            "firstpos": root.firstpos,
            "lastpos": root.lastpos,
            "nullable": root.nullable,
            "followpos": {f"p{p} ({self.pos_to_symbol[p]})": [f"p{f}" for f in sorted(list(fs))] for p, fs in self.followpos.items()}
        }

        aut = AutomatonModel(
            name="Glushkov NFA",
            type=AutomatonType.NFA,
            states=states,
            alphabet=alphabet,
            initial_state="q0",
            accepting_states=accepting,
            transitions=trans,
            epsilon_transitions={},
            description="Constructed via Glushkov's position-based method (no epsilon transitions)."
        )
        return aut, table

def convert_regex_to_glushkov(pattern: str) -> RegexConversionResult:
    parser = RegexParser(pattern)
    res = parser.parse()
    if not res.is_valid or not res.ast:
        raise ConversionError(f"Invalid regex: {res.error_message}")

    builder = GlushkovBuilder()
    aut, table = builder.build_nfa(res.ast)
    aut.name = f"Glushkov({pattern})"

    return RegexConversionResult(
        regex=pattern,
        automaton=aut,
        glushkov_table=table,
        summary=f"Glushkov construction generated direct NFA with {len(aut.states)} states and 0 epsilon transitions."
    )

