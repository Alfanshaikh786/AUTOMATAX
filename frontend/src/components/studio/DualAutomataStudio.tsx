import React, { useState, useMemo, useEffect } from 'react';
import { AutomatonModel } from '../../types/automata';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import {
  Layers, ArrowRight, Plus, Trash2, RotateCcw,
  Sparkles, Check, CheckCircle2, FileText, Share2, Compass, ExternalLink, AlertCircle, Info,
  Workflow, GitFork
} from 'lucide-react';

interface DualAutomataStudioProps {
  onLoadAutomaton: (aut: AutomatonModel) => void;
  initialMode?: 'NFA' | 'ENFA';
}

interface StateMapping {
  dfaName: string;
  subset: string[];
  subsetLabel: string;
  isInitial: boolean;
  isFinal: boolean;
  closureFormula?: string;
}

// Preset Academic Samples for Standard NFA
const PRESET_NFA_SAMPLES: Record<string, { name: string; nfa: AutomatonModel }> = {
  sample_abc: {
    name: "Academic Example: 3-State NFA (A, B, C)",
    nfa: {
      id: "nfa_abc_sample",
      name: "3-State NFA (A, B, C)",
      type: "NFA",
      states: ["A", "B", "C"],
      alphabet: ["0", "1"],
      initial_state: "A",
      accepting_states: ["C"],
      transitions: {
        A: { "0": ["A"], "1": ["B", "C"] },
        B: { "0": ["B"], "1": ["A", "C"] },
        C: { "0": ["A", "B"], "1": ["C"] },
      },
      epsilon_transitions: {},
    },
  },
  sample_q012: {
    name: "Binary Substring: NFA (q0, q1, q2)",
    nfa: {
      id: "nfa_q012_sample",
      name: "Binary Substring NFA",
      type: "NFA",
      states: ["q0", "q1", "q2"],
      alphabet: ["0", "1"],
      initial_state: "q0",
      accepting_states: ["q2"],
      transitions: {
        q0: { "0": ["q0", "q1"], "1": ["q0"] },
        q1: { "0": [], "1": ["q2"] },
        q2: { "0": [], "1": [] },
      },
      epsilon_transitions: {},
    },
  },
  sample_ends_01: {
    name: "Strings Ending with '01'",
    nfa: {
      id: "nfa_ends_01",
      name: "Strings Ending in 01",
      type: "NFA",
      states: ["q0", "q1", "q2"],
      alphabet: ["0", "1"],
      initial_state: "q0",
      accepting_states: ["q2"],
      transitions: {
        q0: { "0": ["q0", "q1"], "1": ["q0"] },
        q1: { "0": [], "1": ["q2"] },
        q2: { "0": [], "1": [] },
      },
      epsilon_transitions: {},
    },
  },
  sample_multi_branch: {
    name: "Multi-Path Branching NFA",
    nfa: {
      id: "nfa_multi_branch",
      name: "Multi-Path Branching NFA",
      type: "NFA",
      states: ["q0", "q1", "q2", "q3"],
      alphabet: ["a", "b"],
      initial_state: "q0",
      accepting_states: ["q3"],
      transitions: {
        q0: { a: ["q0", "q1"], b: ["q0"] },
        q1: { a: [], b: ["q2"] },
        q2: { a: ["q3"], b: [] },
        q3: { a: ["q3"], b: ["q3"] },
      },
      epsilon_transitions: {},
    },
  },
};

// Preset Academic Samples for ε-NFA (including textbook example from reference)
const PRESET_ENFA_SAMPLES: Record<string, { name: string; enfa: AutomatonModel }> = {
  sample_enfa_textbook: {
    name: "Textbook 3-State ε-NFA (q0, q1, q2)",
    enfa: {
      id: "enfa_textbook_sample",
      name: "Textbook 3-State ε-NFA",
      type: "ENFA",
      states: ["q0", "q1", "q2"],
      alphabet: ["a", "b"],
      initial_state: "q0",
      accepting_states: ["q0"],
      transitions: {
        q0: { a: [], b: ["q1"] },
        q1: { a: ["q1", "q2"], b: ["q2"] },
        q2: { a: ["q0"], b: [] },
      },
      epsilon_transitions: {
        q0: ["q2"],
        q1: [],
        q2: [],
      },
    },
  },
  sample_enfa_hopcroft: {
    name: "Hopcroft & Ullman (0*1*2*) ε-NFA",
    enfa: {
      id: "enfa_hopcroft_sample",
      name: "Hopcroft ε-NFA (0*1*2*)",
      type: "ENFA",
      states: ["q0", "q1", "q2"],
      alphabet: ["0", "1"],
      initial_state: "q0",
      accepting_states: ["q2"],
      transitions: {
        q0: { "0": ["q0"], "1": [] },
        q1: { "0": [], "1": ["q1"] },
        q2: { "0": ["q2"], "1": [] },
      },
      epsilon_transitions: {
        q0: ["q1"],
        q1: ["q2"],
        q2: [],
      },
    },
  },
  sample_enfa_union: {
    name: "Thompson Pattern (a|b)*abb ε-NFA",
    enfa: {
      id: "enfa_thompson_sample",
      name: "Thompson (a|b)*abb ε-NFA",
      type: "ENFA",
      states: ["q0", "q1", "q2", "q3", "q4"],
      alphabet: ["a", "b"],
      initial_state: "q0",
      accepting_states: ["q4"],
      transitions: {
        q0: { a: ["q0"], b: ["q0"] },
        q1: { a: ["q2"], b: [] },
        q2: { a: [], b: ["q3"] },
        q3: { a: [], b: ["q4"] },
        q4: { a: [], b: [] },
      },
      epsilon_transitions: {
        q0: ["q1"],
        q1: [],
        q2: [],
        q3: [],
        q4: [],
      },
    },
  },
};

// Helper: Compute epsilon closure for a single state
function getEpsilonClosure(
  state: string,
  states: string[],
  epsTransitions: Record<string, string[]>
): string[] {
  const closure = new Set<string>([state]);
  const queue = [state];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const epsDests = epsTransitions[curr] || [];
    for (const next of epsDests) {
      if (states.includes(next) && !closure.has(next)) {
        closure.add(next);
        queue.push(next);
      }
    }
  }

  return Array.from(closure).sort();
}

// Helper: Compute epsilon closure for a set of states
function getSetEpsilonClosure(
  stateSet: string[],
  states: string[],
  epsTransitions: Record<string, string[]>
): string[] {
  const result = new Set<string>();
  for (const s of stateSet) {
    const singleClosure = getEpsilonClosure(s, states, epsTransitions);
    for (const c of singleClosure) {
      result.add(c);
    }
  }
  return Array.from(result).sort();
}

// Helper: Compute move for a set of states on a given symbol
function getMove(
  stateSet: string[],
  symbol: string,
  transitions: Record<string, Record<string, string[]>>
): string[] {
  const result = new Set<string>();
  for (const s of stateSet) {
    const dests = transitions[s]?.[symbol] || [];
    for (const d of dests) {
      result.add(d);
    }
  }
  return Array.from(result).sort();
}

export const DualAutomataStudio: React.FC<DualAutomataStudioProps> = ({
  onLoadAutomaton,
  initialMode = 'NFA',
}) => {
  // Studio Mode: Standard NFA vs ε-NFA
  const [studioMode, setStudioMode] = useState<'NFA' | 'ENFA'>(initialMode);

  // Current Automaton model
  const [nfa, setNfa] = useState<AutomatonModel>(
    initialMode === 'ENFA'
      ? PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa
      : PRESET_NFA_SAMPLES.sample_abc.nfa
  );

  // Sync mode if initialMode changes
  useEffect(() => {
    if (initialMode && initialMode !== studioMode) {
      setStudioMode(initialMode);
      if (initialMode === 'ENFA' && nfa.type !== 'ENFA') {
        setNfa(JSON.parse(JSON.stringify(PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa)));
      } else if (initialMode === 'NFA' && nfa.type === 'ENFA') {
        setNfa(JSON.parse(JSON.stringify(PRESET_NFA_SAMPLES.sample_abc.nfa)));
      }
    }
  }, [initialMode]);

  // Form input states
  const [inputNewState, setInputNewState] = useState('');
  const [selectedDeleteState, setSelectedDeleteState] = useState('');
  const [inputNewSymbol, setInputNewSymbol] = useState('');
  const [selectedDeleteSymbol, setSelectedDeleteSymbol] = useState('');
  const [selectedAddFinalState, setSelectedAddFinalState] = useState('');
  const [selectedDeleteFinalState, setSelectedDeleteFinalState] = useState('');

  // Transition form states
  const [transSymbol, setTransSymbol] = useState<string>('0');
  const [transFrom, setTransFrom] = useState<string>('q0');
  const [transTo, setTransTo] = useState<string>('q0');
  const [selectedDeleteTrans, setSelectedDeleteTrans] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isEnfa = studioMode === 'ENFA';

  // Allowed symbols in transition dropdown (includes 'ε' in ENFA mode)
  const availableTransitionSymbols = useMemo(() => {
    return isEnfa ? [...nfa.alphabet, 'ε'] : nfa.alphabet;
  }, [nfa.alphabet, isEnfa]);

  // Synchronize transition form controls whenever NFA states or alphabet change
  useEffect(() => {
    if (nfa.states.length > 0) {
      if (!nfa.states.includes(transFrom)) {
        setTransFrom(nfa.states[0]);
      }
      if (!nfa.states.includes(transTo)) {
        setTransTo(nfa.states[0]);
      }
    } else {
      setTransFrom('');
      setTransTo('');
    }

    if (availableTransitionSymbols.length > 0) {
      if (!availableTransitionSymbols.includes(transSymbol)) {
        setTransSymbol(availableTransitionSymbols[0]);
      }
    } else {
      setTransSymbol('');
    }
  }, [nfa.states, availableTransitionSymbols, transFrom, transTo, transSymbol]);

  // Auto-dismiss feedback message after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Epsilon-closures of all states (for ε-NFA mode)
  const stateEpsilonClosures = useMemo(() => {
    const map: Record<string, string[]> = {};
    nfa.states.forEach((s) => {
      map[s] = getEpsilonClosure(s, nfa.states, nfa.epsilon_transitions || {});
    });
    return map;
  }, [nfa.states, nfa.epsilon_transitions]);

  // Real-time subset construction algorithm to calculate DFA, formal definitions, and tables
  const { dfa, stateMappings, dfaTransitionsTable, nfaTransitionList, dfaTransitionList } = useMemo(() => {
    if (!nfa.states.length || !nfa.alphabet.length) {
      const emptyDfa: AutomatonModel = {
        id: 'dfa_empty',
        name: 'Empty DFA',
        type: 'DFA',
        states: [],
        alphabet: nfa.alphabet.filter((s) => s !== 'ε'),
        initial_state: '',
        accepting_states: [],
        transitions: {},
        epsilon_transitions: {},
      };
      return {
        dfa: emptyDfa,
        stateMappings: [],
        dfaTransitionsTable: {},
        nfaTransitionList: [],
        dfaTransitionList: [],
      };
    }

    // 1. Compile NFA / ε-NFA Transition List for formal definition
    const nfaTransList: Array<{ from: string; symbol: string; dests: string[]; isEpsilon?: boolean }> = [];
    nfa.states.forEach((s) => {
      nfa.alphabet.forEach((sym) => {
        const dests = nfa.transitions[s]?.[sym] || [];
        if (dests.length > 0) {
          nfaTransList.push({ from: s, symbol: sym, dests, isEpsilon: false });
        }
      });
      if (isEnfa) {
        const epsDests = nfa.epsilon_transitions?.[s] || [];
        if (epsDests.length > 0) {
          nfaTransList.push({ from: s, symbol: 'ε', dests: epsDests, isEpsilon: true });
        }
      }
    });

    // 2. Subset construction (with or without epsilon-closure)
    const rawStart = nfa.initial_state && nfa.states.includes(nfa.initial_state) ? nfa.initial_state : nfa.states[0];
    const initialSubset = isEnfa
      ? getEpsilonClosure(rawStart, nfa.states, nfa.epsilon_transitions || {})
      : [rawStart].sort();

    const subsetMap = new Map<string, string>(); // subsetKey -> "q0"
    const stateMappingsList: StateMapping[] = [];

    let counter = 0;
    const initialKey = initialSubset.join(',');
    const initialDfaName = `q${counter++}`;
    subsetMap.set(initialKey, initialDfaName);

    stateMappingsList.push({
      dfaName: initialDfaName,
      subset: initialSubset,
      subsetLabel: `{${initialSubset.join(', ')}}`,
      isInitial: true,
      isFinal: initialSubset.some((s) => nfa.accepting_states.includes(s)),
      closureFormula: isEnfa ? `ε-closure({${rawStart}})` : undefined,
    });

    const queue: string[][] = [initialSubset];
    const dfaTrans: Record<string, Record<string, string[]>> = {};
    const dfaTable: Record<string, Record<string, string>> = {};
    const dfaAcceptingSet = new Set<string>();

    if (initialSubset.some((s) => nfa.accepting_states.includes(s))) {
      dfaAcceptingSet.add(initialDfaName);
    }

    // DFA alphabet strictly excludes ε
    const dfaAlphabet = nfa.alphabet.filter((sym) => sym !== 'ε');

    while (queue.length > 0) {
      const currSubset = queue.shift()!;
      const currKey = currSubset.join(',');
      const currDfaName = subsetMap.get(currKey)!;

      if (!dfaTrans[currDfaName]) dfaTrans[currDfaName] = {};
      if (!dfaTable[currDfaName]) dfaTable[currDfaName] = {};

      for (const sym of dfaAlphabet) {
        const moveSet = getMove(currSubset, sym, nfa.transitions);
        if (moveSet.length === 0) {
          // Dead / trap state or empty
          dfaTrans[currDfaName][sym] = [];
          dfaTable[currDfaName][sym] = '∅';
          continue;
        }

        const nextSubset = isEnfa
          ? getSetEpsilonClosure(moveSet, nfa.states, nfa.epsilon_transitions || {})
          : moveSet;

        if (nextSubset.length === 0) {
          dfaTrans[currDfaName][sym] = [];
          dfaTable[currDfaName][sym] = '∅';
        } else {
          const nextKey = nextSubset.join(',');
          let nextDfaName = subsetMap.get(nextKey);

          if (!nextDfaName) {
            nextDfaName = `q${counter++}`;
            subsetMap.set(nextKey, nextDfaName);
            queue.push(nextSubset);

            const isAcc = nextSubset.some((s) => nfa.accepting_states.includes(s));
            if (isAcc) {
              dfaAcceptingSet.add(nextDfaName);
            }

            stateMappingsList.push({
              dfaName: nextDfaName,
              subset: nextSubset,
              subsetLabel: `{${nextSubset.join(', ')}}`,
              isInitial: false,
              isFinal: isAcc,
              closureFormula: isEnfa ? `ε-closure(move(${currDfaName}, ${sym}))` : undefined,
            });
          }

          dfaTrans[currDfaName][sym] = [nextDfaName];
          dfaTable[currDfaName][sym] = nextDfaName;
        }
      }
    }

    const dfaStates = stateMappingsList.map((m) => m.dfaName);
    const dfaAccepting = Array.from(dfaAcceptingSet);

    // 3. Compile DFA Transition List for formal definition
    const dfaTransList: Array<{ from: string; symbol: string; dest: string }> = [];
    dfaStates.forEach((s) => {
      dfaAlphabet.forEach((sym) => {
        const dest = dfaTrans[s]?.[sym]?.[0];
        if (dest) {
          dfaTransList.push({ from: s, symbol: sym, dest });
        }
      });
    });

    const dfaModel: AutomatonModel = {
      id: `${nfa.id}_dfa_live`,
      name: `${nfa.name} (Equivalent DFA)`,
      type: 'DFA',
      states: dfaStates,
      alphabet: dfaAlphabet,
      initial_state: initialDfaName,
      accepting_states: dfaAccepting,
      transitions: dfaTrans,
      epsilon_transitions: {},
    };

    return {
      dfa: dfaModel,
      stateMappings: stateMappingsList,
      dfaTransitionsTable: dfaTable,
      nfaTransitionList: nfaTransList,
      dfaTransitionList: dfaTransList,
    };
  }, [nfa, isEnfa]);

  // Mode Switcher Handler
  const handleSwitchMode = (mode: 'NFA' | 'ENFA') => {
    if (mode === studioMode) return;
    setStudioMode(mode);
    if (mode === 'ENFA') {
      const preset = JSON.parse(JSON.stringify(PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa));
      setNfa(preset);
      setTransFrom(preset.states[0]);
      setTransTo(preset.states[0]);
      setTransSymbol(preset.alphabet[0] || 'ε');
      setFeedback({ type: 'info', text: 'Switched to ε-NFA Studio with Textbook ε-NFA sample.' });
    } else {
      const preset = JSON.parse(JSON.stringify(PRESET_NFA_SAMPLES.sample_abc.nfa));
      setNfa(preset);
      setTransFrom(preset.states[0]);
      setTransTo(preset.states[0]);
      setTransSymbol(preset.alphabet[0] || '0');
      setFeedback({ type: 'info', text: 'Switched to Standard NFA Studio with 3-State NFA sample.' });
    }
  };

  // Form Handlers
  const handleAddState = () => {
    const s = inputNewState.trim();
    if (!s) return;
    if (nfa.states.includes(s)) {
      setFeedback({ type: 'error', text: `State '${s}' already exists.` });
      return;
    }
    const newStates = [...nfa.states, s];
    const newTrans: Record<string, Record<string, string[]>> = {};
    const newEps: Record<string, string[]> = {};

    newStates.forEach((st) => {
      newTrans[st] = {};
      nfa.alphabet.forEach((sym) => {
        newTrans[st][sym] = st === s ? [] : [...(nfa.transitions[st]?.[sym] || [])];
      });
      newEps[st] = st === s ? [] : [...(nfa.epsilon_transitions?.[st] || [])];
    });

    setNfa({
      ...nfa,
      states: newStates,
      initial_state: nfa.initial_state || s,
      transitions: newTrans,
      epsilon_transitions: newEps,
    });
    setInputNewState('');
    setFeedback({ type: 'success', text: `✓ Added state '${s}'` });
  };

  const handleDeleteState = () => {
    if (!selectedDeleteState) return;
    const s = selectedDeleteState;
    if (nfa.states.length <= 1) {
      setFeedback({ type: 'error', text: 'Automaton must retain at least one state.' });
      return;
    }
    const newStates = nfa.states.filter((st) => st !== s);
    const newAcc = nfa.accepting_states.filter((st) => st !== s);
    const newInit = nfa.initial_state === s ? (newStates[0] || '') : nfa.initial_state;

    const newTrans: Record<string, Record<string, string[]>> = {};
    const newEps: Record<string, string[]> = {};

    newStates.forEach((st) => {
      newTrans[st] = {};
      if (nfa.transitions[st]) {
        Object.entries(nfa.transitions[st]).forEach(([sym, dests]) => {
          newTrans[st][sym] = dests.filter((d) => d !== s);
        });
      }
      if (nfa.epsilon_transitions?.[st]) {
        newEps[st] = nfa.epsilon_transitions[st].filter((d) => d !== s);
      }
    });

    setNfa({
      ...nfa,
      states: newStates,
      initial_state: newInit,
      accepting_states: newAcc,
      transitions: newTrans,
      epsilon_transitions: newEps,
    });
    setSelectedDeleteState('');
    setFeedback({ type: 'info', text: `Deleted state '${s}'` });
  };

  const handleAddSymbol = () => {
    const sym = inputNewSymbol.trim();
    if (!sym) return;
    if (sym === 'ε' || sym === 'e' || sym === 'epsilon') {
      setFeedback({
        type: 'error',
        text: 'ε is the reserved empty/null transition symbol. It is always automatically available in ε-NFA mode.',
      });
      return;
    }
    if (nfa.alphabet.includes(sym)) {
      setFeedback({ type: 'error', text: `Symbol '${sym}' already exists.` });
      return;
    }
    const newAlpha = [...nfa.alphabet, sym];
    const newTrans: Record<string, Record<string, string[]>> = {};
    nfa.states.forEach((st) => {
      newTrans[st] = {};
      newAlpha.forEach((a) => {
        newTrans[st][a] = a === sym ? [] : [...(nfa.transitions[st]?.[a] || [])];
      });
    });

    setNfa({ ...nfa, alphabet: newAlpha, transitions: newTrans });
    setInputNewSymbol('');
    setFeedback({ type: 'success', text: `✓ Added symbol '${sym}'` });
  };

  const handleDeleteSymbol = () => {
    if (!selectedDeleteSymbol) return;
    const sym = selectedDeleteSymbol;
    if (nfa.alphabet.length <= 1) {
      setFeedback({ type: 'error', text: 'Automaton must retain at least one symbol.' });
      return;
    }
    const newAlpha = nfa.alphabet.filter((x) => x !== sym);
    const newTrans: Record<string, Record<string, string[]>> = {};
    nfa.states.forEach((st) => {
      newTrans[st] = {};
      if (nfa.transitions[st]) {
        Object.entries(nfa.transitions[st]).forEach(([s, dests]) => {
          if (s !== sym) {
            newTrans[st][s] = dests;
          }
        });
      }
    });

    setNfa({ ...nfa, alphabet: newAlpha, transitions: newTrans });
    setSelectedDeleteSymbol('');
    setFeedback({ type: 'info', text: `Deleted symbol '${sym}'` });
  };

  const handleSetStartState = (s: string) => {
    setNfa({ ...nfa, initial_state: s });
    setFeedback({ type: 'info', text: `Start state set to '${s}'` });
  };

  const handleAddFinalState = () => {
    if (!selectedAddFinalState) return;
    if (!nfa.accepting_states.includes(selectedAddFinalState)) {
      setNfa({
        ...nfa,
        accepting_states: [...nfa.accepting_states, selectedAddFinalState],
      });
      setFeedback({ type: 'success', text: `Marked '${selectedAddFinalState}' as final state.` });
    }
    setSelectedAddFinalState('');
  };

  const handleDeleteFinalState = () => {
    if (!selectedDeleteFinalState) return;
    setNfa({
      ...nfa,
      accepting_states: nfa.accepting_states.filter((s) => s !== selectedDeleteFinalState),
    });
    setFeedback({ type: 'info', text: `Removed final status from '${selectedDeleteFinalState}'` });
    setSelectedDeleteFinalState('');
  };

  const handleAddTransition = () => {
    const from = nfa.states.includes(transFrom) ? transFrom : nfa.states[0];
    const to = nfa.states.includes(transTo) ? transTo : nfa.states[0];
    const sym = availableTransitionSymbols.includes(transSymbol) ? transSymbol : availableTransitionSymbols[0];

    if (!from || !to || !sym) {
      setFeedback({ type: 'error', text: 'States and symbols must exist to create transitions.' });
      return;
    }

    if (sym === 'ε') {
      // Epsilon transition
      const newEps: Record<string, string[]> = {};
      nfa.states.forEach((s) => {
        newEps[s] = [...(nfa.epsilon_transitions?.[s] || [])];
      });
      if (!newEps[from]) newEps[from] = [];
      const currEps = newEps[from];
      if (currEps.includes(to)) {
        setFeedback({
          type: 'info',
          text: `ε-transition δ(${from}, ε) = {${to}} already exists.`,
        });
        return;
      }
      newEps[from] = [...currEps, to];
      setNfa({ ...nfa, epsilon_transitions: newEps });
      setFeedback({
        type: 'success',
        text: `✓ Added ε-transition δ(${from}, ε) = {${to}}`,
      });
    } else {
      // Normal symbol transition
      const newTrans: Record<string, Record<string, string[]>> = {};
      nfa.states.forEach((s) => {
        newTrans[s] = {};
        nfa.alphabet.forEach((a) => {
          newTrans[s][a] = [...(nfa.transitions[s]?.[a] || [])];
        });
      });

      if (!newTrans[from]) newTrans[from] = {};
      if (!newTrans[from][sym]) newTrans[from][sym] = [];

      const currDests = newTrans[from][sym];
      if (currDests.includes(to)) {
        setFeedback({
          type: 'info',
          text: `Transition δ(${from}, ${sym}) = {${to}} already exists.`,
        });
        return;
      }

      newTrans[from][sym] = [...currDests, to];
      setNfa({ ...nfa, transitions: newTrans });
      setFeedback({
        type: 'success',
        text: `✓ Added transition δ(${from}, ${sym}) = {${to}}`,
      });
    }
  };

  const handleDeleteTransition = () => {
    if (!selectedDeleteTrans) return;
    // Format: "from|symbol|to"
    const [from, sym, to] = selectedDeleteTrans.split('|');
    if (!from || !sym || !to) return;

    if (sym === 'ε') {
      const newEps: Record<string, string[]> = {};
      nfa.states.forEach((s) => {
        const dests = nfa.epsilon_transitions?.[s] || [];
        if (s === from) {
          newEps[s] = dests.filter((d) => d !== to);
        } else {
          newEps[s] = [...dests];
        }
      });
      setNfa({ ...nfa, epsilon_transitions: newEps });
      setFeedback({ type: 'info', text: `Removed ε-transition δ(${from}, ε) = {${to}}` });
    } else {
      const newTrans: Record<string, Record<string, string[]>> = {};
      nfa.states.forEach((s) => {
        newTrans[s] = {};
        nfa.alphabet.forEach((a) => {
          const dests = nfa.transitions[s]?.[a] || [];
          if (s === from && a === sym) {
            newTrans[s][a] = dests.filter((d) => d !== to);
          } else {
            newTrans[s][a] = [...dests];
          }
        });
      });
      setNfa({ ...nfa, transitions: newTrans });
      setFeedback({ type: 'info', text: `Removed transition δ(${from}, ${sym}) = {${to}}` });
    }
    setSelectedDeleteTrans('');
  };

  const handleReset = () => {
    if (isEnfa) {
      setNfa({
        id: `enfa_custom_${Date.now()}`,
        name: "Custom ε-NFA",
        type: "ENFA",
        states: ["q0"],
        alphabet: ["0", "1"],
        initial_state: "q0",
        accepting_states: [],
        transitions: { q0: { "0": [], "1": [] } },
        epsilon_transitions: { q0: [] },
      });
    } else {
      setNfa({
        id: `nfa_custom_${Date.now()}`,
        name: "Custom NFA",
        type: "NFA",
        states: ["q0"],
        alphabet: ["0", "1"],
        initial_state: "q0",
        accepting_states: [],
        transitions: { q0: { "0": [], "1": [] } },
        epsilon_transitions: {},
      });
    }
    setTransFrom('q0');
    setTransTo('q0');
    setTransSymbol('0');
    setSelectedDeleteState('');
    setSelectedDeleteSymbol('');
    setSelectedAddFinalState('');
    setSelectedDeleteFinalState('');
    setSelectedDeleteTrans('');
    setFeedback({ type: 'info', text: `Reset ${isEnfa ? 'ε-NFA' : 'NFA'} to single state q0.` });
  };

  const handleLoadSample = (sampleKey: string) => {
    if (isEnfa) {
      if (PRESET_ENFA_SAMPLES[sampleKey]) {
        const sample = JSON.parse(JSON.stringify(PRESET_ENFA_SAMPLES[sampleKey].enfa));
        setNfa(sample);
        if (sample.states.length > 0) {
          setTransFrom(sample.states[0]);
          setTransTo(sample.states[0]);
        }
        if (sample.alphabet.length > 0) {
          setTransSymbol(sample.alphabet[0]);
        }
        setSelectedDeleteState('');
        setSelectedDeleteSymbol('');
        setSelectedAddFinalState('');
        setSelectedDeleteFinalState('');
        setSelectedDeleteTrans('');
        setFeedback({ type: 'success', text: `Loaded ${PRESET_ENFA_SAMPLES[sampleKey].name}` });
      }
    } else {
      if (PRESET_NFA_SAMPLES[sampleKey]) {
        const sample = JSON.parse(JSON.stringify(PRESET_NFA_SAMPLES[sampleKey].nfa));
        setNfa(sample);
        if (sample.states.length > 0) {
          setTransFrom(sample.states[0]);
          setTransTo(sample.states[0]);
        }
        if (sample.alphabet.length > 0) {
          setTransSymbol(sample.alphabet[0]);
        }
        setSelectedDeleteState('');
        setSelectedDeleteSymbol('');
        setSelectedAddFinalState('');
        setSelectedDeleteFinalState('');
        setSelectedDeleteTrans('');
        setFeedback({ type: 'success', text: `Loaded ${PRESET_NFA_SAMPLES[sampleKey].name}` });
      }
    }
  };

  // Compile all individual transitions for the delete transition dropdown
  const allTransitionsList = useMemo(() => {
    const list: Array<{ label: string; value: string; isEps?: boolean }> = [];
    nfa.states.forEach((s) => {
      nfa.alphabet.forEach((sym) => {
        const dests = nfa.transitions[s]?.[sym] || [];
        dests.forEach((d) => {
          list.push({
            label: `δ(${s}, ${sym}) = {${d}}`,
            value: `${s}|${sym}|${d}`,
            isEps: false,
          });
        });
      });
      if (isEnfa) {
        const epsDests = nfa.epsilon_transitions?.[s] || [];
        epsDests.forEach((d) => {
          list.push({
            label: `δ(${s}, ε) = {${d}} (Epsilon)`,
            value: `${s}|ε|${d}`,
            isEps: true,
          });
        });
      }
    });
    return list;
  }, [nfa, isEnfa]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 pb-12">
      {/* Top Banner & Mode Switcher */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${
              isEnfa ? 'from-purple-600 to-indigo-600 shadow-purple-600/20' : 'from-cyan-600 to-blue-600 shadow-cyan-600/20'
            } flex items-center justify-center text-white shadow-lg`}
          >
            {isEnfa ? <GitFork className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {isEnfa ? 'Dual ε-NFA ➔ DFA Studio' : 'Dual NFA ➔ DFA Studio'}
              <span
                className={`px-2 py-0.5 border rounded font-mono text-[10px] ${
                  isEnfa
                    ? 'bg-purple-950 border-purple-800 text-purple-300'
                    : 'bg-cyan-950 border-cyan-800 text-cyan-300'
                }`}
              >
                {isEnfa ? 'EPSILON CLOSURE ENGINE' : 'LIVE REACTIVE ENGINE'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isEnfa
                ? 'Define any ε-NFA with spontaneous ε-transitions. Watch the ε-closures, subset construction, 5-tuples, and graphs generate in real time.'
                : 'Define any NFA using the input controls. Watch the mathematical 5-tuples, transition tables, subset mappings, and graphs generate simultaneously in real time.'}
            </p>
          </div>
        </div>

        {/* Quick Actions & Mode Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleSwitchMode('NFA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                studioMode === 'NFA'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              Standard NFA
            </button>
            <button
              onClick={() => handleSwitchMode('ENFA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                studioMode === 'ENFA'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              ε-NFA Studio
            </button>
          </div>

          {/* Preset Samples Loader */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 border border-slate-800 rounded-lg text-xs">
            <span className="text-slate-400 font-semibold">Load Sample:</span>
            <select
              onChange={(e) => handleLoadSample(e.target.value)}
              className="bg-transparent font-medium text-cyan-300 outline-none cursor-pointer"
              defaultValue={isEnfa ? 'sample_enfa_textbook' : 'sample_abc'}
            >
              {isEnfa
                ? Object.entries(PRESET_ENFA_SAMPLES).map(([key, sample]) => (
                    <option key={key} value={key} className="bg-slate-900 text-slate-200">
                      {sample.name}
                    </option>
                  ))
                : Object.entries(PRESET_NFA_SAMPLES).map(([key, sample]) => (
                    <option key={key} value={key} className="bg-slate-900 text-slate-200">
                      {sample.name}
                    </option>
                  ))}
            </select>
          </div>

          <button
            onClick={() => onLoadAutomaton(dfa)}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Load DFA into Builder
          </button>

          <button
            onClick={() => onLoadAutomaton(nfa)}
            className={`px-3 py-1.5 ${
              isEnfa ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'
            } text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Load {isEnfa ? 'ε-NFA' : 'NFA'} into Builder
          </button>
        </div>
      </div>

      {/* TOP 3-COLUMN DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* COLUMN 1: CREATE NFA / ε-NFA INPUT CONTROLS */}
        <div className="flex flex-col gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span>Create {isEnfa ? 'ε-NFA' : 'NFA'}</span>
              {isEnfa && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-950/70 border border-purple-800 text-purple-300 rounded">
                  ε-Enabled
                </span>
              )}
            </h3>
            <span className="text-[11px] font-mono text-cyan-400">
              {nfa.states.length} states · Σ: {'{' + nfa.alphabet.join(',') + '}'}
            </span>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            {/* Add State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add State</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="State name (e.g. q0, A)"
                  value={inputNewState}
                  onChange={(e) => setInputNewState(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddState()}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2.5 py-1 text-slate-100 font-mono outline-none"
                />
                <button
                  onClick={handleAddState}
                  className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 font-semibold rounded transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete State</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDeleteState}
                  onChange={(e) => setSelectedDeleteState(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-slate-200 font-mono outline-none"
                >
                  <option value="">- Select -</option>
                  {nfa.states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteState}
                  disabled={!selectedDeleteState}
                  className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 disabled:opacity-40 text-red-300 font-semibold rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Add Symbol */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400">Add Alphabet Symbol</label>
                {isEnfa && (
                  <span className="text-[10px] text-purple-400 font-mono italic">
                    (ε is built-in)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Symbol (e.g. 0, 1, a, b)"
                  value={inputNewSymbol}
                  onChange={(e) => setInputNewSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2.5 py-1 text-slate-100 font-mono outline-none"
                />
                <button
                  onClick={handleAddSymbol}
                  className="px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 font-semibold rounded transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete Symbol */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Symbol</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDeleteSymbol}
                  onChange={(e) => setSelectedDeleteSymbol(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-slate-200 font-mono outline-none"
                >
                  <option value="">- Select -</option>
                  {nfa.alphabet.map((sym) => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteSymbol}
                  disabled={!selectedDeleteSymbol}
                  className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 disabled:opacity-40 text-red-300 font-semibold rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Start State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Start State</label>
              <select
                value={nfa.initial_state}
                onChange={(e) => handleSetStartState(e.target.value)}
                className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-emerald-400 font-mono font-bold outline-none"
              >
                {nfa.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Add Final State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Add Final State</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAddFinalState}
                  onChange={(e) => setSelectedAddFinalState(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-slate-200 font-mono outline-none"
                >
                  <option value="">- Select -</option>
                  {nfa.states.filter((s) => !nfa.accepting_states.includes(s)).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddFinalState}
                  disabled={!selectedAddFinalState}
                  className="px-3 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 disabled:opacity-40 text-amber-200 font-semibold rounded transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Delete Final State */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Final State</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDeleteFinalState}
                  onChange={(e) => setSelectedDeleteFinalState(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-slate-200 font-mono outline-none"
                >
                  <option value="">- Select -</option>
                  {nfa.accepting_states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteFinalState}
                  disabled={!selectedDeleteFinalState}
                  className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 disabled:opacity-40 text-red-300 font-semibold rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Add Transition */}
            <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1.5">
                  <span>Add Transition:</span>
                  <span className="font-mono text-purple-300">δ(from, symbol) → to</span>
                </label>
                {transSymbol === 'ε' && (
                  <span className="text-[10px] text-purple-400 font-mono font-bold bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800">
                    ε-Path (Null)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-400 font-mono uppercase">From</span>
                  <select
                    value={nfa.states.includes(transFrom) ? transFrom : (nfa.states[0] || '')}
                    onChange={(e) => setTransFrom(e.target.value)}
                    title="From State"
                    className="w-16 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded px-1.5 py-1 text-slate-200 font-mono text-xs outline-none"
                  >
                    {nfa.states.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className={`text-[9px] font-mono uppercase ${transSymbol === 'ε' ? 'text-purple-400 font-bold' : 'text-cyan-400'}`}>
                    Symbol
                  </span>
                  <select
                    value={availableTransitionSymbols.includes(transSymbol) ? transSymbol : (availableTransitionSymbols[0] || '')}
                    onChange={(e) => setTransSymbol(e.target.value)}
                    title="Symbol"
                    className={`w-16 bg-slate-900 border rounded px-1.5 py-1 font-mono font-bold text-xs outline-none ${
                      transSymbol === 'ε'
                        ? 'border-purple-600 text-purple-300 bg-purple-950/40'
                        : 'border-slate-700 text-cyan-300 focus:border-cyan-500'
                    }`}
                  >
                    {availableTransitionSymbols.map((sym) => (
                      <option
                        key={sym}
                        value={sym}
                        className={sym === 'ε' ? 'text-purple-400 font-bold bg-slate-900' : 'bg-slate-900'}
                      >
                        {sym === 'ε' ? 'ε' : sym}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-center pt-3 text-slate-500 font-bold">
                  →
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-purple-400 font-mono uppercase">To</span>
                  <select
                    value={nfa.states.includes(transTo) ? transTo : (nfa.states[0] || '')}
                    onChange={(e) => setTransTo(e.target.value)}
                    title="To State"
                    className="w-16 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded px-1.5 py-1 text-purple-200 font-mono text-xs outline-none"
                  >
                    {nfa.states.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-0.5 ml-auto self-end">
                  <button
                    onClick={handleAddTransition}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white font-bold rounded transition text-xs shadow-md shadow-cyan-600/30 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Feedback toast message */}
              {feedback && (
                <div
                  className={`mt-1 text-xs px-2.5 py-1 rounded-md border flex items-center justify-between transition-all ${
                    feedback.type === 'success'
                      ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                      : feedback.type === 'error'
                      ? 'bg-red-950/70 border-red-800 text-red-300'
                      : 'bg-cyan-950/70 border-cyan-800 text-cyan-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    {feedback.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {feedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    {feedback.type === 'info' && <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    <span>{feedback.text}</span>
                  </span>
                  <button
                    onClick={() => setFeedback(null)}
                    className="text-slate-400 hover:text-white ml-2 text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Delete Transition */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400">Delete Transition</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDeleteTrans}
                  onChange={(e) => setSelectedDeleteTrans(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-slate-200 font-mono text-[11px] outline-none"
                >
                  <option value="">- Select -</option>
                  {allTransitionsList.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteTransition}
                  disabled={!selectedDeleteTrans}
                  className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 disabled:opacity-40 text-red-300 font-semibold rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Reset & Sample Controls */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleReset}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset {isEnfa ? 'ε-NFA' : 'NFA'}
              </button>
              <button
                onClick={() => handleLoadSample(isEnfa ? 'sample_enfa_textbook' : 'sample_abc')}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold rounded transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load Sample
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 2: FORMAL DEFINITIONS & EPSILON CLOSURE */}
        <div className="flex flex-col gap-4">
          {/* NFA / ε-NFA Formal Definition */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">
                {isEnfa ? 'ε-NFA Formal Definition' : 'NFA Formal Definition'}
              </h3>
              <span className="text-[10px] text-purple-400 font-mono">
                {isEnfa ? 'δ: Q × (Σ ∪ {ε}) → 𝒫(Q)' : 'δ: Q × Σ → 𝒫(Q)'}
              </span>
            </div>
            <div className="font-mono text-xs text-slate-200 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <p><span className="text-cyan-400 font-bold">Q</span> = {'{' + nfa.states.join(', ') + '}'}</p>
              <p>
                <span className="text-cyan-400 font-bold">Σ</span> = {'{' + nfa.alphabet.join(', ') + '}'}
                {isEnfa && <span className="text-purple-400 font-bold ml-1">∪ {'{ε}'}</span>}
              </p>
              <p><span className="text-cyan-400 font-bold">q₀</span> = {nfa.initial_state || '∅'}</p>
              <p><span className="text-cyan-400 font-bold">F</span> = {'{' + nfa.accepting_states.join(', ') + '}'}</p>
              <p className="text-purple-400 font-bold mt-1">
                {isEnfa ? 'δ : Q × (Σ ∪ {ε}) → 𝒫(Q)' : 'δ : Q × Σ → 𝒫(Q)'}
              </p>
              <div className="max-h-36 overflow-y-auto pl-3 space-y-0.5 text-slate-300 border-l border-slate-800 mt-1">
                {nfaTransitionList.length > 0 ? (
                  nfaTransitionList.map((t, idx) => (
                    <p key={idx} className={t.isEpsilon ? 'text-purple-300 font-bold' : ''}>
                      δ({t.from}, {t.symbol}) = {'{' + t.dests.join(', ') + '}'}
                      {t.isEpsilon && <span className="ml-1 text-[10px] text-purple-400 font-sans font-normal">(ε-transition)</span>}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-600">No transitions defined</p>
                )}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>States: {nfa.states.length}</span>
              <span>Final States: {nfa.accepting_states.length}</span>
              <span>Transitions: {nfaTransitionList.length}</span>
            </div>
          </div>

          {/* ε-Closure Summary Card (Active in ε-NFA mode) */}
          {isEnfa && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  ε-Closures for all States
                </h3>
                <span className="text-[10px] text-purple-300 font-mono bg-purple-950/60 border border-purple-800/80 px-2 py-0.5 rounded">
                  Epsilon Reachability
                </span>
              </div>
              <div className="font-mono text-xs space-y-1.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto">
                {nfa.states.map((s) => {
                  const closure = stateEpsilonClosures[s] || [s];
                  return (
                    <div key={s} className="flex items-center gap-2 text-slate-200">
                      <span className="text-cyan-400 font-bold">ε-closure({s})</span>
                      <span className="text-slate-500">=</span>
                      <span className="text-purple-300 font-bold">{'{' + closure.join(', ') + '}'}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                • ε-closure(q) is the set of all states reachable from q via zero or more ε-transitions.
              </p>
            </div>
          )}

          {/* DFA Formal Definition */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">
                DFA Formal Definition (Equivalence)
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">
                δ : Q × Σ → Q
              </span>
            </div>
            <div className="font-mono text-xs text-slate-200 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <p><span className="text-cyan-400 font-bold">Q</span> = {'{' + dfa.states.join(', ') + '}'}</p>
              <p><span className="text-cyan-400 font-bold">Σ</span> = {'{' + dfa.alphabet.join(', ') + '}'}</p>
              <p><span className="text-cyan-400 font-bold">q₀</span> = {dfa.initial_state || '∅'}</p>
              <p><span className="text-cyan-400 font-bold">F</span> = {'{' + dfa.accepting_states.join(', ') + '}'}</p>
              <p className="text-cyan-400 font-bold mt-1">δ : Q × Σ → Q</p>
              <div className="max-h-36 overflow-y-auto pl-3 space-y-0.5 text-slate-300 border-l border-slate-800 mt-1">
                {dfaTransitionList.length > 0 ? (
                  dfaTransitionList.map((t, idx) => (
                    <p key={idx}>
                      δ({t.from}, {t.symbol}) = {t.dest}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-600">No transitions computed</p>
                )}
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>States: {dfa.states.length}</span>
              <span>Final States: {dfa.accepting_states.length}</span>
              <span>Transitions: {dfaTransitionList.length}</span>
            </div>
          </div>
        </div>

        {/* COLUMN 3: TRANSITION TABLES & STATE MAPPING */}
        <div className="flex flex-col gap-4">
          {/* NFA / ε-NFA Transition Table */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">
                {isEnfa ? 'ε-NFA Transition Table' : 'NFA Transition Table'}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">→: Start, *: Final</span>
            </div>
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2 px-3">δ</th>
                    {nfa.alphabet.map((sym) => (
                      <th key={sym} className="py-2 px-3 text-cyan-300 font-bold text-center">
                        {sym}
                      </th>
                    ))}
                    {isEnfa && (
                      <th className="py-2 px-3 text-purple-300 font-bold text-center bg-purple-950/30">
                        ε
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {nfa.states.map((s) => {
                    const isInit = s === nfa.initial_state;
                    const isFinal = nfa.accepting_states.includes(s);
                    return (
                      <tr key={s} className="hover:bg-slate-900/50 transition">
                        <td className="py-2 px-3 font-bold text-white">
                          {isInit && <span className="text-emerald-400 mr-0.5">→</span>}
                          {isFinal && <span className="text-red-400 mr-0.5">*</span>}
                          {s}
                        </td>
                        {nfa.alphabet.map((sym) => {
                          const dests = nfa.transitions[s]?.[sym] || [];
                          return (
                            <td key={sym} className="py-2 px-3 text-center text-purple-300 font-bold">
                              {dests.length > 0 ? `{${dests.join(', ')}}` : '∅'}
                            </td>
                          );
                        })}
                        {isEnfa && (
                          <td className="py-2 px-3 text-center text-purple-200 font-bold bg-purple-950/20">
                            {(nfa.epsilon_transitions?.[s] || []).length > 0
                              ? `{${nfa.epsilon_transitions[s].join(', ')}}`
                              : '∅'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DFA Transition Table */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">DFA Transition Table</h3>
              <span className="text-[10px] text-slate-400 font-mono">→: Start, *: Final</span>
            </div>
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2 px-3">δ</th>
                    {dfa.alphabet.map((sym) => (
                      <th key={sym} className="py-2 px-3 text-cyan-300 font-bold text-center">
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stateMappings.map((m) => (
                    <tr key={m.dfaName} className="hover:bg-slate-900/50 transition">
                      <td className="py-2 px-3 font-bold text-white">
                        {m.isInitial && <span className="text-emerald-400 mr-0.5">→</span>}
                        {m.isFinal && <span className="text-red-400 mr-0.5">*</span>}
                        <span>{m.dfaName}</span>{' '}
                        <span className="text-slate-400 font-normal text-[11px] font-sans">
                          ({m.subset.join(', ')})
                        </span>
                      </td>
                      {dfa.alphabet.map((sym) => {
                        const target = dfaTransitionsTable[m.dfaName]?.[sym] || '∅';
                        return (
                          <td key={sym} className="py-2 px-3 text-center text-cyan-300 font-bold">
                            {target}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* State Mapping Breakdown */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>State Mapping</span>
              <span className="text-[10px] font-mono text-cyan-400">{stateMappings.length} DFA Subsets</span>
            </h3>
            <div className="font-mono text-xs space-y-1 max-h-44 overflow-y-auto pr-1">
              {stateMappings.map((m) => (
                <div key={m.dfaName} className="flex items-center gap-2 text-slate-300 py-0.5">
                  <span className="text-cyan-400 font-bold">• {m.dfaName}</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-purple-300 font-bold">{m.subsetLabel}</span>
                  {m.closureFormula && (
                    <span className="text-[10px] text-slate-500 italic hidden sm:inline">
                      ({m.closureFormula})
                    </span>
                  )}
                  {m.isFinal && (
                    <span className="text-[10px] font-sans px-1.5 py-0.2 bg-red-950/60 border border-red-800 text-red-300 rounded ml-auto">
                      Final
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM AREA: SIDE-BY-SIDE GRAPH VISUALIZERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* NFA / ε-NFA Graph */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isEnfa ? 'bg-purple-500' : 'bg-cyan-500'}`} />
              {isEnfa ? 'ε-NFA Graph' : 'NFA Graph'}
            </h3>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                isEnfa
                  ? 'text-purple-300 bg-purple-950/60 border-purple-800/80'
                  : 'text-cyan-300 bg-cyan-950/60 border-cyan-800/80'
              }`}
            >
              {nfa.states.length} states · {nfaTransitionList.length} transitions
            </span>
          </div>
          <div className="h-[460px] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <AutomataCanvas
              automaton={nfa}
              readOnly={true}
            />
          </div>
        </div>

        {/* DFA Graph */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              DFA Graph (Equivalent Deterministic Automaton)
            </h3>
            <span className="text-xs font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
              {dfa.states.length} subset states · {dfaTransitionList.length} transitions
            </span>
          </div>
          <div className="h-[460px] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <AutomataCanvas
              automaton={dfa}
              readOnly={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
