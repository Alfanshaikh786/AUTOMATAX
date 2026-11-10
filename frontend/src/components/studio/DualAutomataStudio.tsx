import React, { useState, useMemo, useEffect } from 'react';
import { AutomatonModel } from '../../types/automata';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { api } from '../../services/api';
import {
  Layers, ArrowRight, Plus, Trash2, RotateCcw,
  Sparkles, Check, CheckCircle2, FileText, Share2, Compass, ExternalLink, AlertCircle, Info,
  Workflow, GitFork, Save, Download, Loader2
} from 'lucide-react';

export type StudioMode = 'NFA_TO_DFA' | 'ENFA_TO_NFA' | 'ENFA_TO_DFA';

interface DualAutomataStudioProps {
  onLoadAutomaton: (aut: AutomatonModel) => void;
  initialMode?: 'NFA' | 'ENFA' | 'NFA_TO_DFA' | 'ENFA_TO_NFA' | 'ENFA_TO_DFA';
}

interface StateMapping {
  dfaName: string;
  subset: string[];
  subsetLabel: string;
  isInitial: boolean;
  isFinal: boolean;
  closureFormula?: string;
}

export type DfaNamingScheme = 'aligned' | 'letters' | 'subsets' | 'sequential';

interface DiscoveredSubsetInfo {
  key: string;
  subset: string[];
  isInitial: boolean;
  isFinal: boolean;
  discoveredVia?: {
    fromSubset: string[];
    symbol: string;
  };
}

/**
 * Intelligent DFA State Naming:
 * - 'aligned': Maps singletons {q} to q (e.g. {q1} -> q1, {q2} -> q2), start state to q0,
 *              and composite subsets to q3, q4... to completely eliminate conflicts.
 * - 'letters': Uses distinct uppercase letters (A, B, C...) to cleanly decouple DFA from NFA states.
 * - 'subsets': Uses formal mathematical bracket notation [q0, q1]...
 * - 'sequential': Sequential BFS discovery order (q0, q1, q2...).
 */
function computeDfaSubsetNames(
  discoveredSubsets: DiscoveredSubsetInfo[],
  nfaStates: string[],
  nfaInitialState: string,
  scheme: DfaNamingScheme
): Map<string, string> {
  const subsetKeyToName = new Map<string, string>();
  if (discoveredSubsets.length === 0) return subsetKeyToName;

  if (scheme === 'subsets') {
    discoveredSubsets.forEach((d) => {
      subsetKeyToName.set(d.key, `[${d.subset.join(',')}]`);
    });
    return subsetKeyToName;
  }

  if (scheme === 'letters') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    discoveredSubsets.forEach((d, idx) => {
      const name = idx < letters.length ? letters[idx] : `S${idx}`;
      subsetKeyToName.set(d.key, name);
    });
    return subsetKeyToName;
  }

  if (scheme === 'sequential') {
    let prefix = 'q';
    const match = nfaInitialState.match(/^([a-zA-Z_]+)/);
    if (match) prefix = match[1];
    discoveredSubsets.forEach((d, idx) => {
      subsetKeyToName.set(d.key, `${prefix}${idx}`);
    });
    return subsetKeyToName;
  }

  // Scheme: 'aligned' (Smart Alignment)
  const usedNames = new Set<string>();

  // Detect state naming pattern from NFA states
  let prefix = 'q';
  const match = nfaInitialState.match(/^([a-zA-Z_]+)/);
  if (match) prefix = match[1];
  const isAllLetterStates = nfaStates.length > 0 && nfaStates.every((s) => /^[A-Z]$/.test(s));

  // Pass 1: Assign exact singletons {s} -> s (e.g. {q1} -> q1, {q2} -> q2)
  discoveredSubsets.forEach((d) => {
    if (d.subset.length === 1) {
      const singleState = d.subset[0];
      if (nfaStates.includes(singleState)) {
        subsetKeyToName.set(d.key, singleState);
        usedNames.add(singleState);
      }
    }
  });

  // Pass 2: Assign initial subset if not assigned yet
  const init = discoveredSubsets[0];
  if (init && !subsetKeyToName.has(init.key)) {
    if (!usedNames.has(nfaInitialState)) {
      subsetKeyToName.set(init.key, nfaInitialState);
      usedNames.add(nfaInitialState);
    }
  }

  // Find maximum numeric index used among names like q0, q1...
  let maxIndex = -1;
  usedNames.forEach((name) => {
    const m = name.match(/(\d+)$/);
    if (m) {
      maxIndex = Math.max(maxIndex, parseInt(m[1], 10));
    }
  });
  let nextIdx = Math.max(maxIndex + 1, nfaStates.length);
  let nextLetterCode = 65; // 'A'

  // Pass 3: Assign remaining composite subsets in discovery order
  discoveredSubsets.forEach((d) => {
    if (!subsetKeyToName.has(d.key)) {
      if (isAllLetterStates) {
        while (usedNames.has(String.fromCharCode(nextLetterCode))) {
          nextLetterCode++;
        }
        const newName = String.fromCharCode(nextLetterCode++);
        subsetKeyToName.set(d.key, newName);
        usedNames.add(newName);
      } else {
        while (usedNames.has(`${prefix}${nextIdx}`)) {
          nextIdx++;
        }
        const newName = `${prefix}${nextIdx++}`;
        subsetKeyToName.set(d.key, newName);
        usedNames.add(newName);
      }
    }
  });

  return subsetKeyToName;
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

function normalizeMode(mode?: string): StudioMode {
  if (mode === 'ENFA_TO_NFA') return 'ENFA_TO_NFA';
  if (mode === 'ENFA' || mode === 'ENFA_TO_DFA') return 'ENFA_TO_DFA';
  return 'NFA_TO_DFA';
}

export const DualAutomataStudio: React.FC<DualAutomataStudioProps> = ({
  onLoadAutomaton,
  initialMode = 'NFA_TO_DFA',
}) => {
  // Studio Mode: Standard NFA vs ε-NFA → NFA vs ε-NFA → DFA
  const [studioMode, setStudioMode] = useState<StudioMode>(() => normalizeMode(initialMode));

  // Current Automaton model
  const [nfa, setNfa] = useState<AutomatonModel>(() => {
    const norm = normalizeMode(initialMode);
    return norm === 'NFA_TO_DFA'
      ? PRESET_NFA_SAMPLES.sample_abc.nfa
      : PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa;
  });

  // Sync mode if initialMode changes
  useEffect(() => {
    if (initialMode) {
      const norm = normalizeMode(initialMode);
      if (norm !== studioMode) {
        setStudioMode(norm);
        if (norm === 'NFA_TO_DFA' && nfa.type === 'ENFA') {
          setNfa(JSON.parse(JSON.stringify(PRESET_NFA_SAMPLES.sample_abc.nfa)));
        } else if ((norm === 'ENFA_TO_NFA' || norm === 'ENFA_TO_DFA') && nfa.type !== 'ENFA') {
          setNfa(JSON.parse(JSON.stringify(PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa)));
        }
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

  // Complete DFA mode: includes Dead / Trap State '∅' so every state has an exact transition for each symbol
  const [includeDeadState, setIncludeDeadState] = useState<boolean>(true);

  // DFA State Naming Scheme: 'aligned' (default: eliminates conflicts), 'letters', 'subsets', 'sequential'
  const [dfaNamingScheme, setDfaNamingScheme] = useState<DfaNamingScheme>('aligned');

  const isEnfa = studioMode === 'ENFA_TO_NFA' || studioMode === 'ENFA_TO_DFA';
  const isEnfaToNfa = studioMode === 'ENFA_TO_NFA';

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

    // DFA alphabet strictly excludes ε
    const dfaAlphabet = nfa.alphabet.filter((sym) => sym !== 'ε');

    // Step A: Explore reachable subsets via BFS using canonical keys
    const discoveredSubsets: DiscoveredSubsetInfo[] = [];
    const discoveredKeySet = new Set<string>();
    const queue: string[][] = [];

    const initialKey = initialSubset.join(',');
    discoveredKeySet.add(initialKey);
    discoveredSubsets.push({
      key: initialKey,
      subset: initialSubset,
      isInitial: true,
      isFinal: initialSubset.some((s) => nfa.accepting_states.includes(s)),
    });
    queue.push(initialSubset);

    // Track transitions between subset keys
    // fromKey -> symbol -> nextKey | '__DEAD__' | 'EMPTY'
    const subsetTransitions: Record<string, Record<string, string>> = {};
    const DEAD_KEY = '__DEAD__';
    let deadStateNeeded = false;

    while (queue.length > 0) {
      const currSubset = queue.shift()!;
      const currKey = currSubset.join(',');
      if (!subsetTransitions[currKey]) subsetTransitions[currKey] = {};

      for (const sym of dfaAlphabet) {
        const moveSet = getMove(currSubset, sym, nfa.transitions);
        const nextSubset = isEnfa
          ? getSetEpsilonClosure(moveSet, nfa.states, nfa.epsilon_transitions || {})
          : moveSet;

        if (nextSubset.length === 0) {
          if (includeDeadState) {
            deadStateNeeded = true;
            subsetTransitions[currKey][sym] = DEAD_KEY;
          } else {
            subsetTransitions[currKey][sym] = 'EMPTY';
          }
        } else {
          const nextKey = nextSubset.join(',');
          if (!discoveredKeySet.has(nextKey)) {
            discoveredKeySet.add(nextKey);
            discoveredSubsets.push({
              key: nextKey,
              subset: nextSubset,
              isInitial: false,
              isFinal: nextSubset.some((s) => nfa.accepting_states.includes(s)),
              discoveredVia: {
                fromSubset: currSubset,
                symbol: sym,
              },
            });
            queue.push(nextSubset);
          }
          subsetTransitions[currKey][sym] = nextKey;
        }
      }
    }

    // Step B: Assign state names based on chosen naming scheme
    const subsetKeyToName = computeDfaSubsetNames(
      discoveredSubsets,
      nfa.states,
      rawStart,
      dfaNamingScheme
    );

    const DEAD_STATE_NAME = '∅';
    const initialDfaName = subsetKeyToName.get(initialKey) || 'q0';

    // Step C: Construct StateMapping items with accurate subset derivation formulas
    const rawStateMappings: StateMapping[] = discoveredSubsets.map((d) => {
      const dfaName = subsetKeyToName.get(d.key)!;
      let closureFormula: string | undefined = undefined;

      if (d.isInitial) {
        closureFormula = isEnfa ? `ε-closure({${rawStart}})` : `{${rawStart}}`;
      } else if (d.discoveredVia) {
        const fromSubsetStr = `{${d.discoveredVia.fromSubset.join(', ')}}`;
        closureFormula = isEnfa
          ? `ε-closure(move(${fromSubsetStr}, ${d.discoveredVia.symbol}))`
          : `move(${fromSubsetStr}, ${d.discoveredVia.symbol})`;
      }

      return {
        dfaName,
        subset: d.subset,
        subsetLabel: `{${d.subset.join(', ')}}`,
        isInitial: d.isInitial,
        isFinal: d.isFinal,
        closureFormula,
      };
    });

    // Dead / Trap State mapping if needed in Complete DFA mode
    if (includeDeadState && deadStateNeeded) {
      rawStateMappings.push({
        dfaName: DEAD_STATE_NAME,
        subset: [],
        subsetLabel: '∅',
        isInitial: false,
        isFinal: false,
        closureFormula: 'Dead / Trap State (Total Function)',
      });
    }

    // Step D: Order StateMappings:
    // Initial state ALWAYS first, followed by remaining states sorted by natural name order, followed by dead state
    const initMapping = rawStateMappings.find((m) => m.isInitial);
    const deadMapping = rawStateMappings.find((m) => m.dfaName === DEAD_STATE_NAME);
    const otherMappings = rawStateMappings.filter((m) => !m.isInitial && m.dfaName !== DEAD_STATE_NAME);

    otherMappings.sort((a, b) =>
      a.dfaName.localeCompare(b.dfaName, undefined, { numeric: true, sensitivity: 'base' })
    );

    const stateMappingsList: StateMapping[] = [
      ...(initMapping ? [initMapping] : []),
      ...otherMappings,
      ...(deadMapping ? [deadMapping] : []),
    ];

    // Step E: Construct DFA transition table and transition records
    const dfaTrans: Record<string, Record<string, string[]>> = {};
    const dfaTable: Record<string, Record<string, string>> = {};
    const dfaAcceptingSet = new Set<string>();

    stateMappingsList.forEach((m) => {
      if (m.isFinal) {
        dfaAcceptingSet.add(m.dfaName);
      }
    });

    discoveredSubsets.forEach((d) => {
      const fromName = subsetKeyToName.get(d.key)!;
      if (!dfaTrans[fromName]) dfaTrans[fromName] = {};
      if (!dfaTable[fromName]) dfaTable[fromName] = {};

      for (const sym of dfaAlphabet) {
        const targetKey = subsetTransitions[d.key]?.[sym];
        if (!targetKey || targetKey === 'EMPTY') {
          dfaTrans[fromName][sym] = [];
          dfaTable[fromName][sym] = '∅';
        } else if (targetKey === DEAD_KEY) {
          dfaTrans[fromName][sym] = [DEAD_STATE_NAME];
          dfaTable[fromName][sym] = DEAD_STATE_NAME;
        } else {
          const targetName = subsetKeyToName.get(targetKey)!;
          dfaTrans[fromName][sym] = [targetName];
          dfaTable[fromName][sym] = targetName;
        }
      }
    });

    // Dead state loopback transitions
    if (includeDeadState && deadStateNeeded) {
      dfaTrans[DEAD_STATE_NAME] = {};
      dfaTable[DEAD_STATE_NAME] = {};
      dfaAlphabet.forEach((sym) => {
        dfaTrans[DEAD_STATE_NAME][sym] = [DEAD_STATE_NAME];
        dfaTable[DEAD_STATE_NAME][sym] = DEAD_STATE_NAME;
      });
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
  }, [nfa, isEnfa, includeDeadState, dfaNamingScheme]);

  // ε-NFA to standard NFA (Epsilon-Elimination algorithm)
  const enfaToNfaResult = useMemo(() => {
    if (!nfa.states.length || !nfa.alphabet.length) {
      const emptyNfa: AutomatonModel = {
        id: 'nfa_empty',
        name: 'Empty NFA',
        type: 'NFA',
        states: [],
        alphabet: nfa.alphabet.filter((s) => s !== 'ε'),
        initial_state: '',
        accepting_states: [],
        transitions: {},
        epsilon_transitions: {},
      };
      return {
        targetNfa: emptyNfa,
        targetTransitionsTable: {},
        targetTransitionList: [],
        transitionDerivations: [],
        acceptingDerivations: [],
      };
    }

    const targetAlphabet = nfa.alphabet.filter((sym) => sym !== 'ε');
    const targetStates = [...nfa.states];

    // 1. Closures for every state
    const closures: Record<string, string[]> = {};
    nfa.states.forEach((s) => {
      closures[s] = getEpsilonClosure(s, nfa.states, nfa.epsilon_transitions || {});
    });

    // 2. Transitions: δ'(q, a) = ε-closure(move(ε-closure(q), a))
    const targetTransitions: Record<string, Record<string, string[]>> = {};
    const targetTransitionTable: Record<string, Record<string, string>> = {};
    const transitionDerivations: Array<{
      from: string;
      symbol: string;
      closureOfFrom: string[];
      moveSet: string[];
      closureOfMove: string[];
      formula: string;
    }> = [];

    nfa.states.forEach((q) => {
      targetTransitions[q] = {};
      targetTransitionTable[q] = {};
      const cq = closures[q] || [q];

      targetAlphabet.forEach((a) => {
        const moveSet = getMove(cq, a, nfa.transitions);
        const destClosure = getSetEpsilonClosure(moveSet, nfa.states, nfa.epsilon_transitions || {});
        targetTransitions[q][a] = destClosure;
        targetTransitionTable[q][a] = destClosure.length > 0 ? `{${destClosure.join(', ')}}` : '∅';

        transitionDerivations.push({
          from: q,
          symbol: a,
          closureOfFrom: cq,
          moveSet,
          closureOfMove: destClosure,
          formula: `δ'(${q}, ${a}) = ε-closure(move({${cq.join(', ')}}, ${a})) = ${destClosure.length > 0 ? `{${destClosure.join(', ')}}` : '∅'
            }`,
        });
      });
    });

    // 3. Updated accepting states F' = { q ∈ Q | ε-closure(q) ∩ F ≠ ∅ }
    const origAcceptingSet = new Set(nfa.accepting_states);
    const targetAcceptingStates: string[] = [];
    const acceptingDerivations: Array<{ state: string; isAccepting: boolean; intersection: string[] }> = [];

    nfa.states.forEach((q) => {
      const cq = closures[q] || [q];
      const inter = cq.filter((s) => origAcceptingSet.has(s));
      const isAcc = inter.length > 0;
      if (isAcc) {
        targetAcceptingStates.push(q);
      }
      acceptingDerivations.push({
        state: q,
        isAccepting: isAcc,
        intersection: inter,
      });
    });

    const targetNfaModel: AutomatonModel = {
      id: `${nfa.id}_nfa_elim`,
      name: `${nfa.name} (Epsilon-Free NFA)`,
      type: 'NFA',
      states: targetStates,
      alphabet: targetAlphabet,
      initial_state: nfa.initial_state,
      accepting_states: targetAcceptingStates,
      transitions: targetTransitions,
      epsilon_transitions: {},
    };

    const targetTransList: Array<{ from: string; symbol: string; dests: string[] }> = [];
    targetStates.forEach((s) => {
      targetAlphabet.forEach((sym) => {
        const dests = targetTransitions[s]?.[sym] || [];
        if (dests.length > 0) {
          targetTransList.push({ from: s, symbol: sym, dests });
        }
      });
    });

    return {
      targetNfa: targetNfaModel,
      targetTransitionsTable: targetTransitionTable,
      targetTransitionList: targetTransList,
      transitionDerivations,
      acceptingDerivations,
    };
  }, [nfa]);

  // Save & PDF Export States and Handlers
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleSaveConversion = async () => {
    try {
      setIsSaving(true);
      const targetAut = isEnfaToNfa ? enfaToNfaResult.targetNfa : dfa;
      const savedTarget = await api.save(targetAut);
      const savedSource = await api.save(nfa);
      onLoadAutomaton(savedTarget);
      setFeedback({
        type: 'success',
        text: `✓ Saved both '${savedSource.name}' and '${savedTarget.name}' to persistent storage.`,
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
      const targetAut = isEnfaToNfa ? enfaToNfaResult.targetNfa : dfa;

      // State mappings with derivations
      const mappingsPayload = stateMappings.map((m) => {
        const transList: string[] = [];
        targetAut.alphabet.forEach((sym) => {
          const dest = dfaTransitionsTable[m.dfaName]?.[sym] || '∅';
          transList.push(`δ(${m.dfaName}, ${sym}) = ${dest}`);
        });
        return {
          label: m.dfaName,
          subset: m.subset,
          derivations: transList.join(' | '),
          is_final: m.isFinal,
        };
      });

      // Simulation test cases on alphabet
      const baseChars = nfa.alphabet.filter((x) => x !== 'ε');
      const testCases: string[] = [''];
      if (baseChars.length > 0) {
        testCases.push(baseChars[0]);
        if (baseChars.length > 1) {
          testCases.push(baseChars[1]);
          testCases.push(baseChars[0] + baseChars[1]);
          testCases.push(baseChars[1] + baseChars[0]);
        }
        testCases.push(baseChars[0] + baseChars[0]);
      }

      const runNfaSim = (str: string): boolean => {
        const epsClosure = (st: Set<string>): Set<string> => {
          const res = new Set(st);
          const q = [...st];
          while (q.length > 0) {
            const curr = q.pop()!;
            const epsDests = nfa.epsilon_transitions?.[curr] || [];
            for (const d of epsDests) {
              if (!res.has(d)) {
                res.add(d);
                q.push(d);
              }
            }
          }
          return res;
        };

        let curr = isEnfa ? epsClosure(new Set([nfa.initial_state])) : new Set([nfa.initial_state]);
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          const next = new Set<string>();
          for (const s of curr) {
            const dests = nfa.transitions[s]?.[ch] || [];
            dests.forEach((d) => next.add(d));
          }
          curr = isEnfa ? epsClosure(next) : next;
        }
        return [...curr].some((s) => nfa.accepting_states.includes(s));
      };

      const runDfaSim = (str: string): boolean => {
        let curr = targetAut.initial_state;
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          const dest = targetAut.transitions[curr]?.[ch]?.[0];
          if (!dest) return false;
          curr = dest;
        }
        return targetAut.accepting_states.includes(curr);
      };

      const testResults = testCases.map((tc) => ({
        string: tc,
        source_accepted: runNfaSim(tc),
        target_accepted: runDfaSim(tc),
      }));

      const reportTitle = isEnfaToNfa
        ? `${nfa.name} (ε-NFA) to ${targetAut.name} (NFA) ε-Elimination Laboratory Report`
        : isEnfa
        ? `${nfa.name} (ε-NFA) to ${targetAut.name} (DFA) Epsilon Subset Construction Report`
        : `${nfa.name} (NFA) to ${targetAut.name} (DFA) Subset Construction Laboratory Report`;

      const blob = await api.downloadConversionPdf({
        source_automaton: nfa,
        target_automaton: targetAut,
        title: reportTitle,
        conversion_type: studioMode,
        state_mappings: isEnfaToNfa ? undefined : mappingsPayload,
        epsilon_closures: isEnfa ? stateEpsilonClosures : undefined,
        test_results: testResults,
        notes: `Report synthesized via AutomataX Dual Automata Studio. Generated mathematical specification verified for language acceptance consistency across tested input traces.`,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nfa.name.replace(/\s+/g, '_')}_conversion_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        text: '✓ Downloaded full academic PDF report successfully.',
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

  // Mode Switcher Handler
  const handleSwitchMode = (mode: StudioMode) => {
    if (mode === studioMode) return;
    setStudioMode(mode);
    if (mode === 'NFA_TO_DFA') {
      const preset = JSON.parse(JSON.stringify(PRESET_NFA_SAMPLES.sample_abc.nfa));
      setNfa(preset);
      setTransFrom(preset.states[0]);
      setTransTo(preset.states[0]);
      setTransSymbol(preset.alphabet[0] || '0');
      setFeedback({ type: 'info', text: 'Switched to Standard NFA → DFA Studio (Subset Construction).' });
    } else if (mode === 'ENFA_TO_NFA') {
      const preset = JSON.parse(JSON.stringify(PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa));
      setNfa(preset);
      setTransFrom(preset.states[0]);
      setTransTo(preset.states[0]);
      setTransSymbol(preset.alphabet[0] || 'ε');
      setFeedback({ type: 'info', text: 'Switched to ε-NFA → NFA Studio (Epsilon Elimination).' });
    } else {
      const preset = JSON.parse(JSON.stringify(PRESET_ENFA_SAMPLES.sample_enfa_textbook.enfa));
      setNfa(preset);
      setTransFrom(preset.states[0]);
      setTransTo(preset.states[0]);
      setTransSymbol(preset.alphabet[0] || 'ε');
      setFeedback({ type: 'info', text: 'Switched to ε-NFA → DFA Studio (Epsilon Subset Construction).' });
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
            className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${isEnfaToNfa
                ? 'from-indigo-600 to-purple-600 shadow-indigo-600/20'
                : isEnfa
                  ? 'from-purple-600 to-indigo-600 shadow-purple-600/20'
                  : 'from-cyan-600 to-blue-600 shadow-cyan-600/20'
              } flex items-center justify-center text-white shadow-lg`}
          >
            {isEnfaToNfa ? <Sparkles className="w-5 h-5" /> : isEnfa ? <GitFork className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {isEnfaToNfa
                ? 'Dual ε-NFA ➔ NFA Studio'
                : isEnfa
                  ? 'Dual ε-NFA ➔ DFA Studio'
                  : 'Dual NFA ➔ DFA Studio'}
              <span
                className={`px-2 py-0.5 border rounded font-mono text-[10px] ${isEnfaToNfa
                    ? 'bg-indigo-950 border-indigo-800 text-indigo-300'
                    : isEnfa
                      ? 'bg-purple-950 border-purple-800 text-purple-300'
                      : 'bg-cyan-950 border-cyan-800 text-cyan-300'
                  }`}
              >
                {isEnfaToNfa ? 'EPSILON ELIMINATION ENGINE' : isEnfa ? 'EPSILON CLOSURE ENGINE' : 'LIVE REACTIVE ENGINE'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isEnfaToNfa
                ? "Define any ε-NFA with spontaneous transitions. Watch the ε-elimination algorithm δ'(q, a) = ε-closure(move(ε-closure(q), a)), updated final states, tables, and graphs generate in real time."
                : isEnfa
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
              onClick={() => handleSwitchMode('NFA_TO_DFA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${studioMode === 'NFA_TO_DFA'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              NFA → DFA
            </button>
            <button
              onClick={() => handleSwitchMode('ENFA_TO_NFA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${studioMode === 'ENFA_TO_NFA'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ε-NFA → NFA
            </button>
            <button
              onClick={() => handleSwitchMode('ENFA_TO_DFA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${studioMode === 'ENFA_TO_DFA'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              ε-NFA → DFA
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

          {/* Save Conversion Button */}
          <button
            onClick={handleSaveConversion}
            disabled={isSaving}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow disabled:opacity-50"
            title="Save both source automaton and converted target automaton to persistent storage"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {/* Download Full PDF Report Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow disabled:opacity-50"
            title="Download full academic PDF report with formal specifications, transition tables, subset derivations, and verification"
          >
            {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isDownloadingPdf ? 'Compiling PDF...' : 'Download PDF'}
          </button>

          <button
            onClick={() => onLoadAutomaton(isEnfaToNfa ? enfaToNfaResult.targetNfa : dfa)}
            className={`px-3 py-1.5 ${isEnfaToNfa ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-cyan-600 hover:bg-cyan-500'
              } text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Load {isEnfaToNfa ? 'Converted NFA' : 'DFA'} into Builder
          </button>

          <button
            onClick={() => onLoadAutomaton(nfa)}
            className={`px-3 py-1.5 ${isEnfa ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'
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
                    className={`w-16 bg-slate-900 border rounded px-1.5 py-1 font-mono font-bold text-xs outline-none ${transSymbol === 'ε'
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
                  className={`mt-1 text-xs px-2.5 py-1 rounded-md border flex items-center justify-between transition-all ${feedback.type === 'success'
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


          {isEnfaToNfa ? (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-white text-sm">
                  NFA Formal Definition (Epsilon-Free)
                </h3>
                <span className="text-[10px] text-indigo-400 font-mono">
                  δ' : Q × Σ → 𝒫(Q)
                </span>
              </div>
              <div className="font-mono text-xs text-slate-200 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <p><span className="text-cyan-400 font-bold">Q</span> = {'{' + enfaToNfaResult.targetNfa.states.join(', ') + '}'}</p>
                <p><span className="text-cyan-400 font-bold">Σ</span> = {'{' + enfaToNfaResult.targetNfa.alphabet.join(', ') + '}'}</p>
                <p><span className="text-cyan-400 font-bold">q₀</span> = {enfaToNfaResult.targetNfa.initial_state || '∅'}</p>
                <p><span className="text-cyan-400 font-bold">F'</span> = {'{' + enfaToNfaResult.targetNfa.accepting_states.join(', ') + '}'}</p>
                <p className="text-indigo-400 font-bold mt-1">
                  δ' : Q × Σ → 𝒫(Q) [ε-Eliminated Transitions]
                </p>
                <div className="max-h-36 overflow-y-auto pl-3 space-y-0.5 text-slate-300 border-l border-slate-800 mt-1">
                  {enfaToNfaResult.targetTransitionList.length > 0 ? (
                    enfaToNfaResult.targetTransitionList.map((t, idx) => (
                      <p key={idx} className="text-indigo-300">
                        δ'({t.from}, {t.symbol}) = {'{' + t.dests.join(', ') + '}'}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-600">No transitions computed</p>
                  )}
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>States: {enfaToNfaResult.targetNfa.states.length}</span>
                <span>Final States: {enfaToNfaResult.targetNfa.accepting_states.length}</span>
                <span>Transitions: {enfaToNfaResult.targetTransitionList.length}</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-white text-sm">
                  DFA Formal Definition (Equivalence)
                </h3>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {includeDeadState ? 'Total Function δ: Q × Σ → Q' : 'δ : Q × Σ → Q'}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-200 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <p><span className="text-cyan-400 font-bold">Q</span> = {'{' + dfa.states.join(', ') + '}'}</p>
                <p><span className="text-cyan-400 font-bold">Σ</span> = {'{' + dfa.alphabet.join(', ') + '}'}</p>
                <p><span className="text-cyan-400 font-bold">q₀</span> = {dfa.initial_state || '∅'}</p>
                <p><span className="text-cyan-400 font-bold">F</span> = {'{' + dfa.accepting_states.join(', ') + '}'}</p>
                <p className="text-cyan-400 font-bold mt-1">
                  {includeDeadState ? 'δ : Q × Σ → Q (Total Function)' : 'δ : Q × Σ → Q'}
                </p>
                <div className="max-h-36 overflow-y-auto pl-3 space-y-0.5 text-slate-300 border-l border-slate-800 mt-1">
                  {dfaTransitionList.length > 0 ? (
                    dfaTransitionList.map((t, idx) => (
                      <p key={idx} className={t.dest === '∅' || t.from === '∅' ? 'text-amber-300' : ''}>
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
          )}
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

          {/* Converted Transition Table (NFA in ENFA_TO_NFA mode, DFA otherwise) */}
          {isEnfaToNfa ? (
            <>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">NFA Transition Table (Epsilon-Free)</h3>
                    <span className="text-[10px] text-slate-400 font-mono">→: Start, *: Final</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800/80 px-2 py-0.5 rounded">
                    Epsilon Removed
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/80">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2 px-3">δ'</th>
                        {enfaToNfaResult.targetNfa.alphabet.map((sym) => (
                          <th key={sym} className="py-2 px-3 text-cyan-300 font-bold text-center">
                            {sym}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {enfaToNfaResult.targetNfa.states.map((s) => {
                        const isInit = s === enfaToNfaResult.targetNfa.initial_state;
                        const isFinal = enfaToNfaResult.targetNfa.accepting_states.includes(s);
                        return (
                          <tr key={s} className="hover:bg-slate-900/50 transition">
                            <td className="py-2 px-3 font-bold text-white">
                              {isInit && <span className="text-emerald-400 mr-0.5">→</span>}
                              {isFinal && <span className="text-red-400 mr-0.5">*</span>}
                              <span>{s}</span>
                            </td>
                            {enfaToNfaResult.targetNfa.alphabet.map((sym) => {
                              const dests = enfaToNfaResult.targetNfa.transitions[s]?.[sym] || [];
                              return (
                                <td
                                  key={sym}
                                  className={`py-2 px-3 text-center font-bold ${dests.length === 0 ? 'text-amber-400/90' : 'text-indigo-300'
                                    }`}
                                >
                                  {dests.length > 0 ? `{${dests.join(', ')}}` : '∅'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Epsilon Elimination Step-by-Step Derivations */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
                <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-1.5 flex items-center justify-between">
                  <span>Epsilon Elimination Derivations</span>
                  <span className="text-[10px] font-mono text-indigo-400">
                    δ'(q, a) = ε-closure(move(ε-closure(q), a))
                  </span>
                </h3>
                <div className="font-mono text-xs space-y-2 max-h-48 overflow-y-auto pr-1">
                  {enfaToNfaResult.transitionDerivations.map((d, idx) => (
                    <div key={idx} className="text-slate-300 py-1 border-b border-slate-800/50">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                        <span>• δ'({d.from}, {d.symbol})</span>
                        <span className="text-slate-500">=</span>
                        <span className={d.closureOfMove.length > 0 ? 'text-cyan-300' : 'text-amber-400'}>
                          {d.closureOfMove.length > 0 ? `{${d.closureOfMove.join(', ')}}` : '∅'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans pl-2.5">
                        move({'{' + d.closureOfFrom.join(', ') + '}'}, {d.symbol}) = {'{' + (d.moveSet.length > 0 ? d.moveSet.join(', ') : '∅') + '}'} → ε-closure = {'{' + (d.closureOfMove.length > 0 ? d.closureOfMove.join(', ') : '∅') + '}'}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-slate-300">
                    <span className="text-amber-400 font-bold text-[11px]">Updated Accepting States F':</span>
                    {enfaToNfaResult.acceptingDerivations.map((ad) => (
                      <div key={ad.state} className="text-[10px] pl-2 py-0.5 text-slate-400">
                        • {ad.state}: ε-closure({ad.state}) ∩ F = {ad.intersection.length > 0 ? `{${ad.intersection.join(', ')}}` : '∅'}{' '}
                        {ad.isAccepting ? <span className="text-emerald-400 font-bold">→ Final State</span> : <span className="text-slate-500">→ Non-final</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* DFA Transition Table */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">DFA Transition Table</h3>
                    <span className="text-[10px] text-slate-400 font-mono">→: Start, *: Final</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={includeDeadState}
                      onChange={(e) => setIncludeDeadState(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold text-cyan-400">Complete DFA (Dead State ∅)</span>
                  </label>
                </div>

                {/* State Naming Scheme Selector (Prevents q1 / q2 conflict) */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-0.5 pb-1 border-b border-slate-800/60">
                  <span className="text-slate-400 text-[11px] font-sans">State Naming:</span>
                  <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setDfaNamingScheme('aligned')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        dfaNamingScheme === 'aligned'
                          ? 'bg-cyan-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Smart alignment with NFA states (e.g. {q1} → q1, {q2} → q2 to eliminate naming conflicts)"
                    >
                      q₀, q₁ (Aligned)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDfaNamingScheme('letters')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        dfaNamingScheme === 'letters'
                          ? 'bg-cyan-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Distinct capital letters (A, B, C...) to completely separate DFA and NFA states"
                    >
                      A, B, C (Letters)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDfaNamingScheme('subsets')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        dfaNamingScheme === 'subsets'
                          ? 'bg-cyan-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Direct mathematical subset notation [q0, q1]..."
                    >
                      [q₀, q₁] (Subsets)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDfaNamingScheme('sequential')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        dfaNamingScheme === 'sequential'
                          ? 'bg-cyan-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Sequential BFS discovery order"
                    >
                      Sequential
                    </button>
                  </div>
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
                        <tr
                          key={m.dfaName}
                          className={`hover:bg-slate-900/50 transition ${m.dfaName === '∅' ? 'bg-amber-950/20 border-t border-amber-900/30' : ''
                            }`}
                        >
                          <td className="py-2 px-3 font-bold text-white">
                            {m.isInitial && <span className="text-emerald-400 mr-0.5">→</span>}
                            {m.isFinal && <span className="text-red-400 mr-0.5">*</span>}
                            <span className={m.dfaName === '∅' ? 'text-amber-300 font-bold' : ''}>
                              {m.dfaName}
                            </span>{' '}
                            <span className="text-slate-400 font-normal text-[11px] font-sans">
                              ({m.subset.length > 0 ? m.subset.join(', ') : 'Dead State'})
                            </span>
                          </td>
                          {dfa.alphabet.map((sym) => {
                            const target = dfaTransitionsTable[m.dfaName]?.[sym] || '∅';
                            return (
                              <td
                                key={sym}
                                className={`py-2 px-3 text-center font-bold ${target === '∅' ? 'text-amber-400/90' : 'text-cyan-300'
                                  }`}
                              >
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
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 flex-wrap gap-1">
                  <h3 className="font-bold text-white text-sm">State Mapping</h3>
                  <span className="text-[10px] font-mono text-cyan-400">{stateMappings.length} DFA Subsets</span>
                </div>
                <div className="font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {stateMappings.map((m) => (
                    <div key={m.dfaName} className="flex items-center gap-2 text-slate-300 py-0.5 flex-wrap">
                      <span className={`font-bold ${m.dfaName === '∅' ? 'text-amber-400' : 'text-cyan-400'}`}>
                        • {m.dfaName}
                      </span>
                      <span className="text-slate-500">=</span>
                      <span className={`font-bold ${m.dfaName === '∅' ? 'text-amber-300' : 'text-purple-300'}`}>
                        {m.subsetLabel}
                      </span>
                      {m.closureFormula && (
                        <span className="text-[10px] text-slate-400 font-sans italic bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800/80">
                          ({m.closureFormula})
                        </span>
                      )}
                      {m.isFinal ? (
                        <span className="text-[10px] font-sans px-1.5 py-0.2 bg-red-950/60 border border-red-800 text-red-300 rounded ml-auto">
                          Final
                        </span>
                      ) : m.dfaName === '∅' ? (
                        <span className="text-[10px] font-sans px-1.5 py-0.2 bg-amber-950/60 border border-amber-800 text-amber-300 rounded ml-auto">
                          Trap State
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 italic border-t border-slate-800/60 pt-1">
                  • Each DFA state represents a subset of NFA states. Singletons align with original NFA states to preserve identity and prevent naming conflicts.
                </p>
              </div>
            </>
          )}
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
              className={`text-xs font-mono px-2 py-0.5 rounded border ${isEnfa
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

        {/* Converted Target Graph (NFA or DFA) */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isEnfaToNfa ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              {isEnfaToNfa
                ? 'NFA Graph (Equivalent Epsilon-Free Automaton)'
                : `DFA Graph (${includeDeadState ? 'Complete Total Automaton' : 'Equivalent DFA'})`}
            </h3>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${isEnfaToNfa
                  ? 'text-indigo-300 bg-indigo-950/60 border-indigo-800/80'
                  : 'text-emerald-300 bg-emerald-950/60 border-emerald-800/80'
                }`}
            >
              {isEnfaToNfa
                ? `${enfaToNfaResult.targetNfa.states.length} states · ${enfaToNfaResult.targetTransitionList.length} transitions`
                : `${dfa.states.length} subset states · ${dfaTransitionList.length} transitions`}
            </span>
          </div>
          <div className="h-[460px] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
            <AutomataCanvas
              automaton={isEnfaToNfa ? enfaToNfaResult.targetNfa : dfa}
              readOnly={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
