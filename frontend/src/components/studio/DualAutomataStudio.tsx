import React, { useState, useMemo } from 'react';
import { AutomatonModel } from '../../types/automata';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import {
  Layers, ArrowRight, Plus, Trash2, RotateCcw,
  Sparkles, Check, CheckCircle2, FileText, Share2, Compass, ExternalLink
} from 'lucide-react';

interface DualAutomataStudioProps {
  onLoadAutomaton: (aut: AutomatonModel) => void;
}

interface StateMapping {
  dfaName: string;
  subset: string[];
  subsetLabel: string;
  isInitial: boolean;
  isFinal: boolean;
}

// Preset Academic Samples
const PRESET_SAMPLES: Record<string, { name: string; nfa: AutomatonModel }> = {
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

export const DualAutomataStudio: React.FC<DualAutomataStudioProps> = ({ onLoadAutomaton }) => {
  // Current NFA state
  const [nfa, setNfa] = useState<AutomatonModel>(PRESET_SAMPLES.sample_abc.nfa);

  // Form input states
  const [inputNewState, setInputNewState] = useState('');
  const [selectedDeleteState, setSelectedDeleteState] = useState('');
  const [inputNewSymbol, setInputNewSymbol] = useState('');
  const [selectedDeleteSymbol, setSelectedDeleteSymbol] = useState('');
  const [selectedAddFinalState, setSelectedAddFinalState] = useState('');
  const [selectedDeleteFinalState, setSelectedDeleteFinalState] = useState('');

  // Transition form states
  const [transSymbol, setTransSymbol] = useState<string>('0');
  const [transFrom, setTransFrom] = useState<string>('A');
  const [transTo, setTransTo] = useState<string>('A');
  const [selectedDeleteTrans, setSelectedDeleteTrans] = useState<string>('');

  // Real-time subset construction algorithm to calculate DFA, formal definitions, and tables
  const { dfa, stateMappings, dfaTransitionsTable, nfaTransitionList, dfaTransitionList } = useMemo(() => {
    if (!nfa.states.length || !nfa.alphabet.length) {
      const emptyDfa: AutomatonModel = {
        id: 'dfa_empty',
        name: 'Empty DFA',
        type: 'DFA',
        states: [],
        alphabet: nfa.alphabet,
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

    // 1. Compile NFA Transition List for formal definition
    const nfaTransList: Array<{ from: string; symbol: string; dests: string[] }> = [];
    nfa.states.forEach((s) => {
      nfa.alphabet.forEach((sym) => {
        const dests = nfa.transitions[s]?.[sym] || [];
        if (dests.length > 0) {
          nfaTransList.push({ from: s, symbol: sym, dests });
        }
      });
    });

    // 2. Subset construction:
    const initialSubset = [nfa.initial_state && nfa.states.includes(nfa.initial_state) ? nfa.initial_state : nfa.states[0]].sort();
    const subsetMap = new Map<string, string>(); // subset.join(',') -> "q0"
    const nameToSubset = new Map<string, string[]>();
    const stateMappingsList: StateMapping[] = [];

    let counter = 0;
    const initialKey = initialSubset.join(',');
    const initialDfaName = `q${counter++}`;
    subsetMap.set(initialKey, initialDfaName);
    nameToSubset.set(initialDfaName, initialSubset);

    stateMappingsList.push({
      dfaName: initialDfaName,
      subset: initialSubset,
      subsetLabel: `{${initialSubset.join(', ')}}`,
      isInitial: true,
      isFinal: initialSubset.some((s) => nfa.accepting_states.includes(s)),
    });

    const queue: string[][] = [initialSubset];
    const dfaTrans: Record<string, Record<string, string[]>> = {};
    const dfaTable: Record<string, Record<string, string>> = {};
    const dfaAcceptingSet = new Set<string>();

    if (initialSubset.some((s) => nfa.accepting_states.includes(s))) {
      dfaAcceptingSet.add(initialDfaName);
    }

    while (queue.length > 0) {
      const currSubset = queue.shift()!;
      const currKey = currSubset.join(',');
      const currDfaName = subsetMap.get(currKey)!;

      if (!dfaTrans[currDfaName]) dfaTrans[currDfaName] = {};
      if (!dfaTable[currDfaName]) dfaTable[currDfaName] = {};

      for (const sym of nfa.alphabet) {
        const nextSet = new Set<string>();
        for (const s of currSubset) {
          const dests = nfa.transitions[s]?.[sym] || [];
          for (const d of dests) {
            nextSet.add(d);
          }
        }

        const sortedNext = Array.from(nextSet).sort();
        if (sortedNext.length === 0) {
          // Dead / trap state or empty
          dfaTrans[currDfaName][sym] = [];
          dfaTable[currDfaName][sym] = '∅';
        } else {
          const nextKey = sortedNext.join(',');
          let nextDfaName = subsetMap.get(nextKey);

          if (!nextDfaName) {
            nextDfaName = `q${counter++}`;
            subsetMap.set(nextKey, nextDfaName);
            nameToSubset.set(nextDfaName, sortedNext);
            queue.push(sortedNext);

            const isAcc = sortedNext.some((s) => nfa.accepting_states.includes(s));
            if (isAcc) {
              dfaAcceptingSet.add(nextDfaName);
            }

            stateMappingsList.push({
              dfaName: nextDfaName,
              subset: sortedNext,
              subsetLabel: `{${sortedNext.join(', ')}}`,
              isInitial: false,
              isFinal: isAcc,
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
      nfa.alphabet.forEach((sym) => {
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
      alphabet: nfa.alphabet,
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
  }, [nfa]);

  // Form Handlers
  const handleAddState = () => {
    const s = inputNewState.trim();
    if (!s) return;
    if (nfa.states.includes(s)) {
      alert(`State '${s}' already exists.`);
      return;
    }
    const newStates = [...nfa.states, s];
    setNfa({
      ...nfa,
      states: newStates,
      initial_state: nfa.initial_state || s,
    });
    setInputNewState('');
  };

  const handleDeleteState = () => {
    if (!selectedDeleteState) return;
    const s = selectedDeleteState;
    const newStates = nfa.states.filter((st) => st !== s);
    const newAcc = nfa.accepting_states.filter((st) => st !== s);
    const newInit = nfa.initial_state === s ? (newStates[0] || '') : nfa.initial_state;

    const newTrans: Record<string, Record<string, string[]>> = {};
    newStates.forEach((st) => {
      newTrans[st] = {};
      if (nfa.transitions[st]) {
        Object.entries(nfa.transitions[st]).forEach(([sym, dests]) => {
          newTrans[st][sym] = dests.filter((d) => d !== s);
        });
      }
    });

    setNfa({
      ...nfa,
      states: newStates,
      initial_state: newInit,
      accepting_states: newAcc,
      transitions: newTrans,
    });
    setSelectedDeleteState('');
  };

  const handleAddSymbol = () => {
    const sym = inputNewSymbol.trim();
    if (!sym) return;
    if (sym === 'ε' || sym === 'e') {
      alert("Ordinary alphabet symbols cannot be ε.");
      return;
    }
    if (nfa.alphabet.includes(sym)) {
      alert(`Symbol '${sym}' already exists.`);
      return;
    }
    const newAlpha = [...nfa.alphabet, sym];
    setNfa({ ...nfa, alphabet: newAlpha });
    setInputNewSymbol('');
  };

  const handleDeleteSymbol = () => {
    if (!selectedDeleteSymbol) return;
    const sym = selectedDeleteSymbol;
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
  };

  const handleSetStartState = (s: string) => {
    setNfa({ ...nfa, initial_state: s });
  };

  const handleAddFinalState = () => {
    if (!selectedAddFinalState) return;
    if (!nfa.accepting_states.includes(selectedAddFinalState)) {
      setNfa({
        ...nfa,
        accepting_states: [...nfa.accepting_states, selectedAddFinalState],
      });
    }
    setSelectedAddFinalState('');
  };

  const handleDeleteFinalState = () => {
    if (!selectedDeleteFinalState) return;
    setNfa({
      ...nfa,
      accepting_states: nfa.accepting_states.filter((s) => s !== selectedDeleteFinalState),
    });
    setSelectedDeleteFinalState('');
  };

  const handleAddTransition = () => {
    if (!transSymbol || !transFrom || !transTo) return;
    const newTrans = { ...nfa.transitions };
    if (!newTrans[transFrom]) newTrans[transFrom] = {};
    const currDests = newTrans[transFrom][transSymbol] || [];
    if (!currDests.includes(transTo)) {
      newTrans[transFrom][transSymbol] = [...currDests, transTo];
    }
    setNfa({ ...nfa, transitions: newTrans });
  };

  const handleDeleteTransition = () => {
    if (!selectedDeleteTrans) return;
    // Format: "from|symbol|to"
    const [from, sym, to] = selectedDeleteTrans.split('|');
    if (!from || !sym || !to) return;

    const newTrans = { ...nfa.transitions };
    if (newTrans[from] && newTrans[from][sym]) {
      newTrans[from][sym] = newTrans[from][sym].filter((d) => d !== to);
    }
    setNfa({ ...nfa, transitions: newTrans });
    setSelectedDeleteTrans('');
  };

  const handleReset = () => {
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
  };

  const handleLoadSample = (sampleKey: string) => {
    if (PRESET_SAMPLES[sampleKey]) {
      setNfa(JSON.parse(JSON.stringify(PRESET_SAMPLES[sampleKey].nfa)));
      if (PRESET_SAMPLES[sampleKey].nfa.states.length > 0) {
        setTransFrom(PRESET_SAMPLES[sampleKey].nfa.states[0]);
        setTransTo(PRESET_SAMPLES[sampleKey].nfa.states[0]);
      }
      if (PRESET_SAMPLES[sampleKey].nfa.alphabet.length > 0) {
        setTransSymbol(PRESET_SAMPLES[sampleKey].nfa.alphabet[0]);
      }
    }
  };

  // Compile all individual transitions for the delete transition dropdown
  const allTransitionsList = useMemo(() => {
    const list: Array<{ label: string; value: string }> = [];
    nfa.states.forEach((s) => {
      nfa.alphabet.forEach((sym) => {
        const dests = nfa.transitions[s]?.[sym] || [];
        dests.forEach((d) => {
          list.push({
            label: `δ(${s}, ${sym}) = {${d}}`,
            value: `${s}|${sym}|${d}`,
          });
        });
      });
    });
    return list;
  }, [nfa]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 pb-12">
      {/* Top Banner & Preset Loader */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Dual Automata Studio (NFA ➔ DFA Real-Time Construction)
              <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded font-mono text-[10px]">
                LIVE REACTIVE ENGINE
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Define any NFA using the input controls. Watch the mathematical 5-tuples, transition tables, subset mappings, and graphs generate simultaneously in real time.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 border border-slate-800 rounded-lg text-xs">
            <span className="text-slate-400 font-semibold">Load Sample:</span>
            <select
              onChange={(e) => handleLoadSample(e.target.value)}
              className="bg-transparent font-medium text-cyan-300 outline-none cursor-pointer"
              defaultValue="sample_abc"
            >
              {Object.entries(PRESET_SAMPLES).map(([key, sample]) => (
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
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Load NFA into Builder
          </button>
        </div>
      </div>

      {/* TOP 3-COLUMN DASHBOARD (Exact layout from user screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* COLUMN 1: CREATE NFA INPUT CONTROLS */}
        <div className="flex flex-col gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Create NFA</h3>
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
              <label className="text-[11px] font-semibold text-slate-400">Add Symbol</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Symbol (e.g. 0, 1, a)"
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
            <div className="flex flex-col gap-1 border-t border-slate-800 pt-2">
              <label className="text-[11px] font-semibold text-cyan-400">
                Add Transition: δ(from, symbol) = to
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={transSymbol}
                  onChange={(e) => setTransSymbol(e.target.value)}
                  title="Symbol"
                  className="w-16 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-1.5 py-1 text-cyan-300 font-mono font-bold outline-none"
                >
                  {nfa.alphabet.map((sym) => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
                <select
                  value={transFrom}
                  onChange={(e) => setTransFrom(e.target.value)}
                  title="From State"
                  className="w-20 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-1.5 py-1 text-slate-200 font-mono outline-none"
                >
                  {nfa.states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="text-slate-500">→</span>
                <select
                  value={transTo}
                  onChange={(e) => setTransTo(e.target.value)}
                  title="To State"
                  className="w-20 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded px-1.5 py-1 text-slate-200 font-mono outline-none"
                >
                  {nfa.states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddTransition}
                  className="flex-1 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded transition"
                >
                  Add
                </button>
              </div>
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
                Reset NFA
              </button>
              <button
                onClick={() => handleLoadSample('sample_abc')}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold rounded transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load Sample Data
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 2: FORMAL DEFINITIONS (NFA & DFA 5-Tuples) */}
        <div className="flex flex-col gap-4">
          {/* NFA Formal Definition */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">
              NFA Formal Definition
            </h3>
            <div className="font-mono text-xs text-slate-200 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <p><span className="text-cyan-400 font-bold">Q</span> = {'{' + nfa.states.join(', ') + '}'}</p>
              <p><span className="text-cyan-400 font-bold">Σ</span> = {'{' + nfa.alphabet.join(', ') + '}'}</p>
              <p><span className="text-cyan-400 font-bold">q₀</span> = {nfa.initial_state || '∅'}</p>
              <p><span className="text-cyan-400 font-bold">F</span> = {'{' + nfa.accepting_states.join(', ') + '}'}</p>
              <p className="text-purple-400 font-bold mt-1">δ : Q × Σ → 𝒫(Q)</p>
              <div className="max-h-36 overflow-y-auto pl-3 space-y-0.5 text-slate-300 border-l border-slate-800 mt-1">
                {nfaTransitionList.length > 0 ? (
                  nfaTransitionList.map((t, idx) => (
                    <p key={idx}>
                      δ({t.from}, {t.symbol}) = {'{' + t.dests.join(', ') + '}'}
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

          {/* DFA Formal Definition */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 shadow-xl">
            <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2">
              DFA Formal Definition
            </h3>
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
          {/* NFA Transition Table */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">NFA Transition Table</h3>
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
            <div className="font-mono text-xs space-y-1 max-h-36 overflow-y-auto pr-1">
              {stateMappings.map((m) => (
                <div key={m.dfaName} className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 font-bold">• {m.dfaName}</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-purple-300 font-bold">{m.subsetLabel}</span>
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
        {/* NFA Graph */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              NFA Graph
            </h3>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-800/80 px-2 py-0.5 rounded">
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
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              DFA Graph
            </h3>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded">
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
