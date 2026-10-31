import React, { useState, useEffect } from 'react';
import { AutomatonModel } from '../../types/automata';
import { Star, ArrowRight, Trash2, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

interface TransitionTableProps {
  automaton: AutomatonModel;
  onChange: (updated: AutomatonModel) => void;
  readOnly?: boolean;
}

export const TransitionTable: React.FC<TransitionTableProps> = ({
  automaton,
  onChange,
  readOnly = false,
}) => {
  const isEnfa = automaton.type === 'ENFA';
  const isNfa = automaton.type === 'NFA';
  const isDfa = automaton.type === 'DFA';

  // Local text buffer for each cell to prevent cursor-jumping and premature comma trimming
  const [cellText, setCellText] = useState<Record<string, string>>({});
  // Validation errors for each cell
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  // Synchronize local cell text with automaton transitions whenever automaton updates externally
  useEffect(() => {
    const newText: Record<string, string> = {};
    automaton.states.forEach((s) => {
      automaton.alphabet.forEach((sym) => {
        const dests = automaton.transitions[s]?.[sym] || [];
        newText[`${s}-${sym}`] = dests.join(', ');
      });
      if (isEnfa) {
        const epsDests = automaton.epsilon_transitions[s] || [];
        newText[`${s}-ε`] = epsDests.join(', ');
      }
    });
    setCellText(newText);
    setCellErrors({});
  }, [automaton.states.join(','), automaton.alphabet.join(','), automaton.type, automaton.id]);

  const handleCellChange = (state: string, symbol: string, rawValue: string) => {
    if (readOnly) return;
    const key = `${state}-${symbol}`;

    // 1. Update text buffer immediately so user can type freely (commas, spaces, intermediate names)
    setCellText((prev) => ({ ...prev, [key]: rawValue }));

    // 2. Parse destination states
    const trimmed = rawValue.trim();

    // Handle empty transition / ∅
    if (trimmed === '' || trimmed === '∅' || trimmed === 'none' || trimmed === '-') {
      setCellErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });

      if (symbol === 'ε') {
        const eps = { ...automaton.epsilon_transitions };
        eps[state] = [];
        onChange({ ...automaton, epsilon_transitions: eps });
      } else {
        const trans = { ...automaton.transitions };
        if (!trans[state]) trans[state] = {};
        trans[state][symbol] = [];
        onChange({ ...automaton, transitions: trans });
      }
      return;
    }

    // Split by comma
    const rawTokens = rawValue.split(',').map((t) => t.trim()).filter(Boolean);
    const validDests: string[] = [];
    const invalidDests: string[] = [];

    rawTokens.forEach((t) => {
      if (t === '∅') return;
      if (automaton.states.includes(t)) {
        if (!validDests.includes(t)) {
          validDests.push(t);
        }
      } else {
        invalidDests.push(t);
      }
    });

    // 3. Validation Rules
    if (invalidDests.length > 0) {
      setCellErrors((prev) => ({
        ...prev,
        [key]: `Undefined state(s): ${invalidDests.join(', ')}. Valid states: {${automaton.states.join(', ')}}`,
      }));
      // Do not corrupt model with undefined states, but preserve user text in input
      return;
    }

    if (isDfa && validDests.length > 1) {
      setCellErrors((prev) => ({
        ...prev,
        [key]: `DFA determinism violation: Exactly 1 destination state allowed per symbol (got {${validDests.join(', ')}}). Switch to NFA for multiple destinations.`,
      }));
      return;
    }

    // Clear error
    setCellErrors((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });

    // 4. Update Automaton Model
    if (symbol === 'ε') {
      const eps = { ...automaton.epsilon_transitions };
      eps[state] = validDests;
      onChange({ ...automaton, epsilon_transitions: eps });
    } else {
      const trans = { ...automaton.transitions };
      if (!trans[state]) trans[state] = {};
      trans[state][symbol] = validDests;
      onChange({ ...automaton, transitions: trans });
    }
  };

  const toggleAccepting = (state: string) => {
    if (readOnly) return;
    const acc = new Set(automaton.accepting_states);
    if (acc.has(state)) {
      acc.delete(state);
    } else {
      acc.add(state);
    }
    onChange({ ...automaton, accepting_states: Array.from(acc) });
  };

  const setInitial = (state: string) => {
    if (readOnly) return;
    onChange({ ...automaton, initial_state: state });
  };

  const removeState = (state: string) => {
    if (readOnly) return;
    const newStates = automaton.states.filter((s) => s !== state);
    const newAcc = automaton.accepting_states.filter((s) => s !== state);
    const newInit = automaton.initial_state === state ? (newStates[0] || '') : automaton.initial_state;

    const newTrans: Record<string, Record<string, string[]>> = {};
    newStates.forEach((s) => {
      newTrans[s] = {};
      if (automaton.transitions[s]) {
        Object.entries(automaton.transitions[s]).forEach(([sym, dests]) => {
          newTrans[s][sym] = dests.filter((d) => d !== state);
        });
      }
    });

    const newEps: Record<string, string[]> = {};
    newStates.forEach((s) => {
      newEps[s] = (automaton.epsilon_transitions[s] || []).filter((d) => d !== state);
    });

    onChange({
      ...automaton,
      states: newStates,
      accepting_states: newAcc,
      initial_state: newInit,
      transitions: newTrans,
      epsilon_transitions: newEps,
    });
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Help Tip Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-cyan-400">
            {automaton.type} Transition Table:
          </span>
          <span>
            {isNfa
              ? 'Enter single or multiple destinations separated by commas (e.g. "q0, q1"). Use ∅ for empty.'
              : isEnfa
              ? 'Supports multiple destinations and ε-transitions. Use commas for multiple branches.'
              : 'Enter exactly one destination state per symbol (complete deterministic DFA).'}
          </span>
        </div>
        <span className="font-mono text-slate-500">
          Σ = {'{' + automaton.alphabet.join(', ') + '}'}
        </span>
      </div>

      {/* Main Transition Table */}
      <div className="w-full overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/50 shadow-inner">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-16 text-center">Initial</th>
              <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-16 text-center">Final</th>
              <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">State</th>
              {automaton.alphabet.map((sym) => (
                <th key={`head-${sym}`} className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider font-mono text-cyan-400">
                  δ(q, {sym})
                </th>
              ))}
              {isEnfa && (
                <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider font-mono text-purple-400">
                  δ(q, ε)
                </th>
              )}
              {!readOnly && <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-12 text-center">Del</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {automaton.states.map((s) => {
              const isInit = s === automaton.initial_state;
              const isAcc = automaton.accepting_states.includes(s);

              return (
                <tr key={`row-${s}`} className="hover:bg-slate-800/40 transition">
                  {/* Initial State Radio */}
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => setInitial(s)}
                      disabled={readOnly}
                      title={isInit ? "Initial State" : "Click to set as Initial State"}
                      className={`p-1 rounded-full transition ${isInit ? 'text-emerald-400 bg-emerald-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>

                  {/* Accepting State Star */}
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => toggleAccepting(s)}
                      disabled={readOnly}
                      title={isAcc ? "Accepting State (Click to toggle)" : "Click to mark as Accepting"}
                      className={`p-1 rounded-full transition ${isAcc ? 'text-amber-400 fill-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                      <Star className={`w-4 h-4 ${isAcc ? 'fill-current' : ''}`} />
                    </button>
                  </td>

                  {/* State Label */}
                  <td className="py-2 px-3 font-mono font-semibold text-slate-200">
                    <div className="flex items-center gap-1.5">
                      {isInit && <span className="text-emerald-400 font-bold">→</span>}
                      {isAcc && <span className="text-amber-400 font-bold">*</span>}
                      <span>{s}</span>
                    </div>
                  </td>

                  {/* Alphabet Transitions */}
                  {automaton.alphabet.map((sym) => {
                    const key = `${s}-${sym}`;
                    const val = cellText[key] ?? ((automaton.transitions[s]?.[sym] || []).join(', '));
                    const error = cellErrors[key];
                    const dests = automaton.transitions[s]?.[sym] || [];
                    const isMultiple = dests.length > 1;

                    return (
                      <td key={`cell-${s}-${sym}`} className="py-2 px-2 relative group">
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            disabled={readOnly}
                            value={val}
                            placeholder="∅"
                            onChange={(e) => handleCellChange(s, sym, e.target.value)}
                            className={`w-full bg-slate-950/80 border rounded px-2 py-1 text-xs font-mono outline-none transition ${
                              error
                                ? 'border-red-500 bg-red-950/30 text-red-200'
                                : isMultiple
                                ? 'border-purple-500/60 text-purple-300 font-bold focus:border-purple-400'
                                : 'border-slate-750 focus:border-cyan-500 text-slate-100'
                            }`}
                          />

                          {/* Set Notation Visual Indicator */}
                          {!error && dests.length > 0 && (
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-0.5">
                              <span>{"{" + dests.join(',') + "}"}</span>
                              {isMultiple && (
                                <span className="text-purple-400 font-bold text-[9px] bg-purple-950/60 px-1 rounded">
                                  |{dests.length}|
                                </span>
                              )}
                            </div>
                          )}

                          {/* Error Tooltip */}
                          {error && (
                            <div className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5 leading-tight">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate" title={error}>{error}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Epsilon Transitions */}
                  {isEnfa && (
                    <td className="py-2 px-2 relative">
                      {(() => {
                        const key = `${s}-ε`;
                        const val = cellText[key] ?? ((automaton.epsilon_transitions[s] || []).join(', '));
                        const error = cellErrors[key];
                        const dests = automaton.epsilon_transitions[s] || [];

                        return (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              disabled={readOnly}
                              value={val}
                              placeholder="∅"
                              onChange={(e) => handleCellChange(s, 'ε', e.target.value)}
                              className={`w-full bg-slate-950/80 border rounded px-2 py-1 text-xs font-mono outline-none transition ${
                                error
                                  ? 'border-red-500 bg-red-950/30 text-red-200'
                                  : 'border-purple-500/40 focus:border-purple-400 text-purple-200'
                              }`}
                            />
                            {!error && dests.length > 0 && (
                              <div className="text-[10px] font-mono text-purple-400/80 px-0.5">
                                {"{" + dests.join(',') + "}"}
                              </div>
                            )}
                            {error && (
                              <div className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5 leading-tight">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate" title={error}>{error}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}

                  {/* Remove State Action */}
                  {!readOnly && (
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => removeState(s)}
                        title={`Remove state ${s}`}
                        className="text-slate-600 hover:text-red-400 p-1 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
