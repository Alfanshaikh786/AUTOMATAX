import React, { useState } from 'react';
import { AutomatonModel } from '../../types/automata';
import { api } from '../../services/api';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { Code2, ArrowRight, Table, Layers, Sparkles, Check, HelpCircle } from 'lucide-react';

interface RegexLabProps {
  onLoadAutomaton: (aut: AutomatonModel) => void;
  currentAutomaton?: AutomatonModel;
}

export const RegexLab: React.FC<RegexLabProps> = ({
  onLoadAutomaton,
  currentAutomaton,
}) => {
  const [pattern, setPattern] = useState('(0|1)*01');
  const [resultAutomaton, setResultAutomaton] = useState<AutomatonModel | null>(null);
  const [glushkovTable, setGlushkovTable] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [gnfaRegex, setGnfaRegex] = useState<string | null>(null);
  const [gnfaSteps, setGnfaSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'thompson' | 'glushkov' | 'dfa' | 'gnfa'>('thompson');

  const handleThompson = async () => {
    try {
      setLoading(true);
      const res = await api.regexToEnfa(pattern);
      setResultAutomaton(res.automaton);
      setSteps(res.steps || []);
      setGlushkovTable(null);
      setActiveTab('thompson');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGlushkov = async () => {
    try {
      setLoading(true);
      const res = await api.regexToNfa(pattern);
      setResultAutomaton(res.automaton);
      setGlushkovTable(res.glushkov_table);
      setSteps([]);
      setActiveTab('glushkov');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToDfa = async () => {
    try {
      setLoading(true);
      const res = await api.regexToDfa(pattern);
      setResultAutomaton(res.dfa);
      setGlushkovTable(null);
      setSteps(res.subset_steps || []);
      setActiveTab('dfa');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGnfa = async () => {
    if (!currentAutomaton) return;
    try {
      setLoading(true);
      const res = await api.convertToRegex(currentAutomaton);
      setGnfaRegex(res.regex);
      setGnfaSteps(res.steps || []);
      setActiveTab('gnfa');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Code2 className="w-6 h-6 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-base">Regular Expression Laboratory</h2>
            <p className="text-xs text-slate-400">
              Bi-directional conversions: Regex ↔ Finite Automata via Thompson, Glushkov, and GNFA state elimination.
            </p>
          </div>
        </div>
      </div>

      {/* Input Form & Buttons */}
      <div className="flex flex-col gap-3 p-4 bg-slate-950 border border-slate-800 rounded-lg">
        <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">
          Regular Expression Pattern
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. (a|b)*abb, (0|1)*01, a*b+"
            className="flex-1 bg-slate-900 border border-slate-750 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-cyan-500 text-slate-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Quick Examples:</span>
          {['(0|1)*01', '(a|b)*abb', '0*1(0|1)*', '(a|b)*(aa|bb)'].map((ex) => (
            <button
              key={ex}
              onClick={() => setPattern(ex)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-cyan-300 font-mono transition"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <button
            onClick={handleThompson}
            disabled={loading}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'thompson' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Thompson ε-NFA
          </button>
          <button
            onClick={handleGlushkov}
            disabled={loading}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'glushkov' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Glushkov NFA
          </button>
          <button
            onClick={handleToDfa}
            disabled={loading}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'dfa' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Direct DFA
          </button>
          {currentAutomaton && (
            <button
              onClick={handleGnfa}
              disabled={loading}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'gnfa' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-purple-300 hover:bg-slate-700'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              GNFA (Automaton → Regex)
            </button>
          )}
        </div>
      </div>

      {/* GNFA Result */}
      {activeTab === 'gnfa' && gnfaRegex && (
        <div className="p-4 bg-purple-950/30 border border-purple-800 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
              Derived Regular Expression (via State Elimination):
            </span>
            <span className="font-mono text-base font-bold text-purple-200 bg-purple-900/60 px-3 py-1 rounded border border-purple-700">
              {gnfaRegex}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-xs font-medium text-slate-400">Elimination Trace:</span>
            <div className="max-h-56 overflow-y-auto space-y-2">
              {gnfaSteps.map((st, i) => (
                <div key={i} className="p-2.5 bg-slate-950 border border-slate-850 rounded text-xs font-mono">
                  <div className="font-semibold text-cyan-400">{st.title}</div>
                  <div className="text-slate-300 whitespace-pre-wrap mt-0.5">{st.mathematical_explanation}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Glushkov Followpos Matrix */}
      {activeTab === 'glushkov' && glushkovTable && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-3">
          <h3 className="font-semibold text-xs text-cyan-400 uppercase tracking-wide">
            Glushkov Position Analysis Table
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs font-mono text-slate-300 bg-slate-900 p-2.5 rounded">
            <div>Nullable: <b className="text-emerald-400">{glushkovTable.nullable ? 'TRUE' : 'FALSE'}</b></div>
            <div>Firstpos: {'{' + (glushkovTable.firstpos?.join(', ') || '∅') + '}'}</div>
            <div>Lastpos: {'{' + (glushkovTable.lastpos?.join(', ') || '∅') + '}'}</div>
          </div>

          <div className="text-xs font-medium text-slate-400 mt-1">Followpos Table:</div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-850 bg-slate-900 rounded border border-slate-800">
            {Object.entries(glushkovTable.followpos || {}).map(([pos, targets]: [string, any], i) => (
              <div key={i} className="flex items-center justify-between p-2 text-xs font-mono">
                <span className="text-cyan-300">{pos}</span>
                <span className="text-slate-300">followpos = {'{' + (targets.join(', ') || '∅') + '}'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Automaton Visualization */}
      {resultAutomaton && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-200">
              Constructed {resultAutomaton.type} ({resultAutomaton.states.length} states)
            </h3>
            <button
              onClick={() => onLoadAutomaton(resultAutomaton)}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-semibold text-white transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
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
