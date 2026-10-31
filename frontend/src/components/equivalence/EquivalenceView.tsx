import React, { useState } from 'react';
import { AutomatonModel, EquivalenceResponse } from '../../types/automata';
import { api } from '../../services/api';
import { CheckCircle2, XCircle, ArrowLeftRight, GitCompare, Play, Sparkles } from 'lucide-react';

interface EquivalenceViewProps {
  availableAutomata: AutomatonModel[];
  currentAutomaton: AutomatonModel;
}

export const EquivalenceView: React.FC<EquivalenceViewProps> = ({
  availableAutomata,
  currentAutomaton,
}) => {
  const [autA, setAutA] = useState<AutomatonModel>(currentAutomaton);
  const [autB, setAutB] = useState<AutomatonModel>(
    availableAutomata.find((a) => a.id !== currentAutomaton.id) || currentAutomaton
  );
  const [result, setResult] = useState<EquivalenceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    try {
      setLoading(true);
      const res = await api.verifyEquivalence(autA, autB);
      setResult(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <GitCompare className="w-6 h-6 text-cyan-400" />
        <div>
          <h2 className="text-lg font-bold text-white">Automata Equivalence & Counterexample Engine</h2>
          <p className="text-xs text-slate-400">
            Mathematically verifies whether two automata accept the exact same formal language L(A) == L(B) via Cartesian product DFS/BFS.
          </p>
        </div>
      </div>

      {/* Selectors for Automata A and B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Automaton A */}
        <div className="flex flex-col gap-2 p-4 bg-slate-950 border border-slate-800 rounded-lg">
          <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Automaton A</label>
          <select
            value={autA.id}
            onChange={(e) => {
              const found = availableAutomata.find((a) => a.id === e.target.value);
              if (found) setAutA(found);
            }}
            className="bg-slate-900 border border-slate-750 rounded p-2 text-sm text-slate-200 outline-none focus:border-cyan-500 font-medium"
          >
            {availableAutomata.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.type}, {a.states.length} states)</option>
            ))}
          </select>
          <div className="text-xs text-slate-400 font-mono mt-1 space-y-0.5">
            <div>States: {'{' + autA.states.join(', ') + '}'}</div>
            <div>Alphabet: {'{' + autA.alphabet.join(', ') + '}'}</div>
            <div>Accepting: {'{' + (autA.accepting_states.join(', ') || '∅') + '}'}</div>
          </div>
        </div>

        {/* Automaton B */}
        <div className="flex flex-col gap-2 p-4 bg-slate-950 border border-slate-800 rounded-lg">
          <label className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Automaton B</label>
          <select
            value={autB.id}
            onChange={(e) => {
              const found = availableAutomata.find((a) => a.id === e.target.value);
              if (found) setAutB(found);
            }}
            className="bg-slate-900 border border-slate-750 rounded p-2 text-sm text-slate-200 outline-none focus:border-purple-500 font-medium"
          >
            {availableAutomata.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.type}, {a.states.length} states)</option>
            ))}
          </select>
          <div className="text-xs text-slate-400 font-mono mt-1 space-y-0.5">
            <div>States: {'{' + autB.states.join(', ') + '}'}</div>
            <div>Alphabet: {'{' + autB.alphabet.join(', ') + '}'}</div>
            <div>Accepting: {'{' + (autB.accepting_states.join(', ') || '∅') + '}'}</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleVerify}
        disabled={loading}
        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white shadow-lg transition flex items-center justify-center gap-2"
      >
        <ArrowLeftRight className="w-4 h-4" />
        {loading ? "Constructing Product Automaton & Verifying..." : "Verify Mathematical Equivalence"}
      </button>

      {/* Result Card */}
      {result && (
        <div className={`p-4 rounded-xl border flex flex-col gap-3 transition ${
          result.is_equivalent
            ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
            : 'bg-rose-950/30 border-rose-800 text-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {result.is_equivalent ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-rose-400 flex-shrink-0" />
            )}
            <div>
              <h3 className="font-bold text-base">
                {result.is_equivalent ? "AUTOMATA ARE MATHEMATICALLY EQUIVALENT" : "AUTOMATA ARE NOT EQUIVALENT"}
              </h3>
              <p className="text-xs opacity-90">{result.explanation}</p>
            </div>
          </div>

          {/* Shortest Counterexample Banner */}
          {!result.is_equivalent && (
            <div className="bg-slate-950/80 border border-rose-800/60 rounded-lg p-3 text-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wide">
                  Shortest Distinguishing Counterexample:
                </span>
                <span className="px-2.5 py-0.5 bg-rose-500/20 border border-rose-500/40 rounded text-rose-300 font-mono font-bold text-sm">
                  {result.counterexample === "" ? "ε (empty string)" : `'${result.counterexample}'`}
                </span>
              </div>

              {/* Side-by-side simulation traces of counterexample */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-xs">
                  <div className="font-semibold text-cyan-400 mb-1">{autA.name} Trace:</div>
                  <div>Input: '{result.counterexample}'</div>
                  <div>Final States: {'{' + (result.trace_a?.final_states.join(', ') || '∅') + '}'}</div>
                  <div className={result.trace_a?.is_accepted ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    Verdict: {result.trace_a?.is_accepted ? "ACCEPTED" : "REJECTED"}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-xs">
                  <div className="font-semibold text-purple-400 mb-1">{autB.name} Trace:</div>
                  <div>Input: '{result.counterexample}'</div>
                  <div>Final States: {'{' + (result.trace_b?.final_states.join(', ') || '∅') + '}'}</div>
                  <div className={result.trace_b?.is_accepted ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    Verdict: {result.trace_b?.is_accepted ? "ACCEPTED" : "REJECTED"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] font-mono opacity-70">
            Total product state pairs explored: {result.details?.product_states_explored}
          </div>
        </div>
      )}
    </div>
  );
};
