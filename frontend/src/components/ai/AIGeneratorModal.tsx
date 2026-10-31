import React, { useState } from 'react';
import { AutomatonModel } from '../../types/automata';
import { api } from '../../services/api';
import { Sparkles, Bot, CheckCircle2, XCircle, ArrowRight, X } from 'lucide-react';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadAutomaton: (aut: AutomatonModel) => void;
}

export const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({
  isOpen,
  onClose,
  onLoadAutomaton,
}) => {
  const [prompt, setPrompt] = useState('Create a DFA that accepts binary strings containing an even number of zeros');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const res = await api.generateFromPrompt(prompt);
      setResult(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    "Create a DFA over {0,1} that accepts binary strings containing an even number of zeros",
    "Create an NFA that accepts binary strings ending with 01",
    "Create a DFA that accepts binary numbers divisible by 3",
    "Create a DFA that accepts binary strings starting with 01",
    "Create a DFA that accepts binary strings containing substring 101",
    "Create a DFA that accepts binary strings with an odd number of 1s",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Sparkles className="w-5 h-5" />
            <span>Intelligent Automata Synthesizer & Assistant</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Enter an English language description of the formal language requirement. The system parses the specification, deterministically constructs the automaton, and mathematically verifies it against test cases.
        </p>

        {/* Input */}
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-slate-950 border border-slate-750 rounded-lg p-3 text-sm font-sans outline-none focus:border-cyan-500 text-slate-100"
            placeholder="Describe your automaton in natural language..."
          />
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="text-slate-500">Quick prompts:</span>
            {samplePrompts.map((sp, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(sp)}
                className="text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 rounded transition"
              >
                {sp.slice(0, 35)}...
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white shadow-lg transition flex items-center justify-center gap-2"
        >
          <Bot className="w-4 h-4" />
          {loading ? "Synthesizing & Mathematically Verifying..." : "Synthesize & Verify Automaton"}
        </button>

        {/* Result */}
        {result && (
          <div className="flex flex-col gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl mt-2">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <div>
                <h4 className="font-bold text-sm text-white">{result.automaton.name}</h4>
                <p className="text-xs text-slate-400">{result.explanation}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                result.is_verified ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {result.is_verified ? "VERIFIED PASSED" : "UNVERIFIED"}
              </span>
            </div>

            {/* Test Suite Verification Table */}
            <div className="text-xs font-semibold text-slate-400 mt-1">Mathematical Verification Suite:</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-xs">
              {result.verification_tests?.map((t: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-2 rounded border flex items-center justify-between ${
                    t.passed ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'
                  }`}
                >
                  <span>'{t.test_string || 'ε'}'</span>
                  <span className={t.expected ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {t.expected ? 'ACC' : 'REJ'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                onLoadAutomaton(result.automaton);
                onClose();
              }}
              className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold text-xs text-white transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Load Verified Automaton into Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
