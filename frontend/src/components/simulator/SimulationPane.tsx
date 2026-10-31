import React, { useState } from 'react';
import { AutomatonModel, SimulationResult } from '../../types/automata';
import { api } from '../../services/api';
import { Play, CheckCircle2, XCircle, AlertTriangle, List, Download } from 'lucide-react';

interface SimulationPaneProps {
  automaton: AutomatonModel;
  onActiveStatesChange?: (states: string[]) => void;
  onActiveTransitionsChange?: (transitions: Array<{ from: string; to: string; symbol: string }>) => void;
}

export const SimulationPane: React.FC<SimulationPaneProps> = ({
  automaton,
  onActiveStatesChange,
  onActiveTransitionsChange,
}) => {
  const [inputString, setInputString] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchInput, setBatchInput] = useState('0\n1\n00\n01\n10\n11\n001\n0101');
  const [batchResults, setBatchResults] = useState<any>(null);

  const handleSimulate = async () => {
    try {
      setLoading(true);
      const res = await api.simulate(automaton, inputString);
      setResult(res);
      setActiveStepIndex(0);
      if (res.steps.length > 0) {
        onActiveStatesChange?.(res.steps[0].active_states);
        onActiveTransitionsChange?.([]);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepSelect = (idx: number) => {
    if (!result || !result.steps[idx]) return;
    setActiveStepIndex(idx);
    const step = result.steps[idx];
    onActiveStatesChange?.(step.active_states);
    onActiveTransitionsChange?.(step.transitions_taken);
  };

  const handleBatchSimulate = async () => {
    try {
      setLoading(true);
      const strings = batchInput
        .split('\n')
        .map((s) => s.trim());
      const res = await api.batchSimulate(automaton, strings);
      setBatchResults(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const exportTrace = () => {
    if (!result) return;
    const content = JSON.stringify(result, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${automaton.name}_trace_${inputString || 'eps'}.json`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-cyan-400">
          <Play className="w-4 h-4" />
          String Acceptance Simulator
        </h3>
        <button
          onClick={() => setBatchMode(!batchMode)}
          className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-medium flex items-center gap-1 transition"
        >
          <List className="w-3.5 h-3.5" />
          {batchMode ? "Single Mode" : "Batch Test Suite"}
        </button>
      </div>

      {!batchMode ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputString}
              onChange={(e) => setInputString(e.target.value)}
              placeholder="Enter string (e.g. 0101, or leave empty for ε)..."
              className="flex-1 bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-cyan-500 text-slate-100 placeholder:text-slate-600"
              onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
            />
            <button
              onClick={handleSimulate}
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition flex items-center gap-1.5"
            >
              Simulate
            </button>
          </div>

          {result && (
            <div className="flex flex-col gap-2 mt-1">
              {/* Verdict Header */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${
                !result.is_valid_alphabet
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  : result.is_accepted
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {!result.is_valid_alphabet ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : result.is_accepted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span className="font-bold text-sm">
                    {!result.is_valid_alphabet
                      ? 'INVALID ALPHABET SYMBOL'
                      : result.is_accepted
                      ? 'STRING ACCEPTED'
                      : 'STRING REJECTED'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-80">
                    Final States: {'{' + (result.final_states.join(', ') || '∅') + '}'}
                  </span>
                  <button onClick={exportTrace} title="Export JSON Trace" className="p-1 hover:bg-slate-800/60 rounded">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {result.error_message && (
                <p className="text-xs text-amber-300 font-mono bg-amber-950/30 p-2 rounded border border-amber-900/50">
                  {result.error_message}
                </p>
              )}

              {/* Execution Steps Trace */}
              {result.steps.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-xs font-semibold text-slate-400">Execution Path Trace:</span>
                  <div className="flex flex-wrap gap-1.5 overflow-x-auto p-1 bg-slate-950/70 border border-slate-800 rounded-lg">
                    {result.steps.map((st, i) => (
                      <button
                        key={i}
                        onClick={() => handleStepSelect(i)}
                        className={`px-2.5 py-1.5 rounded text-xs font-mono flex items-center gap-1 transition ${
                          activeStepIndex === i
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {i === 0 ? 'Init' : st.symbol}
                        <span className="opacity-70 text-[10px]">({st.active_states.join(',') || '∅'})</span>
                      </button>
                    ))}
                  </div>

                  {result.steps[activeStepIndex] && (
                    <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded text-xs font-mono text-cyan-300 whitespace-pre-wrap leading-relaxed mt-1">
                      {result.steps[activeStepIndex].explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">Enter strings (one per line) to run automated batch evaluation:</p>
          <textarea
            rows={5}
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono outline-none focus:border-cyan-500 text-slate-200"
          />
          <button
            onClick={handleBatchSimulate}
            disabled={loading}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-semibold text-white transition"
          >
            Run Batch Suite
          </button>

          {batchResults && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between text-xs font-medium border-b border-slate-800 pb-1">
                <span>Total: {batchResults.total}</span>
                <span className="text-emerald-400">Accepted: {batchResults.accepted}</span>
                <span className="text-rose-400">Rejected: {batchResults.rejected}</span>
                {batchResults.invalid > 0 && <span className="text-amber-400">Invalid: {batchResults.invalid}</span>}
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-850">
                {batchResults.results.map((r: SimulationResult, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2 text-xs font-mono hover:bg-slate-800/30">
                    <span>'{r.input_string}'</span>
                    <span className={r.is_accepted ? "text-emerald-400 font-bold" : "text-rose-400"}>
                      {r.is_accepted ? "ACCEPTED" : "REJECTED"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
