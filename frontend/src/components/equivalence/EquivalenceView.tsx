import React, { useState, useMemo, useEffect } from 'react';
import { AutomatonModel } from '../../types/automata';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';

interface EquivalenceViewProps {
  availableAutomata: AutomatonModel[];
  currentAutomaton: AutomatonModel;
  onLoadAutomaton?: (aut: AutomatonModel) => void;
}

export interface PairingStep {
  step: number;
  currentPair: [string, string];
  currentPairLabel: string;
  isFinal1: boolean;
  isFinal2: boolean;
  pairStatus: 'both_final' | 'both_non_final' | 'mismatch';
  symbol: string;
  nextPair: [string, string];
  nextPairLabel: string;
  nextIsFinal1: boolean;
  nextIsFinal2: boolean;
  nextPairStatus: 'both_final' | 'both_non_final' | 'mismatch';
  isNewDiscovery: boolean;
  path: string;
  note: string;
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
  // Preset selector state
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('sample_even0');

  // DFA 1 and DFA 2 State Models
  const [dfa1, setDfa1] = useState<AutomatonModel>(PRESET_EQUIVALENCE_SAMPLES.sample_even0.dfa1);
  const [dfa2, setDfa2] = useState<AutomatonModel>(PRESET_EQUIVALENCE_SAMPLES.sample_even0.dfa2);

  // Form states for DFA 1
  const [newState1, setNewState1] = useState<string>('');
  const [newSym1, setNewSym1] = useState<string>('');
  const [newFinalState1, setNewFinalState1] = useState<string>('');
  const [delFinalState1, setDelFinalState1] = useState<string>('');
  const [transFrom1, setTransFrom1] = useState<string>('q0');
  const [transSym1, setTransSym1] = useState<string>('0');
  const [transTo1, setTransTo1] = useState<string>('q0');
  const [selectedDeleteTrans1, setSelectedDeleteTrans1] = useState<string>('');

  // Form states for DFA 2
  const [newState2, setNewState2] = useState<string>('');
  const [newSym2, setNewSym2] = useState<string>('');
  const [newFinalState2, setNewFinalState2] = useState<string>('');
  const [delFinalState2, setDelFinalState2] = useState<string>('');
  const [transFrom2, setTransFrom2] = useState<string>('A');
  const [transSym2, setTransSym2] = useState<string>('0');
  const [transTo2, setTransTo2] = useState<string>('A');
  const [selectedDeleteTrans2, setSelectedDeleteTrans2] = useState<string>('');

  // Option: Auto-complete missing transitions as non-accepting Dead State (∅)
  const [autoCompleteDeadState, setAutoCompleteDeadState] = useState<boolean>(true);

  // Interactive String Tester
  const [testString, setTestString] = useState<string>('00');

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
      alphabet: ['0', '1'],
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
      states: ['A'],
      alphabet: ['0', '1'],
      initial_state: 'A',
      accepting_states: [],
      transitions: {},
      epsilon_transitions: {},
    });
    setFeedback({ type: 'info', text: 'Reset DFA 2 to initial state A.' });
  };

  // ==========================================
  // CORE STATE-PAIRING EQUIVALENCE ALGORITHM
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
        pairingSteps: [] as PairingStep[],
        uniquePairsDiscovered: [] as [string, string][],
        explanation: 'Please define states and start state for both DFA 1 and DFA 2.',
        combinedAlphabet,
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
        pairingSteps: [] as PairingStep[],
        uniquePairsDiscovered: [] as [string, string][],
        explanation: `Under Construction: ${unconfigured} no transitions defined yet. Please add transitions using the "Add Transition" form before equivalence can be verified.`,
        combinedAlphabet,
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
        pairingSteps: [] as PairingStep[],
        uniquePairsDiscovered: [] as [string, string][],
        explanation: 'Neither DFA has final states defined (F₁ = ∅, F₂ = ∅). Both DFAs currently reject all strings (Language L = ∅). Please add at least one final state using "Add Final State" to test language recognition.',
        combinedAlphabet,
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
        pairingSteps: [] as PairingStep[],
        uniquePairsDiscovered: [] as [string, string][],
        explanation: 'Strict Mode: Every state must have an exact transition defined for every alphabet symbol. Enable "Auto-complete Missing Transitions with Dead State (∅)" or complete all missing transitions.',
        combinedAlphabet,
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

    const getPairStatus = (
      s1: string,
      s2: string
    ): 'both_final' | 'both_non_final' | 'mismatch' => {
      const f1 = isFinalState(1, s1);
      const f2 = isFinalState(2, s2);
      if (f1 && f2) return 'both_final';
      if (!f1 && !f2) return 'both_non_final';
      return 'mismatch';
    };

    // 5. Initial State Pair Check (Empty string ε evaluation)
    const startStatus = getPairStatus(start1, start2);
    const steps: PairingStep[] = [];
    const visitedPairs = new Set<string>();
    const discoveredPairs: [string, string][] = [];

    const startKey = `${start1},${start2}`;
    visitedPairs.add(startKey);
    discoveredPairs.push([start1, start2]);

    if (startStatus === 'mismatch') {
      const isF1 = isFinalState(1, start1);
      return {
        isReady: true,
        status: 'evaluated',
        isEquivalent: false,
        counterexample: 'ε',
        distinguishingPair: [start1, start2] as [string, string],
        pairingSteps: [
          {
            step: 1,
            currentPair: [start1, start2] as [string, string],
            currentPairLabel: `(${start1}, ${start2})`,
            isFinal1: isF1,
            isFinal2: !isF1,
            pairStatus: 'mismatch',
            symbol: 'ε',
            nextPair: [start1, start2] as [string, string],
            nextPairLabel: `(${start1}, ${start2})`,
            nextIsFinal1: isF1,
            nextIsFinal2: !isF1,
            nextPairStatus: 'mismatch',
            isNewDiscovery: false,
            path: 'ε',
            note: `Initial states differ on empty string ε. DFA ${isF1 ? '1' : '2'} accepts (${isF1 ? start1 : start2} ∈ F), DFA ${isF1 ? '2' : '1'} rejects (${isF1 ? start2 : start1} ∉ F).`,
          },
        ],
        uniquePairsDiscovered: [[start1, start2]],
        explanation: `NOT EQUIVALENT: The DFAs differ on the empty string ε. DFA ${isF1 ? '1' : '2'} accepts ε because start state "${isF1 ? start1 : start2}" is final, while DFA ${isF1 ? '2' : '1'} rejects ε.`,
        combinedAlphabet,
      };
    }

    // 6. BFS State Pairing Exploration
    const queue: Array<{ pair: [string, string]; path: string }> = [
      { pair: [start1, start2], path: '' },
    ];

    let stepCounter = 1;
    let foundMismatch = false;
    let counterexampleString: string | null = null;
    let distinguishingPairFound: [string, string] | null = null;
    let mismatchExplanation = '';

    while (queue.length > 0) {
      const { pair: [p, q], path } = queue.shift()!;
      const isF1 = isFinalState(1, p);
      const isF2 = isFinalState(2, q);
      const currStatus = getPairStatus(p, q);

      for (const sym of combinedAlphabet) {
        const nextP = getNextState(dfa1, p, sym);
        const nextQ = getNextState(dfa2, q, sym);
        const nextF1 = isFinalState(1, nextP);
        const nextF2 = isFinalState(2, nextQ);
        const nextStatus = getPairStatus(nextP, nextQ);

        const nextKey = `${nextP},${nextQ}`;
        const isNew = !visitedPairs.has(nextKey);
        const nextPath = path + sym;

        let note = '';
        if (nextStatus === 'mismatch') {
          note = `DISTINGUISHING PAIR! On input '${nextPath}', DFA ${nextF1 ? '1' : '2'} accepts (${nextF1 ? nextP : nextQ} ∈ F), but DFA ${nextF1 ? '2' : '1'} rejects (${nextF1 ? nextQ : nextP} ∉ F).`;
        } else if (nextP === '∅' || nextQ === '∅') {
          note = `Transition leads to Dead State ∅ (undefined transition). Both remain non-accepting.`;
        } else if (isNew) {
          note = `New reachable state pair discovered and queued for evaluation.`;
        } else {
          note = `State pair already visited in prior step.`;
        }

        steps.push({
          step: stepCounter++,
          currentPair: [p, q],
          currentPairLabel: `(${p}, ${q})`,
          isFinal1: isF1,
          isFinal2: isF2,
          pairStatus: currStatus,
          symbol: sym,
          nextPair: [nextP, nextQ],
          nextPairLabel: `(${nextP}, ${nextQ})`,
          nextIsFinal1: nextF1,
          nextIsFinal2: nextF2,
          nextPairStatus: nextStatus,
          isNewDiscovery: isNew,
          path: nextPath,
          note,
        });

        if (nextStatus === 'mismatch' && !foundMismatch) {
          foundMismatch = true;
          counterexampleString = nextPath;
          distinguishingPairFound = [nextP, nextQ];
          mismatchExplanation = `NOT EQUIVALENT: Found distinguishing counterexample string "${nextPath}". On this input, DFA ${nextF1 ? '1' : '2'} accepts (ending in final state "${nextF1 ? nextP : nextQ}"), whereas DFA ${nextF1 ? '2' : '1'} rejects (ending in non-final state "${nextF1 ? nextQ : nextP}").`;
          break;
        }

        if (isNew) {
          visitedPairs.add(nextKey);
          discoveredPairs.push([nextP, nextQ]);
          queue.push({ pair: [nextP, nextQ], path: nextPath });
        }
      }

      if (foundMismatch) {
        break;
      }
    }

    if (foundMismatch) {
      return {
        isReady: true,
        status: 'evaluated',
        isEquivalent: false,
        counterexample: counterexampleString,
        distinguishingPair: distinguishingPairFound,
        pairingSteps: steps,
        uniquePairsDiscovered: discoveredPairs,
        explanation: mismatchExplanation,
        combinedAlphabet,
      };
    }

    return {
      isReady: true,
      status: 'evaluated',
      isEquivalent: true,
      counterexample: null,
      distinguishingPair: null,
      pairingSteps: steps,
      uniquePairsDiscovered: discoveredPairs,
      explanation: `EQUIVALENT: L(DFA 1) ≡ L(DFA 2). Explored all ${visitedPairs.size} reachable state pairs in the Cartesian cross-product. Every reachable pair shares identical acceptance status across the entire combined alphabet {${combinedAlphabet.join(', ')}}.`,
      combinedAlphabet,
    };
  }, [dfa1, dfa2, dfa1TransitionList, dfa2TransitionList, autoCompleteDeadState, isDfa1Complete, isDfa2Complete]);

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

          <button
            onClick={() => handleLoadPreset(selectedPresetKey)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
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

      {/* ROW 2: EQUIVALENCE VERDICT & CROSS-PRODUCT STATE-PAIRING TABLE */}
      <div className="flex flex-col gap-4">
        {/* Giant Status Verdict Banner */}
        {!equivalenceResult.isReady ? (
          <div className="p-6 rounded-2xl border shadow-2xl flex flex-col md:flex-row items-center gap-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border-amber-800/80 text-amber-100">
            <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/20">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-black tracking-tight text-amber-200">
                  AWAITING DFA CONFIGURATION
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Setup Incomplete
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                {equivalenceResult.explanation}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`p-6 rounded-2xl border shadow-2xl flex flex-col md:flex-row items-center justify-between gap-5 transition-all ${
              equivalenceResult.isEquivalent
                ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/30 border-emerald-800 text-emerald-100'
                : 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/30 border-rose-800 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3.5 rounded-2xl ${
                  equivalenceResult.isEquivalent
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/20'
                }`}
              >
                {equivalenceResult.isEquivalent ? (
                  <CheckCircle2 className="w-10 h-10" />
                ) : (
                  <XCircle className="w-10 h-10" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-black tracking-tight">
                    {equivalenceResult.isEquivalent
                      ? 'DFAs ARE MATHEMATICALLY EQUIVALENT'
                      : 'DFAs ARE NOT EQUIVALENT'}
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                      equivalenceResult.isEquivalent
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {equivalenceResult.isEquivalent ? 'L(DFA 1) ≡ L(DFA 2)' : 'L(DFA 1) ≢ L(DFA 2)'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  {equivalenceResult.explanation}
                </p>
              </div>
            </div>

            {/* Distinguishing Counterexample Pill */}
            {!equivalenceResult.isEquivalent && (
              <div className="flex flex-col items-end gap-1.5 bg-slate-950/90 border border-rose-700/60 p-3.5 rounded-xl text-right">
                <span className="text-[10px] font-semibold uppercase text-rose-400 tracking-wider">
                  Shortest Distinguishing Counterexample:
                </span>
                <span className="font-mono text-base font-bold text-white bg-rose-950/80 px-3 py-1 rounded border border-rose-600/80">
                  {equivalenceResult.counterexample === '' ? 'ε (empty string)' : `"${equivalenceResult.counterexample}"`}
                </span>
                {equivalenceResult.distinguishingPair && (
                  <span className="text-[11px] font-mono text-slate-400">
                    Distinguishing Pair: ({equivalenceResult.distinguishingPair[0]}, {equivalenceResult.distinguishingPair[1]})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* INTERACTIVE STATE-PAIRING CROSS-PRODUCT TABLE */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>State-Pairing Cross-Product Evaluation Table</span>
              </h3>
              <p className="text-xs text-slate-400">
                Traces each pair (p, q) ∈ Q₁ × Q₂ starting at (q₀₁, q₀₂). If any reachable pair has one accepting state and one non-accepting state, equivalence fails.
              </p>
            </div>
            {equivalenceResult.isReady && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-cyan-300">
                  {equivalenceResult.uniquePairsDiscovered.length} Unique Pairs Explored
                </span>
                <span className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-purple-300">
                  {equivalenceResult.pairingSteps.length} Transition Evaluations
                </span>
              </div>
            )}
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
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 sticky top-0 backdrop-blur z-10">
                  <tr>
                    <th className="py-2 px-3 text-center w-12">#</th>
                    <th className="py-2 px-3">Current Pair (p, q)</th>
                    <th className="py-2 px-3">Pair State Types</th>
                    <th className="py-2 px-3 text-center">Symbol (a)</th>
                    <th className="py-2 px-3">Next Pair (δ₁(p,a), δ₂(q,a))</th>
                    <th className="py-2 px-3 text-center">Match Status</th>
                    <th className="py-2 px-3">Evaluation Action / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {equivalenceResult.pairingSteps.map((step) => {
                    const isDistinguishing = step.nextPairStatus === 'mismatch';
                    const isHovered =
                      highlightedPair &&
                      highlightedPair[0] === step.currentPair[0] &&
                      highlightedPair[1] === step.currentPair[1];

                    return (
                      <tr
                        key={step.step}
                        onMouseEnter={() => setHighlightedPair(step.currentPair)}
                        onMouseLeave={() => setHighlightedPair(null)}
                        className={`transition-colors cursor-pointer ${
                          isDistinguishing
                            ? 'bg-rose-950/40 hover:bg-rose-900/40'
                            : isHovered
                            ? 'bg-cyan-950/40'
                            : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="py-2 px-3 text-center text-slate-500 font-bold">{step.step}</td>
                        <td className="py-2 px-3 font-bold text-white">
                          <span className="text-cyan-300 font-bold">{step.currentPairLabel}</span>
                        </td>
                        <td className="py-2 px-3 text-[11px]">
                          <span className={step.isFinal1 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                            p:{step.isFinal1 ? 'Final' : 'Non-final'}
                          </span>
                          <span className="text-slate-600 mx-1">|</span>
                          <span className={step.isFinal2 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                            q:{step.isFinal2 ? 'Final' : 'Non-final'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-750 text-cyan-400 font-bold">
                            {step.symbol}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold">
                          <span className={isDistinguishing ? 'text-rose-400' : 'text-purple-300'}>
                            {step.nextPairLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {step.nextPairStatus === 'both_final' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-[10px] font-sans font-semibold">
                              Both Final (Match ✓)
                            </span>
                          ) : step.nextPairStatus === 'both_non_final' ? (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-750 text-slate-300 text-[10px] font-sans">
                              Both Non-Final (Match ✓)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-sans font-bold animate-pulse">
                              MISMATCH ✗
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-400 font-sans">
                          {step.note}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
              placeholder="Enter test string e.g. 0101"
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
