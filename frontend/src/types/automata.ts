export type AutomatonType = 'DFA' | 'NFA' | 'ENFA';

export interface VisualLayout {
  positions: Record<string, { x: number; y: number }>;
}

export interface AutomatonModel {
  id: string;
  name: string;
  type: AutomatonType;
  states: string[];
  alphabet: string[];
  initial_state: string;
  accepting_states: string[];
  transitions: Record<string, Record<string, string[]>>;
  epsilon_transitions: Record<string, string[]>;
  layout?: VisualLayout;
  metadata?: Record<string, any>;
  description?: string;
  created_at?: number;
}

export type StepActionType = 
  | 'INITIALIZE'
  | 'PARTITION'
  | 'EPSILON_CLOSURE'
  | 'SUBSET_EXPAND'
  | 'STATE_MERGE'
  | 'STATE_ELIMINATE'
  | 'FINALIZE';

export interface ConversionStep {
  step_number: number;
  action_type: StepActionType;
  title: string;
  description: string;
  mathematical_explanation: string;
  highlight_states: string[];
  highlight_transitions: Array<{ from: string; to: string; symbol: string }>;
  current_state_or_subset?: string | string[];
  input_symbol?: string;
  resulting_set?: string[];
  table_snapshot?: any;
  intermediate_automaton?: AutomatonModel;
}

export interface TransitionComparisonRow {
  state: string;
  symbol: string;
  dfa_dest: string;
  dfa_notation: string;
  nfa_dest_set: string[];
  nfa_notation: string;
  is_singleton: boolean;
  explanation: string;
}

export interface TestStringSimulation {
  input_string: string;
  dfa_accepted: boolean;
  nfa_accepted: boolean;
  matches: boolean;
  dfa_final_states: string[];
  nfa_final_states: string[];
}

export interface DFAtoNFAVerification {
  is_equivalent: boolean;
  counterexample?: string | null;
  explanation: string;
  validation_passed: boolean;
  all_transitions_singleton: boolean;
  total_transitions_checked: number;
  test_simulations: TestStringSimulation[];
  comparison_table: TransitionComparisonRow[];
}

export interface ConversionResponse {
  original_automaton: AutomatonModel;
  converted_automaton: AutomatonModel;
  algorithm: string;
  steps: ConversionStep[];
  summary: string;
  execution_time_ms: number;
  verification?: DFAtoNFAVerification;
  comparison_table?: TransitionComparisonRow[];
}

export interface SimulationStep {
  step_index: number;
  symbol: string | null;
  active_states: string[];
  epsilon_expanded_states?: string[];
  transitions_taken: Array<{ from: string; symbol: string; to: string }>;
  explanation: string;
}

export interface SimulationResult {
  input_string: string;
  is_accepted: boolean;
  is_valid_alphabet: boolean;
  final_states: string[];
  steps: SimulationStep[];
  error_message?: string | null;
}

export interface BatchSimulationResponse {
  results: SimulationResult[];
  total: number;
  accepted: number;
  rejected: number;
  invalid: number;
}

export interface EquivalenceResponse {
  is_equivalent: boolean;
  counterexample?: string | null;
  explanation: string;
  trace_a?: SimulationResult | null;
  trace_b?: SimulationResult | null;
  details: Record<string, any>;
}

export interface DebugIssue {
  id: string;
  severity: 'ERROR' | 'WARNING' | 'SUGGESTION';
  code: string;
  title: string;
  description: string;
  mathematical_rationale: string;
  affected_states: string[];
  affected_transitions: Array<{ from: string; to: string; symbol: string }>;
  suggested_fix?: {
    action_id: string;
    title: string;
    description: string;
    patch_type: string;
    parameters: Record<string, any>;
  };
}

export interface DebugReport {
  automaton_id: string;
  automaton_type: AutomatonType;
  is_valid: boolean;
  error_count: number;
  warning_count: number;
  suggestion_count: number;
  issues: DebugIssue[];
  summary: string;
}

export interface GrammarProduction {
  head: string;
  body: string;
}

export interface RightLinearGrammar {
  non_terminals: string[];
  terminals: string[];
  start_symbol: string;
  productions: GrammarProduction[];
  description?: string;
}

export interface Exercise {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  topic: string;
  description: string;
  formal_specification: string;
  alphabet: string[];
  hints: string[];
  sample_tests: Array<{ input: string; expected: boolean }>;
}

