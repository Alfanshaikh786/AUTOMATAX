from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, model_validator
import time
from app.core.automaton_types import AutomatonType, ConversionAlgorithm, IssueSeverity, StepActionType

class VisualLayout(BaseModel):
    positions: Dict[str, Dict[str, float]] = Field(default_factory=dict, description="State ID to {x, y}")

class AutomatonModel(BaseModel):
    id: str = Field(default_factory=lambda: f"aut_{int(time.time()*1000)}")
    name: str = Field(default="Automaton")
    type: AutomatonType = Field(default=AutomatonType.DFA)
    states: List[str] = Field(default_factory=list)
    alphabet: List[str] = Field(default_factory=list)
    initial_state: str = Field(default="")
    accepting_states: List[str] = Field(default_factory=list)
    # transitions: { state: { symbol: [dest_states] } }
    transitions: Dict[str, Dict[str, List[str]]] = Field(default_factory=dict)
    # epsilon_transitions: { state: [dest_states] }
    epsilon_transitions: Dict[str, List[str]] = Field(default_factory=dict)
    layout: Optional[VisualLayout] = Field(default_factory=VisualLayout)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = ""
    created_at: float = Field(default_factory=time.time)

    def canonicalize(self) -> 'AutomatonModel':
        """Ensure states and alphabet lists are unique and deterministic."""
        clean_states = sorted(list(dict.fromkeys(self.states)))
        clean_alphabet = sorted([s for s in dict.fromkeys(self.alphabet) if s != "ε" and s != "e" and s != ""])
        clean_accepting = sorted(list(dict.fromkeys([s for s in self.accepting_states if s in clean_states])))
        
        clean_trans: Dict[str, Dict[str, List[str]]] = {}
        for s in clean_states:
            clean_trans[s] = {}
            if s in self.transitions:
                for sym, dests in self.transitions[s].items():
                    if sym in clean_alphabet:
                        clean_dests = sorted(list(dict.fromkeys([d for d in dests if d in clean_states])))
                        if clean_dests:
                            clean_trans[s][sym] = clean_dests

        clean_eps: Dict[str, List[str]] = {}
        if self.type == AutomatonType.ENFA:
            for s in clean_states:
                if s in self.epsilon_transitions:
                    clean_dests = sorted(list(dict.fromkeys([d for d in self.epsilon_transitions[s] if d in clean_states])))
                    if clean_dests:
                        clean_eps[s] = clean_dests

        return AutomatonModel(
            id=self.id,
            name=self.name,
            type=self.type,
            states=clean_states,
            alphabet=clean_alphabet,
            initial_state=self.initial_state if self.initial_state in clean_states else (clean_states[0] if clean_states else ""),
            accepting_states=clean_accepting,
            transitions=clean_trans,
            epsilon_transitions=clean_eps,
            layout=self.layout or VisualLayout(),
            metadata=self.metadata,
            description=self.description,
            created_at=self.created_at
        )

class ConversionStep(BaseModel):
    step_number: int
    action_type: StepActionType
    title: str
    description: str
    mathematical_explanation: str
    highlight_states: List[str] = Field(default_factory=list)
    highlight_transitions: List[Dict[str, str]] = Field(default_factory=list) # [{"from": "q0", "to": "q1", "symbol": "0"}]
    current_state_or_subset: Optional[Union[str, List[str]]] = None
    input_symbol: Optional[str] = None
    resulting_set: Optional[List[str]] = None
    table_snapshot: Optional[Dict[str, Any]] = None
    intermediate_automaton: Optional[AutomatonModel] = None

class TransitionComparisonRow(BaseModel):
    state: str
    symbol: str
    dfa_dest: str
    dfa_notation: str
    nfa_dest_set: List[str]
    nfa_notation: str
    is_singleton: bool
    explanation: str

class TestStringSimulation(BaseModel):
    input_string: str
    dfa_accepted: bool
    nfa_accepted: bool
    matches: bool
    dfa_final_states: List[str]
    nfa_final_states: List[str]

class DFAtoNFAVerification(BaseModel):
    is_equivalent: bool
    counterexample: Optional[str] = None
    explanation: str
    validation_passed: bool
    all_transitions_singleton: bool
    total_transitions_checked: int
    test_simulations: List[TestStringSimulation] = Field(default_factory=list)
    comparison_table: List[TransitionComparisonRow] = Field(default_factory=list)

class ConversionResponse(BaseModel):
    original_automaton: AutomatonModel
    converted_automaton: AutomatonModel
    algorithm: ConversionAlgorithm
    steps: List[ConversionStep] = Field(default_factory=list)
    summary: str
    execution_time_ms: float = 0.0
    verification: Optional[DFAtoNFAVerification] = None
    comparison_table: Optional[List[TransitionComparisonRow]] = None

class SimulationStep(BaseModel):
    step_index: int
    symbol: Optional[str]
    active_states: List[str]
    epsilon_expanded_states: Optional[List[str]] = None
    transitions_taken: List[Dict[str, Any]] = Field(default_factory=list)
    explanation: str

class SimulationResult(BaseModel):
    input_string: str
    is_accepted: bool
    is_valid_alphabet: bool
    final_states: List[str]
    steps: List[SimulationStep]
    error_message: Optional[str] = None

class BatchSimulationRequest(BaseModel):
    automaton: AutomatonModel
    test_strings: List[str]

class BatchSimulationResponse(BaseModel):
    results: List[SimulationResult]
    total: int
    accepted: int
    rejected: int
    invalid: int

class EquivalenceRequest(BaseModel):
    automaton_a: AutomatonModel
    automaton_b: AutomatonModel

class EquivalenceResponse(BaseModel):
    is_equivalent: bool
    counterexample: Optional[str] = None
    explanation: str
    trace_a: Optional[SimulationResult] = None
    trace_b: Optional[SimulationResult] = None
    details: Dict[str, Any] = Field(default_factory=dict)

class DebugFixAction(BaseModel):
    action_id: str
    title: str
    description: str
    patch_type: str # e.g. "REMOVE_STATE", "ADD_SINK_STATE", "MAKE_STATE_ACCEPTING", etc.
    parameters: Dict[str, Any] = Field(default_factory=dict)

class DebugIssue(BaseModel):
    id: str
    severity: IssueSeverity
    code: str
    title: str
    description: str
    mathematical_rationale: str
    affected_states: List[str] = Field(default_factory=list)
    affected_transitions: List[Dict[str, str]] = Field(default_factory=list)
    suggested_fix: Optional[DebugFixAction] = None

class DebugReport(BaseModel):
    automaton_id: str
    automaton_type: AutomatonType
    is_valid: bool
    error_count: int
    warning_count: int
    suggestion_count: int
    issues: List[DebugIssue]
    summary: str

