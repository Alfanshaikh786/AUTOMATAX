import React, { useState, useEffect } from 'react';
import { AutomatonModel, EquivalenceResponse } from '../../types/automata';
import { api } from '../../services/api';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { TransitionTable } from '../tables/TransitionTable';
import { Sparkles, Undo2, Save, ArrowRightLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

interface WhatIfLabProps {
  baseAutomaton: AutomatonModel;
  onSaveAsNew: (aut: AutomatonModel) => void;
}

export const WhatIfLab: React.FC<WhatIfLabProps> = ({
  baseAutomaton,
  onSaveAsNew,
}) => {
  const [experimentalAut, setExperimentalAut] = useState<AutomatonModel>({
    ...baseAutomaton,
    id: `${baseAutomaton.id}_whatif`,
    name: `${baseAutomaton.name} (Experimental Branch)`,
  });
  const [comparison, setComparison] = useState<EquivalenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AutomatonModel[]>([baseAutomaton]);

  const testSuite = ['', '0', '1', '00', '01', '10', '11', '000', '001', '010', '011', '100', '101', '110', '111', '0101', '1010'];
  const [impactAnalysis, setImpactAnalysis] = useState<Array<{ string: string; original: boolean; modified: boolean }>>([]);

  const compareAutomata = async (curr: AutomatonModel) => {
    try {
      setLoading(true);
      const res = await api.verifyEquivalence(baseAutomaton, curr);
      setComparison(res);

      // Analyze impact on test strings
      const baseBatch = await api.batchSimulate(baseAutomaton, testSuite);
      const modBatch = await api.batchSimulate(curr, testSuite);

      const diffs: Array<{ string: string; original: boolean; modified: boolean }> = [];
      testSuite.forEach((str, i) => {
        const origAcc = baseBatch.results[i]?.is_accepted ?? false;
        const modAcc = modBatch.results[i]?.is_accepted ?? false;
        diffs.push({ string: str, original: origAcc, modified: modAcc });
      });
      setImpactAnalysis(diffs);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    compareAutomata(experimentalAut);
  }, []);

  const handleUpdate = (updated: AutomatonModel) => {
    setHistory((prev) => [...prev, experimentalAut]);
    setExperimentalAut(updated);
    compareAutomata(updated);
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setExperimentalAut(prev);
      compareAutomata(prev);
    }
  };

  const changedCount = impactAnalysis.filter((d) => d.original !== d.modified).length;

  return (
    <div className="flex flex-col gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-base">What-If Automata Experimentation Laboratory</h2>
            <p className="text-xs text-slate-400">
              Mutate states and transitions in real time to immediately inspect formal language consequence.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1 transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={() => onSaveAsNew(experimentalAut)}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            Save as New Automaton
          </button>
        </div>
      </div>

      {/* Comparison Verdict Header */}
      {comparison && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          comparison.is_equivalent
            ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
            : 'bg-amber-950/30 border-amber-800/80 text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {comparison.is_equivalent ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
            <div>
              <span className="font-bold text-xs uppercase tracking-wide">
                {comparison.is_equivalent ? "Language Preserved (Equivalent)" : "Language Behavior Changed!"}
              </span>
              <p className="text-xs opacity-80 mt-0.5">{comparison.explanation}</p>
            </div>
          </div>

          {!comparison.is_equivalent && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">Diverges on:</span>
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded font-mono font-bold text-xs text-amber-300">
                {comparison.counterexample === "" ? "ε (empty)" : `'${comparison.counterexample}'`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Editor & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[420px]">
          <AutomataCanvas automaton={experimentalAut} onChange={handleUpdate} />
        </div>
        <div className="flex flex-col gap-3">
          <TransitionTable automaton={experimentalAut} onChange={handleUpdate} />

          {/* Test String Impact Matrix */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between text-xs font-semibold mb-2 text-slate-300">
              <span>Test Suite Impact ({changedCount} change{changedCount === 1 ? '' : 's'}):</span>
              <span className="text-[11px] text-slate-400 font-normal">Original vs Experimental</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-36 overflow-y-auto font-mono text-[11px]">
              {impactAnalysis.map((d, i) => {
                const changed = d.original !== d.modified;
                return (
                  <div
                    key={i}
                    className={`p-1.5 rounded border text-center ${
                      changed
                        ? 'bg-amber-950/40 border-amber-700 text-amber-300 font-bold'
                        : d.modified
                        ? 'bg-slate-900 border-slate-800 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div>'{d.string}'</div>
                    <div className="text-[9px] opacity-75">
                      {d.original ? 'ACC' : 'REJ'} → {d.modified ? 'ACC' : 'REJ'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

