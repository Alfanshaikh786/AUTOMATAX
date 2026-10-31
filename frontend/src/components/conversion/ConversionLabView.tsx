import React, { useState } from 'react';
import { AutomatonModel, ConversionResponse } from '../../types/automata';
import { api } from '../../services/api';
import { StepPlayer } from './StepPlayer';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import {
  Layers, ArrowRight, Sparkles, Split, Minimize2, Code2,
  CheckCircle2, RefreshCw, GitCommit, Play, BookOpen, Compass
} from 'lucide-react';

interface ConversionLabViewProps {
  currentAutomaton: AutomatonModel;
  availableAutomata: AutomatonModel[];
  onLoadIntoBuilder: (aut: AutomatonModel) => void;
  conversion: ConversionResponse | null;
  setConversion: (conv: ConversionResponse | null) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  highlightStates: string[];
  setHighlightStates: (states: string[]) => void;
  highlightTransitions: Array<{ from: string; to: string; symbol: string }>;
  setHighlightTransitions: (t: Array<{ from: string; to: string; symbol: string }>) => void;
}

export const ConversionLabView: React.FC<ConversionLabViewProps> = ({
  currentAutomaton,
  availableAutomata,
  onLoadIntoBuilder,
  conversion,
  setConversion,
  currentStepIndex,
  setCurrentStepIndex,
  highlightStates,
  setHighlightStates,
  highlightTransitions,
  setHighlightTransitions,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState(currentAutomaton.id);
  const [selectedTarget, setSelectedTarget] = useState<string>(
    currentAutomaton.type === 'ENFA'
      ? 'enfa-to-nfa'
      : currentAutomaton.type === 'NFA'
      ? 'to-dfa'
      : 'minimize'
  );
  const [loading, setLoading] = useState(false);

  const sourceAut = availableAutomata.find((a) => a.id === selectedSourceId) || currentAutomaton;

  const handleRunConversion = async () => {
    try {
      setLoading(true);
      let res: ConversionResponse;
      if (selectedTarget === 'enfa-to-nfa') {
        res = await api.convertEnfaToNfa(sourceAut);
      } else if (selectedTarget === 'to-dfa' || selectedTarget === 'enfa-to-dfa') {
        res = await api.convertToDfa(sourceAut);
      } else if (selectedTarget === 'dfa-to-nfa') {
        res = await api.convertDfaToNfa(sourceAut);
      } else if (selectedTarget === 'to-enfa') {
        res = await api.convertToEnfa(sourceAut);
      } else {
        res = await api.minimizeDfa(sourceAut);
      }
      setConversion(res);
      setCurrentStepIndex(0);
      if (res.steps.length > 0) {
        setHighlightStates(res.steps[0].highlight_states || []);
        setHighlightTransitions(res.steps[0].highlight_transitions || []);
      }
    } catch (e: any) {
      alert(`Conversion Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (idx: number) => {
    if (!conversion || !conversion.steps[idx]) return;
    setCurrentStepIndex(idx);
    const step = conversion.steps[idx];
    setHighlightStates(step.highlight_states || []);
    setHighlightTransitions(step.highlight_transitions || []);
  };

  // Pre-configured conversion options tailored to source automaton type
  const getConversionOptions = () => {
    const opts = [];
    if (sourceAut.type === 'ENFA') {
      opts.push({
        id: 'enfa-to-nfa',
        title: 'ε-Elimination (ε-NFA → NFA)',
        route: ['ε-NFA', 'Epsilon-Closure', 'Move Evaluation', 'NFA'],
        description: 'Eliminates ε-transitions by computing δ\'(q, a) = ε-closure(move(ε-closure(q), a)). Preserves language equivalence.',
        complexity: 'O(|Q|² · |Σ|)',
        recommended: true,
      });
      opts.push({
        id: 'enfa-to-dfa',
        title: 'ε-Aware Subset Construction (ε-NFA → DFA)',
        route: ['ε-NFA', 'ε-Closure({q0})', 'Subset Construction', 'DFA'],
        description: 'Builds deterministic states from reachable subsets expanded with ε-closures.',
        complexity: 'O(2^|Q|)',
        recommended: false,
      });
      opts.push({
        id: 'minimize',
        title: 'ε-NFA → Minimal DFA',
        route: ['ε-NFA', 'Subset Construction', 'DFA', 'Hopcroft Minimization', 'Minimal DFA'],
        description: 'Two-stage pipeline: constructs the reachable subset DFA, then applies Hopcroft partition refinement.',
        complexity: 'O(2^|Q| + |Σ|·|Q_D| log |Q_D|)',
        recommended: false,
      });
    } else if (sourceAut.type === 'NFA') {
      opts.push({
        id: 'to-dfa',
        title: 'Subset Construction (NFA → DFA)',
        route: ['NFA', 'Reachable Subsets', 'DFA Transitions', 'DFA'],
        description: 'Generates reachable canonical subsets. Traverses input alphabet to produce a complete, deterministic automaton.',
        complexity: 'O(2^|Q|)',
        recommended: true,
      });
      opts.push({
        id: 'to-enfa',
        title: 'NFA → ε-NFA',
        route: ['NFA', 'Empty ε-Transition Table', 'ε-NFA'],
        description: 'Embeds the NFA into the ε-NFA formal model without introducing spontaneous transitions.',
        complexity: 'O(|Q|)',
        recommended: false,
      });
      opts.push({
        id: 'minimize',
        title: 'NFA → Minimal DFA',
        route: ['NFA', 'Subset Construction', 'DFA', 'Hopcroft Minimization', 'Minimal DFA'],
        description: 'Converts NFA to DFA via subset construction, followed by Hopcroft partition refinement to find the unique minimal DFA.',
        complexity: 'O(2^|Q|)',
        recommended: false,
      });
    } else {
      // DFA
      opts.push({
        id: 'dfa-to-nfa',
        title: 'DFA → NFA (Subclass Embedding)',
        route: ['DFA', 'Singleton Destination Embedding δ(q,a)={p}', 'NFA'],
        description: 'A DFA is a special deterministic case of an NFA. Every deterministic transition δ(q,a)=p is represented as the singleton set {p}.',
        complexity: 'O(|Q| · |Σ|)',
        recommended: true,
      });
      opts.push({
        id: 'to-enfa',
        title: 'DFA → ε-NFA',
        route: ['DFA', 'Singleton Transitions', 'Empty ε-Table', 'ε-NFA'],
        description: 'Embeds the DFA into an ε-NFA format with empty epsilon transitions.',
        complexity: 'O(|Q| · |Σ|)',
        recommended: false,
      });
      opts.push({
        id: 'minimize',
        title: "Hopcroft's DFA Minimization",
        route: ['DFA', 'Sink Completion', 'P0={F, Q\\F}', 'Partition Refinement', 'Minimal DFA'],
        description: 'Minimizes the DFA into the canonical minimal state representation using Hopcroft partition refinement algorithm.',
        complexity: 'O(|Σ| · |Q| log |Q|)',
        recommended: false,
      });
    }
    return opts;
  };

  const options = getConversionOptions();

  return (
    <div className="flex flex-col gap-5">
      {/* Conversion Active View */}
      {conversion ? (
        <div className="flex flex-col gap-4">
          {/* Top Bar with Re-configure option */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                {conversion.algorithm.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-400">
                {conversion.original_automaton.name} ({conversion.original_automaton.type}) → {conversion.converted_automaton.name} ({conversion.converted_automaton.type})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConversion(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Select Another Conversion
              </button>
              <button
                onClick={() => onLoadIntoBuilder(conversion.converted_automaton)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition flex items-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Load Result into Builder
              </button>
            </div>
          </div>

          {/* Interactive StepPlayer Controls */}
          <StepPlayer
            conversion={conversion}
            currentStepIndex={currentStepIndex}
            onStepChange={handleStepChange}
          />

          {/* Dual Side-by-Side Canvas Visualizers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span>Original {conversion.original_automaton.type} ({conversion.original_automaton.states.length} states)</span>
                <span className="font-mono text-[10px] text-slate-500">{conversion.original_automaton.id}</span>
              </span>
              <div className="h-[420px]">
                <AutomataCanvas
                  automaton={conversion.original_automaton}
                  readOnly={true}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-cyan-400 flex items-center justify-between">
                <span>Resulting {conversion.converted_automaton.type} ({conversion.converted_automaton.states.length} states)</span>
                <span className="font-mono text-[10px] text-cyan-500">{conversion.converted_automaton.id}</span>
              </span>
              <div className="h-[420px]">
                <AutomataCanvas
                  automaton={conversion.converted_automaton}
                  highlightStates={highlightStates}
                  highlightTransitions={highlightTransitions}
                  readOnly={true}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Conversion Selection & Route Visualizer */
        <div className="flex flex-col gap-6 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Conversion Laboratory & Route Visualizer</h2>
              <p className="text-xs text-slate-400">
                Choose a source automaton and target conversion route to launch the interactive, animated step-by-step laboratory.
              </p>
            </div>
          </div>

          {/* Source Automaton Selection Strip */}
          <div className="flex flex-col gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">
              1. Select Source Automaton
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-1">
              {availableAutomata.map((aut) => (
                <button
                  key={aut.id}
                  onClick={() => {
                    setSelectedSourceId(aut.id);
                    setSelectedTarget(
                      aut.type === 'ENFA' ? 'enfa-to-nfa' : aut.type === 'NFA' ? 'to-dfa' : 'minimize'
                    );
                  }}
                  className={`p-3 rounded-lg border text-left transition flex flex-col gap-1 ${
                    selectedSourceId === aut.id
                      ? 'bg-cyan-950/40 border-cyan-500 shadow-md'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate">{aut.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                      {aut.type}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {aut.states.length} states · Σ: {'{' + aut.alphabet.join(',') + '}'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Conversion Options Strip */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">
              2. Select Conversion Route for {sourceAut.name} ({sourceAut.type})
            </label>
            <div className="grid grid-cols-1 gap-3 mt-1">
              {options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedTarget(opt.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-3 ${
                    selectedTarget === opt.id
                      ? 'bg-cyan-950/30 border-cyan-500 shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-750'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        checked={selectedTarget === opt.id}
                        onChange={() => setSelectedTarget(opt.id)}
                        className="accent-cyan-500"
                      />
                      <span className="font-bold text-sm text-white">{opt.title}</span>
                      {opt.recommended && (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-semibold rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-500">Complexity: {opt.complexity}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pl-6">{opt.description}</p>

                  {/* Route Flow Diagram */}
                  <div className="flex flex-wrap items-center gap-2 pl-6 text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">Transformation Pipeline:</span>
                    {opt.route.map((step, sIdx) => (
                      <React.Fragment key={sIdx}>
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-cyan-300 font-medium">
                          {step}
                        </span>
                        {sIdx < opt.route.length - 1 && (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch Button */}
          <button
            onClick={handleRunConversion}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-sm text-white shadow-xl shadow-cyan-600/20 transition flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            {loading ? "Running Mathematical Conversion..." : "Run Conversion & Launch Step-by-Step Laboratory"}
          </button>
        </div>
      )}
    </div>
  );
};
