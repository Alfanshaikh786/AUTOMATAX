import React from 'react';
import { AutomatonModel } from '../../types/automata';
import { Star, ArrowRight, Trash2, Plus } from 'lucide-react';

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

  const handleCellChange = (state: string, symbol: string, value: string) => {
    if (readOnly) return;
    const dests = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const trans = { ...automaton.transitions };
    if (!trans[state]) trans[state] = {};

    if (symbol === 'ε') {
      const eps = { ...automaton.epsilon_transitions };
      eps[state] = dests;
      onChange({ ...automaton, epsilon_transitions: eps });
      return;
    }

    if (automaton.type === 'DFA') {
      trans[state][symbol] = dests.slice(0, 1);
    } else {
      trans[state][symbol] = dests;
    }

    onChange({ ...automaton, transitions: trans });
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
    <div className="w-full overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/50 shadow-inner">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
            <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-16 text-center">Initial</th>
            <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-16 text-center">Final</th>
            <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider">State</th>
            {automaton.alphabet.map((sym) => (
              <th key={`head-${sym}`} className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider font-mono text-cyan-400">
                {sym}
              </th>
            ))}
            {isEnfa && (
              <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wider font-mono text-purple-400">
                ε
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
                  {isInit && <span className="text-emerald-400 mr-1">→</span>}
                  {isAcc && <span className="text-amber-400 mr-1">*</span>}
                  {s}
                </td>

                {/* Alphabet Transitions */}
                {automaton.alphabet.map((sym) => {
                  const val = (automaton.transitions[s]?.[sym] || []).join(', ');
                  return (
                    <td key={`cell-${s}-${sym}`} className="py-2 px-2">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={val}
                        placeholder="∅"
                        onChange={(e) => handleCellChange(s, sym, e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-750 focus:border-cyan-500 rounded px-2 py-1 text-xs font-mono text-slate-100 placeholder:text-slate-600 outline-none transition"
                      />
                    </td>
                  );
                })}

                {/* Epsilon Transitions */}
                {isEnfa && (
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      disabled={readOnly}
                      value={(automaton.epsilon_transitions[s] || []).join(', ')}
                      placeholder="∅"
                      onChange={(e) => handleCellChange(s, 'ε', e.target.value)}
                      className="w-full bg-slate-950/70 border border-purple-500/40 focus:border-purple-400 rounded px-2 py-1 text-xs font-mono text-purple-200 placeholder:text-slate-600 outline-none transition"
                    />
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
  );
};

