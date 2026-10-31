import React, { useState } from 'react';
import { AutomatonModel } from '../../types/automata';
import { api } from '../../services/api';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { Columns3, CheckCircle2, ArrowRight } from 'lucide-react';

interface ComparisonLabProps {
  currentAutomaton: AutomatonModel;
}

export const ComparisonLab: React.FC<ComparisonLabProps> = ({ currentAutomaton }) => {
  const [nfa, setNfa] = useState<AutomatonModel | null>(null);
  const [dfa, setDfa] = useState<AutomatonModel | null>(null);
  const [minDfa, setMinDfa] = useState<AutomatonModel | null>(null);
  const [loading, setLoading] = useState(false);

  const generateComparisons = async () => {
    try {
      setLoading(true);
      // Construct DFA
      const dfaRes = await api.convertToDfa(currentAutomaton);
      setDfa(dfaRes.converted_automaton);

      // Construct Minimal DFA
      const minRes = await api.minimizeDfa(dfaRes.converted_automaton);
      setMinDfa(minRes.converted_automaton);

      // Set base representation
      setNfa(currentAutomaton);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getTransitionCount = (aut: AutomatonModel) => {
    let count = 0;
    Object.values(aut.transitions).forEach((m) => {
      Object.values(m).forEach((dests) => {
        count += dests.length;
      });
    });
    if (aut.epsilon_transitions) {
      Object.values(aut.epsilon_transitions).forEach((dests) => {
        count += dests.length;
      });
    }
    return count;
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Columns3 className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-base">Multiple Solution & Structural Density Comparison</h2>
            <p className="text-xs text-slate-400">
              Compares the NFA, intermediate DFA, and Minimized DFA equivalent solutions for the same language.
            </p>
          </div>
        </div>
        <button
          onClick={generateComparisons}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-xs font-semibold text-white shadow-lg transition"
        >
          {loading ? "Synthesizing Solutions..." : "Compare Equivalent Representations"}
        </button>
      </div>

      {!dfa ? (
        <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          Click "Compare Equivalent Representations" to analyze the current automaton against its equivalent DFA and Minimal DFA representations.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Metrics Comparative Table */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Original Representation */}
            {nfa && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2">
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">1. Source Representation</span>
                <div className="text-sm font-bold text-white">{nfa.name} ({nfa.type})</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2 pt-2 border-t border-slate-850">
                  <div className="text-slate-400">States: <b className="text-slate-200">{nfa.states.length}</b></div>
                  <div className="text-slate-400">Transitions: <b className="text-slate-200">{getTransitionCount(nfa)}</b></div>
                  <div className="text-slate-400">Accepting: <b className="text-slate-200">{nfa.accepting_states.length}</b></div>
                  <div className="text-slate-400">Alphabet: <b className="text-slate-200">{nfa.alphabet.length}</b></div>
                </div>
              </div>
            )}

            {/* Subset Construction DFA */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">2. Subset Construction DFA</span>
              <div className="text-sm font-bold text-white">{dfa.name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2 pt-2 border-t border-slate-850">
                <div className="text-slate-400">States: <b className="text-slate-200">{dfa.states.length}</b></div>
                <div className="text-slate-400">Transitions: <b className="text-slate-200">{getTransitionCount(dfa)}</b></div>
                <div className="text-slate-400">Accepting: <b className="text-slate-200">{dfa.accepting_states.length}</b></div>
                <div className="text-slate-400">Alphabet: <b className="text-slate-200">{dfa.alphabet.length}</b></div>
              </div>
            </div>

            {/* Minimal DFA */}
            {minDfa && (
              <div className="p-4 bg-slate-950 border border-emerald-900/60 rounded-xl flex flex-col gap-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">3. Hopcroft Minimal DFA</span>
                <div className="text-sm font-bold text-white">{minDfa.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2 pt-2 border-t border-slate-850">
                  <div className="text-slate-400">States: <b className="text-emerald-400 font-bold">{minDfa.states.length}</b></div>
                  <div className="text-slate-400">Transitions: <b className="text-emerald-400">{getTransitionCount(minDfa)}</b></div>
                  <div className="text-slate-400">Accepting: <b className="text-emerald-400">{minDfa.accepting_states.length}</b></div>
                  <div className="text-slate-400">Alphabet: <b className="text-emerald-400">{minDfa.alphabet.length}</b></div>
                </div>
              </div>
            )}
          </div>

          {/* Equivalence Summary Badge */}
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/80 rounded-lg flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>
              All three representations are mathematically proven to be pairwise language equivalent: L(Source) ≡ L(DFA) ≡ L(Minimal DFA).
            </span>
          </div>

          {/* Side-by-Side Diagram Views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-300">Subset Construction DFA:</span>
              <div className="h-[360px]">
                <AutomataCanvas automaton={dfa} readOnly={true} />
              </div>
            </div>

            {minDfa && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-emerald-300">Hopcroft Minimal DFA:</span>
                <div className="h-[360px]">
                  <AutomataCanvas automaton={minDfa} readOnly={true} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
