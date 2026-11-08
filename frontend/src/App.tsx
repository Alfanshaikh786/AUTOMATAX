import React, { useState, useEffect } from 'react';
import { AutomatonModel, ConversionResponse } from './types/automata';
import { api } from './services/api';
import { AutomataCanvas } from './components/graph/AutomataCanvas';
import { TransitionTable } from './components/tables/TransitionTable';
import { StepPlayer } from './components/conversion/StepPlayer';
import { ConversionLabView } from './components/conversion/ConversionLabView';
import { SimulationPane } from './components/simulator/SimulationPane';
import { EquivalenceView } from './components/equivalence/EquivalenceView';
import { DebuggerView } from './components/debugger/DebuggerView';
import { WhatIfLab } from './components/whatif/WhatIfLab';
import { RegexLab } from './components/regex/RegexLab';
import { GrammarLab } from './components/grammar/GrammarLab';
import { OperationsLab } from './components/operations/OperationsLab';
import { ComparisonLab } from './components/comparison/ComparisonLab';
import { PracticeLab } from './components/practice/PracticeLab';
import { DualAutomataStudio } from './components/studio/DualAutomataStudio';
import { AIGeneratorModal } from './components/ai/AIGeneratorModal';
import { ExportModal } from './components/reports/ExportModal';

import {
  Layers, Play, CheckCircle2, GitCompare, ShieldAlert, Sparkles,
  BookMarked, Network, Columns3, GraduationCap, Download, Plus,
  Save, RotateCcw, HelpCircle, Code2, Cpu, Compass, Workflow
} from 'lucide-react';

const DEFAULT_AUTOMATON: AutomatonModel = {
  id: 'aut_default_even0',
  name: 'Even Zeros DFA',
  type: 'DFA',
  states: ['q0', 'q1'],
  alphabet: ['0', '1'],
  initial_state: 'q0',
  accepting_states: ['q0'],
  transitions: {
    q0: { '0': ['q1'], '1': ['q0'] },
    q1: { '0': ['q0'], '1': ['q1'] },
  },
  epsilon_transitions: {},
  description: 'Accepts binary strings containing an even number of zeros.',
};

export function App() {
  const [activeTab, setActiveTab] = useState<string>('builder');
  const [currentAutomaton, setCurrentAutomaton] = useState<AutomatonModel>(DEFAULT_AUTOMATON);
  const [availableAutomata, setAvailableAutomata] = useState<AutomatonModel[]>([DEFAULT_AUTOMATON]);
  const [conversion, setConversion] = useState<ConversionResponse | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highlightStates, setHighlightStates] = useState<string[]>([]);
  const [highlightTransitions, setHighlightTransitions] = useState<Array<{ from: string; to: string; symbol: string }>>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load pre-seeded benchmark automata from backend
    api.getAll().then((list) => {
      if (list && list.length > 0) {
        setAvailableAutomata(list);
        setCurrentAutomaton(list[0]);
      }
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      const saved = await api.save(currentAutomaton);
      alert(`Automaton '${saved.name}' saved successfully to persistent storage.`);
      const updatedList = await api.getAll();
      setAvailableAutomata(updatedList);
    } catch (e: any) {
      alert(`Save Error: ${e.message}`);
    }
  };

  const handleConversion = async (type: 'enfa-to-nfa' | 'to-dfa' | 'minimize' | 'dfa-to-nfa' | 'to-enfa') => {
    try {
      setLoading(true);
      let res: ConversionResponse;
      if (type === 'enfa-to-nfa') {
        res = await api.convertEnfaToNfa(currentAutomaton);
      } else if (type === 'to-dfa') {
        res = await api.convertToDfa(currentAutomaton);
      } else if (type === 'dfa-to-nfa') {
        res = await api.convertDfaToNfa(currentAutomaton);
      } else if (type === 'to-enfa') {
        res = await api.convertToEnfa(currentAutomaton);
      } else {
        res = await api.minimizeDfa(currentAutomaton);
      }
      setConversion(res);
      setCurrentStepIndex(0);
      setActiveTab('conversion');
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

  const navItems = [
    { id: 'builder', label: 'Automata Builder', icon: Cpu },
    { id: 'dual-studio', label: 'Dual NFA/DFA Studio', icon: Workflow },
    { id: 'conversion', label: 'Conversion Lab', icon: Layers },
    { id: 'simulation', label: 'String Simulator', icon: Play },
    { id: 'equivalence', label: 'Equivalence Checker', icon: GitCompare },
    { id: 'regex', label: 'Regex Lab', icon: Code2 },
    { id: 'grammar', label: 'Grammar Lab', icon: BookMarked },
    { id: 'operations', label: 'Operations Lab', icon: Network },
    { id: 'debugger', label: 'Diagnostics & Debugger', icon: ShieldAlert },
    { id: 'whatif', label: 'What-If Lab', icon: Sparkles },
    { id: 'comparison', label: 'Solution Comparison', icon: Columns3 },
    { id: 'practice', label: 'Academy & Challenges', icon: GraduationCap },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-3 select-none">
        <div className="flex flex-col gap-4">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-cyan-500/20">
              AX
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white leading-tight">AUTOMATAX</h1>
              <p className="text-[10px] text-cyan-400 font-medium tracking-wide">THE COMPUTATIONAL LAB</p>
            </div>
          </div>

          {/* Quick AI Generator Pill */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs font-semibold text-cyan-300 transition group shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              AI Synthesizer
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/30 rounded text-cyan-200">NL → DFA</span>
          </button>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Current Automaton Status */}
        <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300 truncate">{currentAutomaton.name}</span>
            <span className="px-1.5 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded font-mono text-[10px]">
              {currentAutomaton.type}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>{currentAutomaton.states.length} states</span>
            <span>Σ: {'{' + currentAutomaton.alphabet.join(',') + '}'}</span>
          </div>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 text-xs font-medium text-slate-200 rounded flex items-center justify-center gap-1.5 transition mt-1"
          >
            <Download className="w-3.5 h-3.5" />
            Export & PDF Report
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-950">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur flex items-center justify-between px-6 z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Workspace:</span>
            <select
              value={currentAutomaton.id}
              onChange={(e) => {
                const found = availableAutomata.find((a) => a.id === e.target.value);
                if (found) setCurrentAutomaton(found);
              }}
              className="bg-slate-900 border border-slate-750 rounded px-2.5 py-1 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-500"
            >
              {availableAutomata.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Conversion Triggers */}
          <div className="flex items-center gap-2">
            {currentAutomaton.type === 'DFA' && (
              <>
                <button
                  onClick={() => handleConversion('dfa-to-nfa')}
                  disabled={loading}
                  className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded text-xs font-semibold text-purple-200 transition"
                  title="Every DFA is a special case of an NFA with singleton destination sets"
                >
                  Convert to NFA
                </button>
                <button
                  onClick={() => handleConversion('to-enfa')}
                  disabled={loading}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded text-xs font-semibold text-indigo-200 transition"
                  title="Embed DFA into ε-NFA format with empty ε-transitions"
                >
                  Convert to ε-NFA
                </button>
              </>
            )}

            {currentAutomaton.type === 'NFA' && (
              <>
                <button
                  onClick={() => handleConversion('to-dfa')}
                  disabled={loading}
                  className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 rounded text-xs font-semibold text-cyan-200 transition"
                  title="Construct deterministic automaton via subset construction"
                >
                  Subset Construction (→ DFA)
                </button>
                <button
                  onClick={() => handleConversion('to-enfa')}
                  disabled={loading}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded text-xs font-semibold text-indigo-200 transition"
                  title="Embed NFA into ε-NFA format"
                >
                  Convert to ε-NFA
                </button>
              </>
            )}

            {currentAutomaton.type === 'ENFA' && (
              <>
                <button
                  onClick={() => handleConversion('enfa-to-nfa')}
                  disabled={loading}
                  className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded text-xs font-semibold text-purple-200 transition"
                  title="Eliminate ε-transitions by computing closures"
                >
                  ε-Elimination (ε-NFA → NFA)
                </button>
                <button
                  onClick={() => handleConversion('to-dfa')}
                  disabled={loading}
                  className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 rounded text-xs font-semibold text-cyan-200 transition"
                  title="Epsilon-aware subset construction"
                >
                  Convert to DFA
                </button>
              </>
            )}

            <button
              onClick={() => handleConversion('minimize')}
              disabled={loading}
              className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded text-xs font-semibold text-emerald-200 transition"
              title="Hopcroft DFA partition refinement minimization"
            >
              Hopcroft Minimization
            </button>

            <button
              onClick={handleSave}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow transition"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <div className="flex-1 p-6">
          {activeTab === 'builder' && (
            <div className="flex flex-col gap-4 h-full">
              {/* Properties Bar */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Name:</span>
                    <input
                      type="text"
                      value={currentAutomaton.name}
                      onChange={(e) => setCurrentAutomaton({ ...currentAutomaton, name: e.target.value })}
                      className="bg-slate-950 border border-slate-750 rounded px-2 py-1 text-slate-100 font-semibold outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Type:</span>
                    <select
                      value={currentAutomaton.type}
                      onChange={(e) => setCurrentAutomaton({ ...currentAutomaton, type: e.target.value as any })}
                      className="bg-slate-950 border border-slate-750 rounded px-2 py-1 text-cyan-300 font-mono outline-none"
                    >
                      <option value="DFA">DFA</option>
                      <option value="NFA">NFA</option>
                      <option value="ENFA">ε-NFA</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Alphabet:</span>
                    <input
                      type="text"
                      value={currentAutomaton.alphabet.join(', ')}
                      onChange={(e) =>
                        setCurrentAutomaton({
                          ...currentAutomaton,
                          alphabet: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      className="bg-slate-950 border border-slate-750 rounded px-2 py-1 font-mono text-cyan-400 outline-none focus:border-cyan-500 w-32"
                    />
                  </div>
                </div>

                <div className="text-slate-400 text-xs">
                  Tip: Drag nodes to reposition. Click a state to select it or link transitions.
                </div>
              </div>

              {/* Dual-Mode Canvas & Synchronized Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[500px]">
                <AutomataCanvas
                  automaton={currentAutomaton}
                  onChange={setCurrentAutomaton}
                  highlightStates={highlightStates}
                  highlightTransitions={highlightTransitions}
                />
                <div className="flex flex-col gap-3">
                  <TransitionTable
                    automaton={currentAutomaton}
                    onChange={setCurrentAutomaton}
                  />
                  <SimulationPane
                    automaton={currentAutomaton}
                    onActiveStatesChange={setHighlightStates}
                    onActiveTransitionsChange={setHighlightTransitions}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dual-studio' && (
            <DualAutomataStudio
              onLoadAutomaton={(aut) => {
                if (!availableAutomata.some((a) => a.id === aut.id)) {
                  setAvailableAutomata((prev) => [...prev, aut]);
                }
                setCurrentAutomaton(aut);
                setActiveTab('builder');
              }}
            />
          )}

          {activeTab === 'conversion' && (
            <ConversionLabView
              currentAutomaton={currentAutomaton}
              availableAutomata={availableAutomata}
              onLoadIntoBuilder={(aut) => {
                setCurrentAutomaton(aut);
                setActiveTab('builder');
              }}
              conversion={conversion}
              setConversion={setConversion}
              currentStepIndex={currentStepIndex}
              setCurrentStepIndex={setCurrentStepIndex}
              highlightStates={highlightStates}
              setHighlightStates={setHighlightStates}
              highlightTransitions={highlightTransitions}
              setHighlightTransitions={setHighlightTransitions}
            />
          )}

          {activeTab === 'simulation' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-[520px]">
                <AutomataCanvas
                  automaton={currentAutomaton}
                  highlightStates={highlightStates}
                  highlightTransitions={highlightTransitions}
                  readOnly={true}
                />
              </div>
              <SimulationPane
                automaton={currentAutomaton}
                onActiveStatesChange={setHighlightStates}
                onActiveTransitionsChange={setHighlightTransitions}
              />
            </div>
          )}

          {activeTab === 'equivalence' && (
            <EquivalenceView
              availableAutomata={availableAutomata}
              currentAutomaton={currentAutomaton}
            />
          )}

          {activeTab === 'regex' && (
            <RegexLab
              currentAutomaton={currentAutomaton}
              onLoadAutomaton={(aut) => {
                setCurrentAutomaton(aut);
                setActiveTab('builder');
              }}
            />
          )}

          {activeTab === 'grammar' && (
            <GrammarLab
              currentAutomaton={currentAutomaton}
              onLoadAutomaton={(aut) => {
                setCurrentAutomaton(aut);
                setActiveTab('builder');
              }}
            />
          )}

          {activeTab === 'operations' && (
            <OperationsLab
              availableAutomata={availableAutomata}
              currentAutomaton={currentAutomaton}
              onLoadAutomaton={(aut) => {
                setCurrentAutomaton(aut);
                setActiveTab('builder');
              }}
            />
          )}

          {activeTab === 'debugger' && (
            <DebuggerView
              automaton={currentAutomaton}
              onApplyFix={(updated) => setCurrentAutomaton(updated)}
            />
          )}

          {activeTab === 'whatif' && (
            <WhatIfLab
              baseAutomaton={currentAutomaton}
              onSaveAsNew={(newAut) => {
                setAvailableAutomata([...availableAutomata, newAut]);
                setCurrentAutomaton(newAut);
                setActiveTab('builder');
              }}
            />
          )}

          {activeTab === 'comparison' && (
            <ComparisonLab currentAutomaton={currentAutomaton} />
          )}

          {activeTab === 'practice' && (
            <PracticeLab />
          )}
        </div>
      </main>

      {/* AI Synthesizer Modal */}
      <AIGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onLoadAutomaton={(aut) => {
          setCurrentAutomaton(aut);
          setActiveTab('builder');
        }}
      />

      {/* Export & Report Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        automaton={currentAutomaton}
      />
    </div>
  );
}
export default App;
