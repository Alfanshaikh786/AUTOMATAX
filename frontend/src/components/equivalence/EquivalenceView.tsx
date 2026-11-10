import React, { useState, useMemo, useEffect } from 'react';
import { AutomatonModel } from '../../types/automata';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { api } from '../../services/api';
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Info,
  Save,
  Download,
  Loader2,
} from 'lucide-react';

interface EquivalenceViewProps {
  availableAutomata: AutomatonModel[];
  currentAutomaton: AutomatonModel;
  onLoadAutomaton?: (aut: AutomatonModel) => void;
}

export interface MatrixRow {
  rowNumber: number;
  pair: [string, string];
  pairLabel: string;
  isInitial: boolean;
  pairType1: 'FS' | 'IS';
  pairType2: 'FS' | 'IS';
  isMatch: boolean;
  transitions: Record<
    string,
    {
      nextPair: [string, string];
      nextPairLabel: string;
      nextType1: 'FS' | 'IS';
      nextType2: 'FS' | 'IS';
      isMatch: boolean;
      isNew: boolean;
      isDead: boolean;
    }
  >;
}

// Preset Academic Examples for DFA Equivalence
const PRESET_EQUIVALENCE_SAMPLES: Record<
  string,
  {
    name: string;
    description: string;
    expected: 'EQUIVALENT' | 'NOT_EQUIVALENT';
    dfa1: AutomatonModel;
    dfa2: AutomatonModel;
  }
> = {
  sample_notebook: {
    name: 'Textbook Example: 3-State vs 4-State Equivalent DFAs (Notebook)',
    description: 'Exact example from classroom TOC notes. DFA 1 has 3 states with q0 (start & final). DFA 2 has 4 states with q3 (start & final). Both accept identical languages.',
    expected: 'EQUIVALENT',
    dfa1: {
      id: 'eq_dfa1_notebook',
      name: 'DFA 1 (3-State with q₀ Final)',
      type: 'DFA',
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      initial_state: 'q0',
      accepting_states: ['q0'],
      transitions: {
        q0: { 'a': ['q0'], 'b': ['q1'] },
        q1: { 'a': ['q2'], 'b': ['q0'] },
        q2: { 'a': ['q1'], 'b': ['q2'] },
      },
      epsilon_transitions: {},
    },
    dfa2: {
      id: 'eq_dfa2_notebook',
      name: 'DFA 2 (4-State with q₃ Final)',
      type: 'DFA',
      states: ['q3', 'q4', 'q5', 'q6'],
      alphabet: ['a', 'b'],
      initial_state: 'q3',
      accepting_states: ['q3'],
      transitions: {
        q3: { 'a': ['q3'], 'b': ['q4'] },
        q4: { 'a': ['q5'], 'b': ['q3'] },
        q5: { 'a': ['q6'], 'b': ['q5'] },
        q6: { 'a': ['q5'], 'b': ['q3'] },
      },
      epsilon_transitions: {},
    },
  },
  sample_even0: {
    name: 'Equivalent: Even Number of 0s (2-State vs 4-State)',
    description: 'DFA 1 is the minimal 2-state DFA. DFA 2 is a 4-state DFA with redundant equivalent states.',
    expected: 'EQUIVALENT',
    dfa1: {
      id: 'eq_dfa1_even0',
      name: 'DFA 1 (Minimal Even-0s)',
      type: 'DFA',
      states: ['q0', 'q1'],
      alphabet: ['0', '1'],
      initial_state: 'q0',
      accepting_states: ['q0'],
      transitions: {
        q0: { '0': ['q1'], '1': ['q0'] },
        q1: { '0': ['q0'], '1': ['q1'] },
      },
      epsilon_transitions: {},
    },
    dfa2: {
      id: 'eq_dfa2_even0_4state',
      name: 'DFA 2 (4-State Even-0s)',
      type: 'DFA',
      states: ['A', 'B', 'C', 'D'],
      alphabet: ['0', '1'],
      initial_state: 'A',
      accepting_states: ['A', 'C', 'D'],
      transitions: {
        A: { '0': ['B'], '1': ['C'] },
        B: { '0': ['D'], '1': ['B'] },
        C: { '0': ['B'], '1': ['A'] },
        D: { '0': ['B'], '1': ['C'] },
      },
      epsilon_transitions: {},
    },
  },
  sample_ends01: {
    name: 'Equivalent: Strings Ending in "01" (3-State vs 4-State)',
    description: 'Both DFAs recognize the language of binary strings ending with the substring "01".',
    expected: 'EQUIVALENT',
    dfa1: {
      id: 'eq_dfa1_ends01',
      name: 'DFA 1 (3-State Ends in 01)',
      type: 'DFA',
      states: ['q0', 'q1', 'q2'],
      alphabet: ['0', '1'],
      initial_state: 'q0',
      accepting_states: ['q2'],
      transitions: {
        q0: { '0': ['q1'], '1': ['q0'] },
        q1: { '0': ['q1'], '1': ['q2'] },
        q2: { '0': ['q1'], '1': ['q0'] },
      },
      epsilon_transitions: {},
    },
    dfa2: {
      id: 'eq_dfa2_ends01_redundant',
      name: 'DFA 2 (4-State Ends in 01)',
      type: 'DFA',
      states: ['A', 'B', 'C', 'D'],
      alphabet: ['0', '1'],
      initial_state: 'A',
      accepting_states: ['C'],
      transitions: {
        A: { '0': ['B'], '1': ['A'] },
        B: { '0': ['B'], '1': ['C'] },
        C: { '0': ['D'], '1': ['A'] },
        D: { '0': ['B'], '1': ['C'] },
      },
      epsilon_transitions: {},
    },
  },
  sample_ends_diff: {
    name: 'Not Equivalent: Ending in 0 vs Ending in 1',
    description: 'DFA 1 accepts strings ending in 0. DFA 2 accepts strings ending in 1.',
    expected: 'NOT_EQUIVALENT',
    dfa1: {
      id: 'eq_dfa1_end0',
      name: 'DFA 1 (Ends in 0)',
      type: 'DFA',
      states: ['q0', 'q1'],
      alphabet: ['0', '1'],
      initial_state: 'q0',
      accepting_states: ['q1'],
      transitions: {
        q0: { '0': ['q1'], '1': ['q0'] },
        q1: { '0': ['q1'], '1': ['q0'] },
      },
      epsilon_transitions: {},
    },
    dfa2: {
      id: 'eq_dfa2_end1',
      name: 'DFA 2 (Ends in 1)',
      type: 'DFA',
      states: ['A', 'B'],
      alphabet: ['0', '1'],
      initial_state: 'A',
      accepting_states: ['B'],
      transitions: {
        A: { '0': ['A'], '1': ['B'] },
        B: { '0': ['A'], '1': ['B'] },
      },
      epsilon_transitions: {},
    },
  },
  sample_eps_diff: {
    name: 'Not Equivalent: Empty String Acceptance Mismatch',
    description: 'DFA 1 accepts the empty string ε (start state is final). DFA 2 requires at least one character.',
    expected: 'NOT_EQUIVALENT',
    dfa1: {
      id: 'eq_dfa1_eps',
      name: 'DFA 1 (Accepts ε)',
      type: 'DFA',
      states: ['q0', 'q1'],
      alphabet: ['a', 'b'],
      initial_state: 'q0',
      accepting_states: ['q0'],
      transitions: {
        q0: { 'a': ['q1'], 'b': ['q0'] },
        q1: { 'a': ['q1'], 'b': ['q1'] },
      },
      epsilon_transitions: {},
    },
    dfa2: {
      id: 'eq_dfa2_no_eps',
      name: 'DFA 2 (Rejects ε)',
      type: 'DFA',
      states: ['A', 'B'],
      alphabet: ['a', 'b'],
      initial_state: 'A',
      accepting_states: ['B'],
      transitions: {
        A: { 'a': ['B'], 'b': ['A'] },
        B: { 'a': ['B'], 'b': ['B'] },
      },
      epsilon_transitions: {},
    },
  },
};

export const EquivalenceView: React.FC<EquivalenceViewProps> = ({
  availableAutomata,
  currentAutomaton,
  onLoadAutomaton,
}) => {
  // Preset selector state: default to exact notebook example
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('sample_notebook');

  // DFA 1 and DFA 2 State Models
  const [dfa1, setDfa1] = useState<AutomatonModel>(PRESET_EQUIVALENCE_SAMPLES.sample_notebook.dfa1);
  const [dfa2, setDfa2] = useState<AutomatonModel>(PRESET_EQUIVALENCE_SAMPLES.sample_notebook.dfa2);

  // Form states for DFA 1
  const [newState1, setNewState1] = useState<string>('');
  const [newSym1, setNewSym1] = useState<string>('');
  const [newFinalState1, setNewFinalState1] = useState<string>('');
  const [delFinalState1, setDelFinalState1] = useState<string>('');
  const [transFrom1, setTransFrom1] = useState<string>('q0');
  const [transSym1, setTransSym1] = useState<string>('a');
  const [transTo1, setTransTo1] = useState<string>('q0');
  const [selectedDeleteTrans1, setSelectedDeleteTrans1] = useState<string>('');

  // Form states for DFA 2
  const [newState2, setNewState2] = useState<string>('');
  const [newSym2, setNewSym2] = useState<string>('');
  const [newFinalState2, setNewFinalState2] = useState<string>('');
  const [delFinalState2, setDelFinalState2] = useState<string>('');
  const [transFrom2, setTransFrom2] = useState<string>('q3');
  const [transSym2, setTransSym2] = useState<string>('a');
  const [transTo2, setTransTo2] = useState<string>('q3');
  const [selectedDeleteTrans2, setSelectedDeleteTrans2] = useState<string>('');

  // Option: Auto-complete missing transitions as non-accepting Dead State (∅)
  const [autoCompleteDeadState, setAutoCompleteDeadState] = useState<boolean>(true);

  // Interactive String Tester
  const [testString, setTestString] = useState<string>('ab');

  // Active / Highlighted Pair on Canvas
  const [highlightedPair, setHighlightedPair] = useState<[string, string] | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sync DFA 1 controls
  useEffect(() => {
    if (dfa1.states.length > 0) {
      if (!dfa1.states.includes(transFrom1)) setTransFrom1(dfa1.states[0]);
      if (!dfa1.states.includes(transTo1)) setTransTo1(dfa1.states[0]);
    } else {
      setTransFrom1('');
      setTransTo1('');
    }
    if (dfa1.alphabet.length > 0) {
      if (!dfa1.alphabet.includes(transSym1)) setTransSym1(dfa1.alphabet[0]);
    } else {
      setTransSym1('');
    }
  }, [dfa1.states, dfa1.alphabet, transFrom1, transTo1, transSym1]);

  // Sync DFA 2 controls
  useEffect(() => {
    if (dfa2.states.length > 0) {
      if (!dfa2.states.includes(transFrom2)) setTransFrom2(dfa2.states[0]);
      if (!dfa2.states.includes(transTo2)) setTransTo2(dfa2.states[0]);
    } else {
      setTransFrom2('');
      setTransTo2('');
    }
    if (dfa2.alphabet.length > 0) {
      if (!dfa2.alphabet.includes(transSym2)) setTransSym2(dfa2.alphabet[0]);
    } else {
      setTransSym2('');
    }
  }, [dfa2.states, dfa2.alphabet, transFrom2, transTo2, transSym2]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Compile list of transitions for delete dropdowns
  const dfa1TransitionList = useMemo(() => {
    const list: Array<{ from: string; symbol: string; dest: string }> = [];
    dfa1.states.forEach((s) => {
      dfa1.alphabet.forEach((sym) => {
        const d = dfa1.transitions[s]?.[sym]?.[0];
        if (d) list.push({ from: s, symbol: sym, dest: d });
      });
    });
    return list;
  }, [dfa1]);

  const dfa2TransitionList = useMemo(() => {
    const list: Array<{ from: string; symbol: string; dest: string }> = [];
    dfa2.states.forEach((s) => {
      dfa2.alphabet.forEach((sym) => {
        const d = dfa2.transitions[s]?.[sym]?.[0];
        if (d) list.push({ from: s, symbol: sym, dest: d });
      });
    });
    return list;
  }, [dfa2]);

  // Transition completeness metrics
  const dfa1RequiredTrans = dfa1.states.length * dfa1.alphabet.length;
  const dfa2RequiredTrans = dfa2.states.length * dfa2.alphabet.length;
  const isDfa1Complete = dfa1RequiredTrans > 0 && dfa1TransitionList.length === dfa1RequiredTrans;
  const isDfa2Complete = dfa2RequiredTrans > 0 && dfa2TransitionList.length === dfa2RequiredTrans;

  // Helper to load presets
  const handleLoadPreset = (key: string) => {
    const sample = PRESET_EQUIVALENCE_SAMPLES[key];
    if (sample) {
      setSelectedPresetKey(key);
      setDfa1(JSON.parse(JSON.stringify(sample.dfa1)));
      setDfa2(JSON.parse(JSON.stringify(sample.dfa2)));
      setFeedback({ type: 'success', text: `Loaded preset: ${sample.name}` });
    }
  };

  // Reset Individual DFAs
  const handleResetDfa1 = () => {
    setDfa1({
      id: `dfa1_${Date.now()}`,
      name: 'New DFA 1',
      type: 'DFA',
      states: ['q0'],
      alphabet: ['a', 'b'],
      initial_state: 'q0',
      accepting_states: [],
      transitions: {},
      epsilon_transitions: {},
    });
    setFeedback({ type: 'info', text: 'Reset DFA 1 to initial state q0.' });
  };

  const handleResetDfa2 = () => {
    setDfa2({
      id: `dfa2_${Date.now()}`,
      name: 'New DFA 2',
      type: 'DFA',
      states: ['q3'],
      alphabet: ['a', 'b'],
      initial_state: 'q3',
      accepting_states: [],
      transitions: {},
      epsilon_transitions: {},
    });
    setFeedback({ type: 'info', text: 'Reset DFA 2 to initial state q3.' });
  };

  // ==========================================
  // CORE STATE-PAIRING EQUIVALENCE ALGORITHM
  // (Produces the exact 2D table from user's notebook)
  // ==========================================
  const equivalenceResult = useMemo(() => {
    const combinedAlphabet = Array.from(
      new Set([...dfa1.alphabet, ...dfa2.alphabet])
    ).filter((s) => s !== 'ε').sort();

    const start1 = dfa1.initial_state;
    const start2 = dfa2.initial_state;

    // 1. Basic configuration checks
    if (!start1 || !start2 || dfa1.states.length === 0 || dfa2.states.length === 0) {
      return {
        isReady: false,
        status: 'incomplete_definition',
        isEquivalent: false,
        counterexample: null,
        distinguishingPair: null,
        matrixRows: [] as MatrixRow[],
        explanation: 'Please define states and start state for both DFA 1 and DFA 2.',
        combinedAlphabet,
        startMatch: false,
        start1Type: 'IS' as 'FS' | 'IS',
        start2Type: 'IS' as 'FS' | 'IS',
      };
    }

    // 2. Check if either DFA has 0 transitions defined
    const dfa1TransCount = dfa1TransitionList.length;
    const dfa2TransCount = dfa2TransitionList.length;

    if (dfa1TransCount === 0 || dfa2TransCount === 0) {
      const unconfigured =
        dfa1TransCount === 0 && dfa2TransCount === 0
          ? 'Both DFA 1 and DFA 2 have'
          : dfa1TransCount === 0
          ? 'DFA 1 has'
          : 'DFA 2 has';
      return {
        isReady: false,
        status: 'missing_transitions',
        isEquivalent: false,
        counterexample: null,
        distinguishingPair: null,
        matrixRows: [] as MatrixRow[],
        explanation: `Under Construction: ${unconfigured} no transitions defined yet. Please add transitions using the "Add Transition" form before equivalence can be verified.`,
        combinedAlphabet,
        startMatch: false,
        start1Type: 'IS' as 'FS' | 'IS',
        start2Type: 'IS' as 'FS' | 'IS',
      };
    }

    // 3. Check if neither DFA has any final states
    if (dfa1.accepting_states.length === 0 && dfa2.accepting_states.length === 0) {
      return {
        isReady: false,
        status: 'no_final_states',
        isEquivalent: false,
        counterexample: null,
        distinguishingPair: null,
        matrixRows: [] as MatrixRow[],
        explanation: 'Neither DFA has final states defined (F₁ = ∅, F₂ = ∅). Both DFAs currently reject all strings (Language L = ∅). Please add at least one final state using "Add Final State" to test language recognition.',
        combinedAlphabet,
        startMatch: false,
        start1Type: 'IS' as 'FS' | 'IS',
        start2Type: 'IS' as 'FS' | 'IS',
      };
    }

    // 4. Strict DFA mode check
    if (!autoCompleteDeadState && (!isDfa1Complete || !isDfa2Complete)) {
      return {
        isReady: false,
        status: 'strict_incomplete',
        isEquivalent: false,
        counterexample: null,
        distinguishingPair: null,
        matrixRows: [] as MatrixRow[],
        explanation: 'Strict Mode: Every state must have an exact transition defined for every alphabet symbol. Enable "Auto-Dead State (∅)" or complete all missing transitions.',
        combinedAlphabet,
        startMatch: false,
        start1Type: 'IS' as 'FS' | 'IS',
        start2Type: 'IS' as 'FS' | 'IS',
      };
    }

    const F1 = new Set(dfa1.accepting_states);
    const F2 = new Set(dfa2.accepting_states);

    // Total function lookup (missing transition routes to Dead State ∅)
    const getNextState = (aut: AutomatonModel, state: string, symbol: string): string => {
      if (state === '∅') return '∅';
      const dests = aut.transitions[state]?.[symbol]?.[0];
      return dests || '∅';
    };

    const isFinalState = (autId: 1 | 2, state: string): boolean => {
      if (state === '∅') return false;
      return autId === 1 ? F1.has(state) : F2.has(state);
    };

    // Step 1: Check Initial State & Final State Status
    const start1IsFinal = isFinalState(1, start1);
    const start2IsFinal = isFinalState(2, start2);
    const startMatch = start1IsFinal === start2IsFinal;
    const start1Type: 'FS' | 'IS' = start1IsFinal ? 'FS' : 'IS';
    const start2Type: 'FS' | 'IS' = start2IsFinal ? 'FS' : 'IS';

    if (!startMatch) {
      return {
        isReady: true,
        status: 'evaluated',
        isEquivalent: false,
        counterexample: 'ε',
        distinguishingPair: [start1, start2] as [string, string],
        matrixRows: [
          {
            rowNumber: 1,
            pair: [start1, start2] as [string, string],
            pairLabel: `(${start1}, ${start2})`,
            isInitial: true,
            pairType1: start1Type,
            pairType2: start2Type,
            isMatch: false,
            transitions: {},
          },
        ],
        explanation: `The DFAs are NOT equivalent to each other. Step 1 check fails: The initial state of DFA 1 (${start1}) is ${start1Type === 'FS' ? 'Final State (FS)' : 'Non-Final (IS)'}, but the initial state of DFA 2 (${start2}) is ${start2Type === 'FS' ? 'Final State (FS)' : 'Non-Final (IS)'}. Counterexample string: ε (empty string).`,
        combinedAlphabet,
        startMatch: false,
        start1Type,
        start2Type,
      };
    }

    // Step 2: 2D Transition State-Pair Table Construction (Notebook Method)
    const matrixRows: MatrixRow[] = [];
    const queue: Array<{ pair: [string, string]; path: string }> = [
      { pair: [start1, start2], path: '' },
    ];
    const visitedSet = new Set<string>();
    visitedSet.add(`${start1},${start2}`);

    let rowNum = 1;
    let foundMismatch = false;
    let mismatchPath = '';
    let mismatchPair: [string, string] | null = null;
    let mismatchExp = '';

    while (queue.length > 0) {
      const { pair: [p, q], path } = queue.shift()!;
      const isF1 = isFinalState(1, p);
      const isF2 = isFinalState(2, q);
      const currMatch = isF1 === isF2;

      const transMap: MatrixRow['transitions'] = {};

      for (const sym of combinedAlphabet) {
        const nextP = getNextState(dfa1, p, sym);
        const nextQ = getNextState(dfa2, q, sym);
        const nextF1 = isFinalState(1, nextP);
        const nextF2 = isFinalState(2, nextQ);
        const nextMatch = nextF1 === nextF2;
        const nextKey = `${nextP},${nextQ}`;
        const isNew = !visitedSet.has(nextKey);
        const nextPath = path + sym;

        transMap[sym] = {
          nextPair: [nextP, nextQ],
          nextPairLabel: `(${nextP}, ${nextQ})`,
          nextType1: nextF1 ? 'FS' : 'IS',
          nextType2: nextF2 ? 'FS' : 'IS',
          isMatch: nextMatch,
          isNew,
          isDead: nextP === '∅' || nextQ === '∅',
        };

        if (!nextMatch && !foundMismatch) {
          foundMismatch = true;
          mismatchPath = nextPath;
          mismatchPair = [nextP, nextQ];
          mismatchExp = `The DFAs are NOT equivalent to each other. Found distinguishing pair (${nextP}, ${nextQ}) on input string "${nextPath}". DFA ${nextF1 ? '1' : '2'} reaches final state (${nextF1 ? nextP : nextQ} ∈ F), whereas DFA ${nextF1 ? '2' : '1'} reaches non-final state (${nextF1 ? nextQ : nextP} ∉ F).`;
        }

        if (isNew && !foundMismatch) {
          visitedSet.add(nextKey);
          queue.push({ pair: [nextP, nextQ], path: nextPath });
        }
      }

      matrixRows.push({
        rowNumber: rowNum++,
        pair: [p, q],
        pairLabel: `(${p}, ${q})`,
        isInitial: p === start1 && q === start2,
        pairType1: isF1 ? 'FS' : 'IS',
        pairType2: isF2 ? 'FS' : 'IS',
        isMatch: currMatch,
        transitions: transMap,
      });

      if (foundMismatch) {
        break;
      }
    }

    if (foundMismatch) {
      return {
        isReady: true,
        status: 'evaluated',
        isEquivalent: false,
        counterexample: mismatchPath,
        distinguishingPair: mismatchPair,
        matrixRows,
        explanation: mismatchExp,
        combinedAlphabet,
        startMatch: true,
        start1Type,
        start2Type,
      };
    }

    return {
      isReady: true,
      status: 'evaluated',
      isEquivalent: true,
      counterexample: null,
      distinguishingPair: null,
      matrixRows,
      explanation: `Both the DFAs are equivalent to each other. Explored all ${visitedSet.size} reachable state pairs in the Cartesian cross-product. Every state pair evaluated shares identical acceptance types (FS with FS, or IS with IS) under all alphabet transitions.`,
      combinedAlphabet,
      startMatch: true,
      start1Type,
      start2Type,
    };
  }, [dfa1, dfa2, dfa1TransitionList, dfa2TransitionList, autoCompleteDeadState, isDfa1Complete, isDfa2Complete]);

  // Save & PDF Export states and handlers
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleSaveDfas = async () => {
    try {
      setIsSaving(true);
      const saved1 = await api.save(dfa1);
      const saved2 = await api.save(dfa2);
      if (onLoadAutomaton) onLoadAutomaton(saved1);
      setFeedback({
        type: 'success',
        text: `✓ Saved both '${saved1.name}' and '${saved2.name}' to storage successfully.`,
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: `Save Error: ${e.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const blob = await api.downloadEquivalencePdf({
        dfa1,
        dfa2,
        title: `${dfa1.name} vs ${dfa2.name} DFA Equivalence Verification Report`,
        matrix_rows: equivalenceResult.matrixRows,
        start_match: equivalenceResult.startMatch,
        is_equivalent: equivalenceResult.isEquivalent,
        counterexample: equivalenceResult.counterexample,
        explanation: equivalenceResult.explanation,
        notes: `Verification conducted via State-Pairing Cartesian Cross-Product BFS algorithm in AutomataX Equivalence Studio.`
      });

      const url = URL.createObjectURL(blob);
      const name1 = (dfa1.name || 'DFA1').replace(/\s+/g, '_');
      const name2 = (dfa2.name || 'DFA2').replace(/\s+/g, '_');
      const filename = `${name1}_vs_${name2}_equivalence_report.pdf`;
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Defer revocation so Chromium download thread has full window to read blob stream
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 60000);

      setFeedback({
        type: 'success',
        text: `✓ Downloaded '${filename}' successfully!`,
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: `PDF Generation Error: ${e.message}`,
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // ==========================================
  // CUSTOM STRING TRACE RUNNER
  // ==========================================
  const stringTraceResult = useMemo(() => {
    if (!testString && testString !== '') return null;

    const runTrace = (dfa: AutomatonModel, str: string) => {
      let curr = dfa.initial_state;
      const path: Array<{ state: string; symbol: string; nextState: string }> = [];

      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const next = dfa.transitions[curr]?.[char]?.[0] || '∅';
        path.push({ state: curr, symbol: char, nextState: next });
        curr = next;
      }

      const isAccepted = curr !== '∅' && dfa.accepting_states.includes(curr);
      return { path, finalState: curr, isAccepted };
    };

    const trace1 = runTrace(dfa1, testString);
    const trace2 = runTrace(dfa2, testString);
    const isSameVerdict = trace1.isAccepted === trace2.isAccepted;

    return { trace1, trace2, isSameVerdict, testString };
  }, [dfa1, dfa2, testString]);

  // ==========================================
  // MUTATION HANDLERS (DFA 1)
  // ==========================================
  const handleAddState1 = () => {
    const s = newState1.trim();
    if (!s) return;
    if (dfa1.states.includes(s)) {
      setFeedback({ type: 'error', text: `State "${s}" already exists in DFA 1.` });
      return;
    }
    setDfa1((prev) => ({
      ...prev,
      states: [...prev.states, s],
      initial_state: prev.initial_state ? prev.initial_state : s,
    }));
    setNewState1('');
  };

  const handleDeleteState1 = (s: string) => {
    if (!s) return;
    const newStates = dfa1.states.filter((st) => st !== s);
    const newAccepting = dfa1.accepting_states.filter((st) => st !== s);
    const newTrans: Record<string, Record<string, string[]>> = {};
    Object.entries(dfa1.transitions).forEach(([from, map]) => {
      if (from !== s) {
        newTrans[from] = {};
        Object.entries(map).forEach(([sym, dests]) => {
          const filtered = dests.filter((d) => d !== s);
          if (filtered.length > 0) newTrans[from][sym] = filtered;
        });
      }
    });
    setDfa1((prev) => ({
      ...prev,
      states: newStates,
      accepting_states: newAccepting,
      initial_state: prev.initial_state === s ? (newStates[0] || '') : prev.initial_state,
      transitions: newTrans,
    }));
    setFeedback({ type: 'info', text: `Deleted state "${s}" from DFA 1.` });
  };

  const handleAddSymbol1 = () => {
    const sym = newSym1.trim();
    if (!sym) return;
    if (dfa1.alphabet.includes(sym)) {
      setFeedback({ type: 'error', text: `Symbol "${sym}" already exists in DFA 1.` });
      return;
    }
    setDfa1((prev) => ({
      ...prev,
      alphabet: [...prev.alphabet, sym],
    }));
    setNewSym1('');
  };

  const handleDeleteSymbol1 = (sym: string) => {
    if (!sym) return;
    const newAlphabet = dfa1.alphabet.filter((x) => x !== sym);
    const newTrans: Record<string, Record<string, string[]>> = {};
    Object.entries(dfa1.transitions).forEach(([from, map]) => {
      newTrans[from] = {};
      Object.entries(map).forEach(([s, dests]) => {
        if (s !== sym) newTrans[from][s] = dests;
      });
    });
    setDfa1((prev) => ({
      ...prev,
      alphabet: newAlphabet,
      transitions: newTrans,
    }));
    setFeedback({ type: 'info', text: `Deleted symbol "${sym}" from DFA 1.` });
  };

  const handleAddFinalState1 = () => {
    if (!newFinalState1) return;
    if (dfa1.accepting_states.includes(newFinalState1)) return;
    setDfa1((prev) => ({
      ...prev,
      accepting_states: [...prev.accepting_states, newFinalState1],
    }));
    setFeedback({ type: 'success', text: `Added state "${newFinalState1}" to DFA 1 final states.` });
    setNewFinalState1('');
  };

  const handleDeleteFinalState1 = () => {
    if (!delFinalState1) return;
    setDfa1((prev) => ({
      ...prev,
      accepting_states: prev.accepting_states.filter((s) => s !== delFinalState1),
    }));
    setFeedback({ type: 'info', text: `Removed state "${delFinalState1}" from DFA 1 final states.` });
    setDelFinalState1('');
  };

  const handleAddTransition1 = () => {
    if (!transFrom1 || !transSym1 || !transTo1) return;
    setDfa1((prev) => {
      const nextTrans = { ...prev.transitions };
      if (!nextTrans[transFrom1]) nextTrans[transFrom1] = {};
      nextTrans[transFrom1][transSym1] = [transTo1];
      return { ...prev, transitions: nextTrans };
    });
    setFeedback({ type: 'success', text: `Added transition δ1(${transFrom1}, ${transSym1}) = ${transTo1}` });
  };

  const handleDeleteTransition1 = () => {
    if (!selectedDeleteTrans1) return;
    const parts = selectedDeleteTrans1.split('::');
    if (parts.length < 2) return;
    const [from, sym] = parts;
    setDfa1((prev) => {
      const nextTrans = { ...prev.transitions };
      if (nextTrans[from]) {
        const nextMap = { ...nextTrans[from] };
        delete nextMap[sym];
        nextTrans[from] = nextMap;
      }
      return { ...prev, transitions: nextTrans };
    });
    setFeedback({ type: 'info', text: `Deleted transition δ1(${from}, ${sym}) in DFA 1.` });
    setSelectedDeleteTrans1('');
  };

  // ==========================================
  // MUTATION HANDLERS (DFA 2)
  // ==========================================
  const handleAddState2 = () => {
    const s = newState2.trim();
    if (!s) return;
    if (dfa2.states.includes(s)) {
      setFeedback({ type: 'error', text: `State "${s}" already exists in DFA 2.` });
      return;
    }
    setDfa2((prev) => ({
      ...prev,
      states: [...prev.states, s],
      initial_state: prev.initial_state ? prev.initial_state : s,
    }));
    setNewState2('');
  };

  const handleDeleteState2 = (s: string) => {
    if (!s) return;
    const newStates = dfa2.states.filter((st) => st !== s);
    const newAccepting = dfa2.accepting_states.filter((st) => st !== s);
    const newTrans: Record<string, Record<string, string[]>> = {};
    Object.entries(dfa2.transitions).forEach(([from, map]) => {
      if (from !== s) {
        newTrans[from] = {};
        Object.entries(map).forEach(([sym, dests]) => {
          const filtered = dests.filter((d) => d !== s);
          if (filtered.length > 0) newTrans[from][sym] = filtered;
        });
      }
    });
    setDfa2((prev) => ({
      ...prev,
      states: newStates,
      accepting_states: newAccepting,
      initial_state: prev.initial_state === s ? (newStates[0] || '') : prev.initial_state,
      transitions: newTrans,
    }));
    setFeedback({ type: 'info', text: `Deleted state "${s}" from DFA 2.` });
  };

  const handleAddSymbol2 = () => {
    const sym = newSym2.trim();
    if (!sym) return;
    if (dfa2.alphabet.includes(sym)) {
      setFeedback({ type: 'error', text: `Symbol "${sym}" already exists in DFA 2.` });
      return;
    }
    setDfa2((prev) => ({
      ...prev,
      alphabet: [...prev.alphabet, sym],
    }));
    setNewSym2('');
  };

  const handleDeleteSymbol2 = (sym: string) => {
    if (!sym) return;
    const newAlphabet = dfa2.alphabet.filter((x) => x !== sym);
    const newTrans: Record<string, Record<string, string[]>> = {};
    Object.entries(dfa2.transitions).forEach(([from, map]) => {
      newTrans[from] = {};
      Object.entries(map).forEach(([s, dests]) => {
        if (s !== sym) newTrans[from][s] = dests;
      });
    });
    setDfa2((prev) => ({
      ...prev,
      alphabet: newAlphabet,
      transitions: newTrans,
    }));
    setFeedback({ type: 'info', text: `Deleted symbol "${sym}" from DFA 2.` });
  };

  const handleAddFinalState2 = () => {
    if (!newFinalState2) return;
    if (dfa2.accepting_states.includes(newFinalState2)) return;
    setDfa2((prev) => ({
      ...prev,
      accepting_states: [...prev.accepting_states, newFinalState2],
    }));
    setFeedback({ type: 'success', text: `Added state "${newFinalState2}" to DFA 2 final states.` });
    setNewFinalState2('');
  };

  const handleDeleteFinalState2 = () => {
    if (!delFinalState2) return;
    setDfa2((prev) => ({
      ...prev,
      accepting_states: prev.accepting_states.filter((s) => s !== delFinalState2),
    }));
    setFeedback({ type: 'info', text: `Removed state "${delFinalState2}" from DFA 2 final states.` });
    setDelFinalState2('');
  };

  const handleAddTransition2 = () => {
    if (!transFrom2 || !transSym2 || !transTo2) return;
    setDfa2((prev) => {
      const nextTrans = { ...prev.transitions };
      if (!nextTrans[transFrom2]) nextTrans[transFrom2] = {};
      nextTrans[transFrom2][transSym2] = [transTo2];
      return { ...prev, transitions: nextTrans };
    });
    setFeedback({ type: 'success', text: `Added transition δ2(${transFrom2}, ${transSym2}) = ${transTo2}` });
  };

  const handleDeleteTransition2 = () => {
    if (!selectedDeleteTrans2) return;
    const parts = selectedDeleteTrans2.split('::');
    if (parts.length < 2) return;
    const [from, sym] = parts;
    setDfa2((prev) => {
      const nextTrans = { ...prev.transitions };
      if (nextTrans[from]) {
        const nextMap = { ...nextTrans[from] };
        delete nextMap[sym];
        nextTrans[from] = nextMap;
      }
      return { ...prev, transitions: nextTrans };
    });
    setFeedback({ type: 'info', text: `Deleted transition δ2(${from}, ${sym}) in DFA 2.` });
    setSelectedDeleteTrans2('');
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-slate-950 text-slate-100 max-w-[1700px] mx-auto min-h-screen">
      {/* TOP HEADER BAR */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <GitCompare className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">DFA Equivalence Studio</h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-semibold">
                State-Pairing Cross-Product
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive dual DFA verification via Cartesian product BFS state reachability & counterexample search.
            </p>
          </div>
        </div>

        {/* Preset Selector & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-slate-400 font-medium">Preset:</span>
            <select
              value={selectedPresetKey}
              onChange={(e) => handleLoadPreset(e.target.value)}
              className="bg-slate-900 border border-slate-750 text-xs text-cyan-200 rounded px-2 py-1 outline-none font-medium"
            >
              {Object.entries(PRESET_EQUIVALENCE_SAMPLES).map(([key, sample]) => (
                <option key={key} value={key}>
                  {sample.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={autoCompleteDeadState}
              onChange={(e) => setAutoCompleteDeadState(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="font-semibold text-cyan-400 text-[11px]">Auto-Dead State (∅)</span>
          </label>

          {/* Save DFAs Button */}
          <button
            onClick={handleSaveDfas}
            disabled={isSaving}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow disabled:opacity-50"
            title="Save both DFA 1 and DFA 2 to persistent storage"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {/* Download Full Equivalence PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow disabled:opacity-50"
            title="Download full academic PDF report with specifications, Step 1, Step 2 state-pair matrix, and final verdict"
          >
            {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isDownloadingPdf ? 'Compiling PDF...' : 'Download PDF'}
          </button>

          <button
            onClick={() => handleLoadPreset(selectedPresetKey)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Samples
          </button>

          {onLoadAutomaton && (
            <button
              onClick={() => onLoadAutomaton(dfa1)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Load DFA 1 into Builder
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-950/60 border-rose-800 text-rose-200'
              : 'bg-cyan-950/60 border-cyan-800 text-cyan-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-75 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* ROW 1: DUAL DFA CREATOR PANELS & DEFINITIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DFA 1 CREATOR & FORMAL DEFINITION */}
        <div className="flex flex-col gap-4 bg-slate-900 border border-cyan-950/80 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" />
              <span>DFA 1 Definition & Controls</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-cyan-300">
                {dfa1.states.length} states · Σ: {'{' + dfa1.alphabet.join(', ') + '}'}
              </span>
              <button
                type="button"
                onClick={handleResetDfa1}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* DFA 1 Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Add State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add State</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="State name (e.g. q2)"
                  value={newState1}
                  onChange={(e) => setNewState1(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 outline-none focus:border-cyan-500 w-full font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddState1}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold text-white text-xs"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete State</label>
              <div className="flex gap-1.5">
                <select
                  value=""
                  onChange={(e) => handleDeleteState1(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa1.states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Symbol */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add Alphabet Symbol</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Symbol (e.g. 0, 1, a)"
                  value={newSym1}
                  onChange={(e) => setNewSym1(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 outline-none focus:border-cyan-500 w-full font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSymbol1}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded font-semibold text-white text-xs"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete Symbol */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Symbol</label>
              <div className="flex gap-1.5">
                <select
                  value=""
                  onChange={(e) => handleDeleteSymbol1(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa1.alphabet.map((sym) => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Start State (q₀₁)</label>
              <select
                value={dfa1.initial_state}
                onChange={(e) => setDfa1((prev) => ({ ...prev, initial_state: e.target.value }))}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-emerald-400 font-bold outline-none text-xs"
              >
                {dfa1.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Add Final State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add Final State</label>
              <div className="flex gap-1.5">
                <select
                  value={newFinalState1}
                  onChange={(e) => setNewFinalState1(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa1.states
                    .filter((s) => !dfa1.accepting_states.includes(s))
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddFinalState1}
                  disabled={!newFinalState1}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold text-xs disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete Final State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Final State</label>
              <div className="flex gap-1.5">
                <select
                  value={delFinalState1}
                  onChange={(e) => setDelFinalState1(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa1.accepting_states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDeleteFinalState1}
                  disabled={!delFinalState1}
                  className="px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded font-semibold text-xs disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Add Transition Form */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-cyan-400">
              Add Transition: δ₁(from, symbol) → to
            </span>
            <div className="flex items-center gap-2">
              <select
                value={transFrom1}
                onChange={(e) => setTransFrom1(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-slate-200 font-mono w-full"
              >
                {dfa1.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={transSym1}
                onChange={(e) => setTransSym1(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-cyan-300 font-bold font-mono w-24 text-center"
              >
                {dfa1.alphabet.map((sym) => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
              <span className="text-slate-500">→</span>
              <select
                value={transTo1}
                onChange={(e) => setTransTo1(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-slate-200 font-mono w-full"
              >
                {dfa1.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddTransition1}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-xs"
              >
                Add
              </button>
            </div>
          </div>

          {/* Delete Transition Form */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              Delete Transition
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedDeleteTrans1}
                onChange={(e) => setSelectedDeleteTrans1(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-slate-200 font-mono w-full"
              >
                <option value="">- Select Transition to Delete -</option>
                {dfa1TransitionList.map((t) => (
                  <option key={`${t.from}::${t.symbol}`} value={`${t.from}::${t.symbol}`}>
                    δ₁({t.from}, {t.symbol}) = {t.dest}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDeleteTransition1}
                disabled={!selectedDeleteTrans1}
                className="px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded font-semibold text-xs disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Formal Definition & Table Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Formal Definition */}
            <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 flex flex-col justify-between">
              <div>
                <span className="text-cyan-400 font-bold block mb-1">DFA 1 5-Tuple Definition:</span>
                <p>Q₁ = {'{' + dfa1.states.join(', ') + '}'}</p>
                <p>Σ₁ = {'{' + dfa1.alphabet.join(', ') + '}'}</p>
                <p>q₀₁ = {dfa1.initial_state || '∅'}</p>
                <p>F₁ = {'{' + (dfa1.accepting_states.join(', ') || '∅') + '}'}</p>
              </div>
              <div className="text-[10px] flex items-center justify-between mt-2 pt-1 border-t border-slate-800">
                <span className="text-slate-400">
                  Transitions: {dfa1TransitionList.length} / {dfa1RequiredTrans}
                </span>
                {isDfa1Complete ? (
                  <span className="text-emerald-400 font-semibold">Total Function ✓</span>
                ) : (
                  <span className="text-amber-400 font-semibold">
                    Incomplete ({dfa1RequiredTrans - dfa1TransitionList.length} missing)
                  </span>
                )}
              </div>
            </div>

            {/* DFA 1 Transition Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 max-h-40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    <th className="py-1 px-2.5">δ₁</th>
                    {dfa1.alphabet.map((sym) => (
                      <th key={sym} className="py-1 px-2.5 text-cyan-300 text-center">{sym}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dfa1.states.map((s) => (
                    <tr key={s} className="hover:bg-slate-900/50">
                      <td className="py-1 px-2.5 font-bold text-white">
                        {s === dfa1.initial_state && <span className="text-emerald-400 mr-0.5">→</span>}
                        {dfa1.accepting_states.includes(s) && <span className="text-red-400 mr-0.5">*</span>}
                        {s}
                      </td>
                      {dfa1.alphabet.map((sym) => {
                        const dest = dfa1.transitions[s]?.[sym]?.[0];
                        return (
                          <td
                            key={sym}
                            className={`py-1 px-2.5 text-center ${
                              dest ? 'text-cyan-300 font-bold' : 'text-amber-400/80 italic font-normal'
                            }`}
                          >
                            {dest || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* DFA 2 CREATOR & FORMAL DEFINITION */}
        <div className="flex flex-col gap-4 bg-slate-900 border border-purple-950/80 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-400" />
              <span>DFA 2 Definition & Controls</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-purple-300">
                {dfa2.states.length} states · Σ: {'{' + dfa2.alphabet.join(', ') + '}'}
              </span>
              <button
                type="button"
                onClick={handleResetDfa2}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
              >
                Reset
              </button>
            </div>
          </div>

          {/* DFA 2 Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Add State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add State</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="State name (e.g. C)"
                  value={newState2}
                  onChange={(e) => setNewState2(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 outline-none focus:border-purple-500 w-full font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddState2}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white text-xs"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete State</label>
              <div className="flex gap-1.5">
                <select
                  value=""
                  onChange={(e) => handleDeleteState2(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa2.states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Symbol */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add Alphabet Symbol</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Symbol (e.g. 0, 1, a)"
                  value={newSym2}
                  onChange={(e) => setNewSym2(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 outline-none focus:border-purple-500 w-full font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSymbol2}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white text-xs"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete Symbol */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Symbol</label>
              <div className="flex gap-1.5">
                <select
                  value=""
                  onChange={(e) => handleDeleteSymbol2(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa2.alphabet.map((sym) => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Start State (q₀₂)</label>
              <select
                value={dfa2.initial_state}
                onChange={(e) => setDfa2((prev) => ({ ...prev, initial_state: e.target.value }))}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-purple-400 font-bold outline-none text-xs"
              >
                {dfa2.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Add Final State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add Final State</label>
              <div className="flex gap-1.5">
                <select
                  value={newFinalState2}
                  onChange={(e) => setNewFinalState2(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa2.states
                    .filter((s) => !dfa2.accepting_states.includes(s))
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddFinalState2}
                  disabled={!newFinalState2}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold text-xs disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete Final State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Final State</label>
              <div className="flex gap-1.5">
                <select
                  value={delFinalState2}
                  onChange={(e) => setDelFinalState2(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-full font-mono text-xs"
                >
                  <option value="">- Select -</option>
                  {dfa2.accepting_states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDeleteFinalState2}
                  disabled={!delFinalState2}
                  className="px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded font-semibold text-xs disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Add Transition Form */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-purple-400">
              Add Transition: δ₂(from, symbol) → to
            </span>
            <div className="flex items-center gap-2">
              <select
                value={transFrom2}
                onChange={(e) => setTransFrom2(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-slate-200 font-mono w-full"
              >
                {dfa2.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={transSym2}
                onChange={(e) => setTransSym2(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-purple-300 font-bold font-mono w-24 text-center"
              >
                {dfa2.alphabet.map((sym) => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
              <span className="text-slate-500">→</span>
              <select
                value={transTo2}
                onChange={(e) => setTransTo2(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-slate-200 font-mono w-full"
              >
                {dfa2.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddTransition2}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-xs"
              >
                Add
              </button>
            </div>
          </div>

          {/* Delete Transition Form */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-400">
              Delete Transition
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedDeleteTrans2}
                onChange={(e) => setSelectedDeleteTrans2(e.target.value)}
                className="bg-slate-900 border border-slate-750 rounded px-2 py-1 text-xs text-slate-200 font-mono w-full"
              >
                <option value="">- Select Transition to Delete -</option>
                {dfa2TransitionList.map((t) => (
                  <option key={`${t.from}::${t.symbol}`} value={`${t.from}::${t.symbol}`}>
                    δ₂({t.from}, {t.symbol}) = {t.dest}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDeleteTransition2}
                disabled={!selectedDeleteTrans2}
                className="px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 rounded font-semibold text-xs disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Formal Definition & Table Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Formal Definition */}
            <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 flex flex-col justify-between">
              <div>
                <span className="text-purple-400 font-bold block mb-1">DFA 2 5-Tuple Definition:</span>
                <p>Q₂ = {'{' + dfa2.states.join(', ') + '}'}</p>
                <p>Σ₂ = {'{' + dfa2.alphabet.join(', ') + '}'}</p>
                <p>q₀₂ = {dfa2.initial_state || '∅'}</p>
                <p>F₂ = {'{' + (dfa2.accepting_states.join(', ') || '∅') + '}'}</p>
              </div>
              <div className="text-[10px] flex items-center justify-between mt-2 pt-1 border-t border-slate-800">
                <span className="text-slate-400">
                  Transitions: {dfa2TransitionList.length} / {dfa2RequiredTrans}
                </span>
                {isDfa2Complete ? (
                  <span className="text-emerald-400 font-semibold">Total Function ✓</span>
                ) : (
                  <span className="text-amber-400 font-semibold">
                    Incomplete ({dfa2RequiredTrans - dfa2TransitionList.length} missing)
                  </span>
                )}
              </div>
            </div>

            {/* DFA 2 Transition Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 max-h-40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    <th className="py-1 px-2.5">δ₂</th>
                    {dfa2.alphabet.map((sym) => (
                      <th key={sym} className="py-1 px-2.5 text-purple-300 text-center">{sym}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dfa2.states.map((s) => (
                    <tr key={s} className="hover:bg-slate-900/50">
                      <td className="py-1 px-2.5 font-bold text-white">
                        {s === dfa2.initial_state && <span className="text-emerald-400 mr-0.5">→</span>}
                        {dfa2.accepting_states.includes(s) && <span className="text-red-400 mr-0.5">*</span>}
                        {s}
                      </td>
                      {dfa2.alphabet.map((sym) => {
                        const dest = dfa2.transitions[s]?.[sym]?.[0];
                        return (
                          <td
                            key={sym}
                            className={`py-1 px-2.5 text-center ${
                              dest ? 'text-purple-300 font-bold' : 'text-amber-400/80 italic font-normal'
                            }`}
                          >
                            {dest || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: EQUIVALENCE VERDICT & TEXTBOOK STATE-PAIRING TABLE */}
      <div className="flex flex-col gap-4">
        {/* STEP 1: INITIAL STATE & FINAL STATE VERIFICATION */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px] border border-cyan-500/40">
                1
              </span>
              <span>Step 1: Initial State & Final State Status Check</span>
            </h4>
            {equivalenceResult.isReady && (
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                  equivalenceResult.startMatch
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                }`}
              >
                {equivalenceResult.startMatch ? 'Initial States Match (FS/IS) ✓' : 'Initial States Mismatch ✗'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400">DFA 1 Initial State: </span>
                <strong className="text-cyan-300">{dfa1.initial_state || '∅'}</strong>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  dfa1.accepting_states.includes(dfa1.initial_state)
                    ? 'bg-red-950/80 text-red-300 border border-red-800'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {dfa1.accepting_states.includes(dfa1.initial_state)
                  ? 'FS (Final State)'
                  : 'IS (Intermediate / Non-Final)'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400">DFA 2 Initial State: </span>
                <strong className="text-purple-300">{dfa2.initial_state || '∅'}</strong>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  dfa2.accepting_states.includes(dfa2.initial_state)
                    ? 'bg-red-950/80 text-red-300 border border-red-800'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {dfa2.accepting_states.includes(dfa2.initial_state)
                  ? 'FS (Final State)'
                  : 'IS (Intermediate / Non-Final)'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            {equivalenceResult.isReady
              ? equivalenceResult.startMatch
                ? `• Both initial states share identical acceptance status (${equivalenceResult.start1Type} & ${equivalenceResult.start2Type}). Proceed to Step 2 to compute state pairs under all alphabet symbols.`
                : `• Initial states differ on empty string ε. DFA ${equivalenceResult.start1Type === 'FS' ? '1' : '2'} accepts ε, whereas DFA ${equivalenceResult.start1Type === 'FS' ? '2' : '1'} rejects ε. Equivalence fails at Step 1.`
              : '• Please complete state, symbol, and transition configuration to verify initial states.'}
          </p>
        </div>

        {/* STEP 2: 2D TRANSITION STATE-PAIRING TABLE (EXACT NOTEBOOK FORMAT) */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px] border border-cyan-500/40">
                  2
                </span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Step 2: State-Pair Transition Table (Cartesian Product Matrix)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Starting from (q₀₁, q₀₂), explores each reachable pair of states on all alphabet symbols. For equivalence, every cell must match in status (FS with FS, or IS with IS).
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-red-300">
                <span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" />
                FS = Final State
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-slate-600 inline-block" />
                IS = Intermediate (Non-Final) State
              </span>
            </div>
          </div>

          {/* Table Container */}
          {!equivalenceResult.isReady ? (
            <div className="p-8 text-center bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <h4 className="font-bold text-slate-200 text-sm">{equivalenceResult.explanation}</h4>
              <p className="text-xs text-slate-400 max-w-md">
                Configure both DFAs using the controls above. Once transitions and final states are defined, the Cartesian cross-product evaluation table will automatically compute.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-300">
                  <tr>
                    <th className="py-2.5 px-4 w-48 border-r border-slate-800 text-cyan-400 font-bold">
                      State Pair
                    </th>
                    {equivalenceResult.combinedAlphabet.map((sym) => (
                      <th
                        key={sym}
                        className="py-2.5 px-4 text-center border-r border-slate-800 last:border-r-0 font-bold text-white text-sm"
                      >
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {equivalenceResult.matrixRows.map((row) => {
                    const isHovered =
                      highlightedPair &&
                      highlightedPair[0] === row.pair[0] &&
                      highlightedPair[1] === row.pair[1];

                    return (
                      <tr
                        key={row.rowNumber}
                        onMouseEnter={() => setHighlightedPair(row.pair)}
                        onMouseLeave={() => setHighlightedPair(null)}
                        className={`transition-colors cursor-pointer ${
                          isHovered ? 'bg-cyan-950/40' : 'hover:bg-slate-900/60'
                        }`}
                      >
                        {/* State Pair Column */}
                        <td className="py-3 px-4 font-bold border-r border-slate-800 bg-slate-900/40">
                          <div className="flex items-center gap-1.5 text-sm">
                            {row.isInitial && (
                              <span className="text-emerald-400 font-black text-base mr-0.5">⇒</span>
                            )}
                            <span className="text-cyan-300">{row.pair[0]}</span>
                            <span className="text-purple-300">{row.pair[1]}</span>
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            <span className={row.pairType1 === 'FS' ? 'text-red-400' : 'text-slate-400'}>
                              {row.pairType1}
                            </span>{' '}
                            <span className={row.pairType2 === 'FS' ? 'text-red-400' : 'text-slate-400'}>
                              {row.pairType2}
                            </span>
                          </div>
                        </td>

                        {/* Transitions for each symbol */}
                        {equivalenceResult.combinedAlphabet.map((sym) => {
                          const trans = row.transitions[sym];
                          if (!trans) {
                            return (
                              <td key={sym} className="py-3 px-4 text-center border-r border-slate-800 last:border-r-0 text-slate-600">
                                —
                              </td>
                            );
                          }

                          const isMismatch = !trans.isMatch;

                          return (
                            <td
                              key={sym}
                              className={`py-3 px-4 text-center border-r border-slate-800 last:border-r-0 transition-colors ${
                                isMismatch ? 'bg-rose-950/50' : ''
                              }`}
                            >
                              {/* Next Pair Label */}
                              <div className="font-bold text-sm flex items-center justify-center gap-1.5">
                                <span className={isMismatch ? 'text-rose-300 font-black' : 'text-cyan-200'}>
                                  {trans.nextPair[0]}
                                </span>
                                <span className={isMismatch ? 'text-rose-300 font-black' : 'text-purple-200'}>
                                  {trans.nextPair[1]}
                                </span>
                              </div>

                              {/* Classification FS/IS (Exactly as written in textbook notes) */}
                              <div className="mt-1 flex items-center justify-center gap-1.5">
                                <span
                                  className={`text-[11px] font-bold tracking-wider ${
                                    isMismatch
                                      ? 'text-rose-400 font-black'
                                      : trans.nextType1 === 'FS'
                                      ? 'text-red-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {trans.nextType1} {trans.nextType2}
                                </span>

                                {trans.isNew && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-sans">
                                    New
                                  </span>
                                )}

                                {isMismatch && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300 font-sans font-bold animate-pulse">
                                    MISMATCH ✗
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* STEP 3: FINAL VERDICT (EXACT NOTEBOOK CONCLUSION) */}
        {equivalenceResult.isReady && (
          <div
            className={`p-6 rounded-2xl border shadow-2xl flex flex-col items-center justify-center gap-2 text-center transition-all ${
              equivalenceResult.isEquivalent
                ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border-emerald-800 text-emerald-100'
                : 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/40 border-rose-800 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-3">
              {equivalenceResult.isEquivalent ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-400" />
              )}
              <h3 className="text-xl font-black tracking-tight">
                {equivalenceResult.isEquivalent
                  ? 'Both the DFAs are equivalent to each other'
                  : 'The DFAs are NOT equivalent to each other'}
              </h3>
            </div>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed mt-1 font-sans">
              {equivalenceResult.explanation}
            </p>

            {!equivalenceResult.isEquivalent && equivalenceResult.counterexample && (
              <div className="mt-2 flex items-center gap-2 bg-slate-950/90 border border-rose-700/80 px-4 py-1.5 rounded-xl font-mono text-xs">
                <span className="text-rose-400 font-semibold uppercase">Shortest Distinguishing String:</span>
                <span className="text-white font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-600">
                  {equivalenceResult.counterexample === '' ? 'ε (empty string)' : `"${equivalenceResult.counterexample}"`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* STRING SIMULATOR TEST BAR */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span>Verify Arbitrary String Execution on Both DFAs</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Tests whether w ∈ L(DFA 1) and w ∈ L(DFA 2) give matching verdicts
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Enter test string e.g. aab, bba"
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-cyan-500 w-72"
            />
            {equivalenceResult.counterexample && (
              <button
                type="button"
                onClick={() => setTestString(equivalenceResult.counterexample || '')}
                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 rounded text-xs font-mono transition"
              >
                Insert Counterexample: "{equivalenceResult.counterexample}"
              </button>
            )}
          </div>

          {stringTraceResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs mt-1">
              {/* DFA 1 Result */}
              <div
                className={`p-3 rounded-xl border ${
                  stringTraceResult.trace1.isAccepted
                    ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-bold text-cyan-400 mb-1">DFA 1 Execution:</div>
                <div>End State: {stringTraceResult.trace1.finalState}</div>
                <div className="font-bold mt-1">
                  Verdict: {stringTraceResult.trace1.isAccepted ? 'ACCEPTED' : 'REJECTED'}
                </div>
              </div>

              {/* DFA 2 Result */}
              <div
                className={`p-3 rounded-xl border ${
                  stringTraceResult.trace2.isAccepted
                    ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-bold text-purple-400 mb-1">DFA 2 Execution:</div>
                <div>End State: {stringTraceResult.trace2.finalState}</div>
                <div className="font-bold mt-1">
                  Verdict: {stringTraceResult.trace2.isAccepted ? 'ACCEPTED' : 'REJECTED'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: SIDE-BY-SIDE GRAPH VISUALIZERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DFA 1 Canvas */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>DFA 1 Graph Visualizer</span>
            </h3>
            <span className="text-[10px] text-cyan-400 font-mono">
              {dfa1.states.length} states · {dfa1TransitionList.length} transitions
            </span>
          </div>
          <div className="h-[460px] w-full">
            <AutomataCanvas
              automaton={dfa1}
              highlightStates={highlightedPair ? [highlightedPair[0]] : []}
            />
          </div>
        </div>

        {/* DFA 2 Canvas */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span>DFA 2 Graph Visualizer</span>
            </h3>
            <span className="text-[10px] text-purple-400 font-mono">
              {dfa2.states.length} states · {dfa2TransitionList.length} transitions
            </span>
          </div>
          <div className="h-[460px] w-full">
            <AutomataCanvas
              automaton={dfa2}
              highlightStates={highlightedPair ? [highlightedPair[1]] : []}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
