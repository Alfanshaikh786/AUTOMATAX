import React, { useState } from 'react';
import { AutomatonModel } from '../../types/automata';
import { api } from '../../services/api';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { TransitionTable } from '../tables/TransitionTable';
import { Network, Copy, Check, Combine, Split, RotateCw, Asterisk, Ban } from 'lucide-react';

interface OperationsLabProps {
  availableAutomata: AutomatonModel[];
  currentAutomaton: AutomatonModel;
  onLoadAutomaton: (aut: AutomatonModel) => void;
}

export const OperationsLab: React.FC<OperationsLabProps> = ({
  availableAutomata,
  currentAutomaton,
  onLoadAutomaton,
}) => {
  const [autA, setAutA] = useState<AutomatonModel>(currentAutomaton);
  const [autB, setAutB] = useState<AutomatonModel>(
    availableAutomata.find((a) => a.id !== currentAutomaton.id) || currentAutomaton
  );
  const [resultAutomaton, setResultAutomaton] = useState<AutomatonModel | null>(null);
  const [operationName, setOperationName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const executeOp = async (op: string, name: string) => {
    try {
      setLoading(true);
      setOperationName(name);
      const res = await api.performOperation(op, autA, autB);
      setResultAutomaton(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <Network className="w-6 h-6 text-cyan-400" />
        <div>
          <h2 className="text-lg font-bold text-white">Automata Mathematical Operations Laboratory</h2>
          <p className="text-xs text-slate-400">
            Perform closure operations: Union, Intersection, Complement, Difference, Concatenation, Kleene Star, and Reversal.
          </p>
        </div>
      </div>

      {/* Operands Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Automaton A */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2">
          <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Operand A</label>
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
          <div className="text-xs text-slate-400 font-mono space-y-0.5 mt-1">
            <div>States: {'{' + autA.states.join(', ') + '}'}</div>
            <div>Alphabet: {'{' + autA.alphabet.join(', ') + '}'}</div>
          </div>
        </div>

        {/* Automaton B */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col gap-2">
          <label className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Operand B</label>
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
          <div className="text-xs text-slate-400 font-mono space-y-0.5 mt-1">
            <div>States: {'{' + autB.states.join(', ') + '}'}</div>
            <div>Alphabet: {'{' + autB.alphabet.join(', ') + '}'}</div>
          </div>
        </div>
      </div>

      {/* Operations Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <button
          onClick={() => executeOp('union', 'Union L(A) ∪ L(B)')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <Combine className="w-4 h-4 text-cyan-400" />
          <span>Union (A ∪ B)</span>
        </button>

        <button
          onClick={() => executeOp('intersection', 'Intersection L(A) ∩ L(B)')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <Split className="w-4 h-4 text-cyan-400" />
          <span>Intersection (A ∩ B)</span>
        </button>

        <button
          onClick={() => executeOp('difference', 'Difference L(A) \\ L(B)')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <Ban className="w-4 h-4 text-cyan-400" />
          <span>Difference (A \ B)</span>
        </button>

        <button
          onClick={() => executeOp('concatenation', 'Concatenation L(A) · L(B)')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <Copy className="w-4 h-4 text-cyan-400" />
          <span>Concat (A · B)</span>
        </button>

        <button
          onClick={() => executeOp('complement', 'Complement Σ* \\ L(A)')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <Network className="w-4 h-4 text-cyan-400" />
          <span>Complement (Aᶜ)</span>
        </button>

        <button
          onClick={() => executeOp('kleene-star', 'Kleene Star L(A)*')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <Asterisk className="w-4 h-4 text-cyan-400" />
          <span>Kleene Star (A*)</span>
        </button>

        <button
          onClick={() => executeOp('reversal', 'Reversal L(A)ᴿ')}
          disabled={loading}
          className="p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex flex-col items-center gap-1.5 transition"
        >
          <RotateCw className="w-4 h-4 text-cyan-400" />
          <span>Reversal (Aᴿ)</span>
        </button>
      </div>

      {/* Result Display */}
      {resultAutomaton && (
        <div className="flex flex-col gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-cyan-400">{operationName}</h3>
              <p className="text-xs text-slate-400">{resultAutomaton.description}</p>
            </div>
            <button
              onClick={() => onLoadAutomaton(resultAutomaton)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-semibold text-white transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Load into Automata Builder
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            <div className="h-[400px]">
              <AutomataCanvas automaton={resultAutomaton} readOnly={true} />
            </div>
            <div>
              <TransitionTable automaton={resultAutomaton} onChange={() => {}} readOnly={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
