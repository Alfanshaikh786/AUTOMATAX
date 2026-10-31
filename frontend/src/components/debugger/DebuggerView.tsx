import React, { useState } from 'react';
import { AutomatonModel, DebugReport, DebugIssue } from '../../types/automata';
import { api } from '../../services/api';
import { ShieldAlert, AlertTriangle, Info, CheckCircle, Wrench, RefreshCw } from 'lucide-react';

interface DebuggerViewProps {
  automaton: AutomatonModel;
  onApplyFix?: (updated: AutomatonModel) => void;
}

export const DebuggerView: React.FC<DebuggerViewProps> = ({
  automaton,
  onApplyFix,
}) => {
  const [report, setReport] = useState<DebugReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    try {
      setLoading(true);
      const res = await api.analyze(automaton);
      setReport(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFix = (issue: DebugIssue) => {
    if (!issue.suggested_fix || !onApplyFix) return;
    const fix = issue.suggested_fix;

    let updated = { ...automaton };

    if (fix.patch_type === 'REMOVE_STATE') {
      const stateToRemove = fix.parameters.state;
      updated.states = updated.states.filter((s) => s !== stateToRemove);
      updated.accepting_states = updated.accepting_states.filter((s) => s !== stateToRemove);
      const newTrans: Record<string, Record<string, string[]>> = {};
      updated.states.forEach((s) => {
        newTrans[s] = {};
        if (updated.transitions[s]) {
          Object.entries(updated.transitions[s]).forEach(([sym, dests]) => {
            newTrans[s][sym] = dests.filter((d) => d !== stateToRemove);
          });
        }
      });
      updated.transitions = newTrans;
    } else if (fix.patch_type === 'COMPLETE_DFA') {
      const sink = 'q_sink';
      if (!updated.states.includes(sink)) {
        updated.states = [...updated.states, sink];
      }
      const newTrans = { ...updated.transitions };
      newTrans[sink] = {};
      updated.alphabet.forEach((sym) => {
        newTrans[sink][sym] = [sink];
      });
      updated.states.forEach((s) => {
        if (!newTrans[s]) newTrans[s] = {};
        updated.alphabet.forEach((sym) => {
          if (!newTrans[s][sym] || newTrans[s][sym].length === 0) {
            newTrans[s][sym] = [sink];
          }
        });
      });
      updated.transitions = newTrans;
    } else if (fix.patch_type === 'SET_INITIAL') {
      updated.initial_state = fix.parameters.state;
    } else if (fix.patch_type === 'REMOVE_EPSILON') {
      const from = fix.parameters.from;
      const to = fix.parameters.to;
      const newEps = { ...updated.epsilon_transitions };
      if (newEps[from]) {
        newEps[from] = newEps[from].filter((d) => d !== to);
      }
      updated.epsilon_transitions = newEps;
    }

    onApplyFix(updated);
    // Re-run diagnostics
    setTimeout(runAnalysis, 100);
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-base">Intelligent Automata Diagnostics & Debugger</h2>
            <p className="text-xs text-slate-400">
              Scans structural anomalies: unreachable states, dead sink states, DFA completeness, and redundant transitions.
            </p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Run Diagnostics
        </button>
      </div>

      {!report ? (
        <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
          Click "Run Diagnostics" to inspect '{automaton.name}' for mathematical correctness.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Summary Banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
              <span className="text-xs text-slate-400">Errors</span>
              <span className={`text-base font-bold ${report.error_count > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {report.error_count}
              </span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
              <span className="text-xs text-slate-400">Warnings</span>
              <span className={`text-base font-bold ${report.warning_count > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {report.warning_count}
              </span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
              <span className="text-xs text-slate-400">Suggestions</span>
              <span className="text-base font-bold text-cyan-400">{report.suggestion_count}</span>
            </div>
          </div>

          {report.issues.length === 0 ? (
            <div className="p-4 bg-emerald-950/30 border border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-300 text-xs">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>Great! No structural or mathematical issues detected in this automaton.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
              {report.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
                    issue.severity === 'ERROR'
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : issue.severity === 'WARNING'
                      ? 'bg-amber-950/20 border-amber-800/60'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {issue.severity === 'ERROR' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                      ) : issue.severity === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Info className="w-4 h-4 text-cyan-400" />
                      )}
                      <span className="font-semibold text-xs text-slate-200">{issue.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                        {issue.code}
                      </span>
                    </div>

                    {issue.suggested_fix && onApplyFix && (
                      <button
                        onClick={() => handleApplyFix(issue)}
                        className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/60 border border-cyan-500/40 rounded text-xs font-medium text-cyan-200 flex items-center gap-1 transition"
                      >
                        <Wrench className="w-3 h-3" />
                        Apply Suggested Fix
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">{issue.description}</p>
                  <div className="text-[11px] font-mono text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-850">
                    {issue.mathematical_rationale}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
