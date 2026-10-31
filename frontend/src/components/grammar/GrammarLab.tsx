import React, { useState } from 'react';
import { AutomatonModel, RightLinearGrammar, GrammarProduction } from '../../types/automata';
import { api } from '../../services/api';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { BookMarked, Plus, Trash2, ArrowRight, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface GrammarLabProps {
  onLoadAutomaton: (aut: AutomatonModel) => void;
  currentAutomaton?: AutomatonModel;
}

export const GrammarLab: React.FC<GrammarLabProps> = ({
  onLoadAutomaton,
  currentAutomaton,
}) => {
  const [grammar, setGrammar] = useState<RightLinearGrammar>({
    non_terminals: ['S', 'A'],
    terminals: ['0', '1'],
    start_symbol: 'S',
    productions: [
      { head: 'S', body: '0A' },
      { head: 'S', body: '1S' },
      { head: 'S', body: 'ε' },
      { head: 'A', body: '1S' },
    ],
  });

  const [validation, setValidation] = useState<{ is_valid: boolean; message: string } | null>(null);
  const [resultAutomaton, setResultAutomaton] = useState<AutomatonModel | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    try {
      setLoading(true);
      const res = await api.validateGrammar(grammar);
      setValidation(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToNfa = async () => {
    try {
      setLoading(true);
      const res = await api.grammarToNfa(grammar);
      if (!res.is_valid) {
        alert(res.error_message);
        return;
      }
      setResultAutomaton(res.automaton);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromAutomaton = async () => {
    if (!currentAutomaton) return;
    try {
      setLoading(true);
      const res = await api.automatonToGrammar(currentAutomaton);
      setGrammar(res);
      setValidation(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addProduction = () => {
    setGrammar({
      ...grammar,
      productions: [...grammar.productions, { head: grammar.start_symbol, body: '' }],
    });
  };

  const updateProduction = (index: number, head: string, body: string) => {
    const prods = [...grammar.productions];
    prods[index] = { head, body };
    setGrammar({ ...grammar, productions: prods });
  };

  const removeProduction = (index: number) => {
    setGrammar({
      ...grammar,
      productions: grammar.productions.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <BookMarked className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-base">Right-Linear Regular Grammar Laboratory</h2>
            <p className="text-xs text-slate-400">
              Grammar ↔ NFA conversions for regular grammars (A → w B | w | ε). General CFG productions are strictly validated and separated.
            </p>
          </div>
        </div>

        {currentAutomaton && (
          <button
            onClick={handleImportFromAutomaton}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-cyan-300 transition"
          >
            Generate Grammar from '{currentAutomaton.name}'
          </button>
        )}
      </div>

      {/* Grammar Specifications & Production Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Terminals & Non-terminals */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Grammar Symbols</h3>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Non-terminals V (comma separated):</label>
            <input
              type="text"
              value={grammar.non_terminals.join(', ')}
              onChange={(e) =>
                setGrammar({
                  ...grammar,
                  non_terminals: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              className="w-full bg-slate-900 border border-slate-750 rounded p-2 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Terminals Σ (comma separated):</label>
            <input
              type="text"
              value={grammar.terminals.join(', ')}
              onChange={(e) =>
                setGrammar({
                  ...grammar,
                  terminals: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              className="w-full bg-slate-900 border border-slate-750 rounded p-2 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Start Symbol S:</label>
            <input
              type="text"
              value={grammar.start_symbol}
              onChange={(e) => setGrammar({ ...grammar, start_symbol: e.target.value.trim() })}
              className="w-full bg-slate-900 border border-slate-750 rounded p-2 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Productions Editor */}
        <div className="md:col-span-2 p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">
              Productions P ({grammar.productions.length} rules)
            </h3>
            <button
              onClick={addProduction}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/60 border border-cyan-500/40 rounded text-xs font-medium text-cyan-200 transition"
            >
              <Plus className="w-3 h-3" />
              Add Rule
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {grammar.productions.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.head}
                  onChange={(e) => updateProduction(idx, e.target.value, p.body)}
                  className="w-16 bg-slate-900 border border-slate-750 rounded p-1.5 text-xs font-mono text-slate-200 text-center outline-none focus:border-cyan-500"
                  placeholder="A"
                />
                <span className="text-slate-500 font-mono">→</span>
                <input
                  type="text"
                  value={p.body}
                  onChange={(e) => updateProduction(idx, p.head, e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-750 rounded p-1.5 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="e.g. 0A or 1 or ε"
                />
                <button
                  onClick={() => removeProduction(idx)}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleValidate}
              disabled={loading}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition"
            >
              Validate Grammar
            </button>
            <button
              onClick={handleConvertToNfa}
              disabled={loading}
              className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Convert to NFA
            </button>
          </div>
        </div>
      </div>

      {/* Validation Message */}
      {validation && (
        <div className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs ${
          validation.is_valid
            ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/30 border-rose-800 text-rose-300'
        }`}>
          {validation.is_valid ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <span>{validation.message}</span>
        </div>
      )}

      {/* Converted NFA Visualization */}
      {resultAutomaton && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-200">
              Equivalent NFA ({resultAutomaton.states.length} states)
            </h3>
            <button
              onClick={() => onLoadAutomaton(resultAutomaton)}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-semibold text-white transition flex items-center gap-1"
            >
              Load into Automata Builder
            </button>
          </div>
          <div className="h-[420px]">
            <AutomataCanvas automaton={resultAutomaton} readOnly={false} />
          </div>
        </div>
      )}
    </div>
  );
};

