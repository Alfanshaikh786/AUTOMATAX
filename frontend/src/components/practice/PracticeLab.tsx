import React, { useState, useEffect } from 'react';
import { AutomatonModel, Exercise } from '../../types/automata';
import { api } from '../../services/api';
import { AutomataCanvas } from '../graph/AutomataCanvas';
import { TransitionTable } from '../tables/TransitionTable';
import confetti from 'canvas-confetti';
import { GraduationCap, Lightbulb, CheckCircle2, XCircle, Award, Play } from 'lucide-react';

export const PracticeLab: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);
  const [revealedHints, setRevealedHints] = useState<number>(0);
  const [studentAutomaton, setStudentAutomaton] = useState<AutomatonModel>({
    id: 'student_sol',
    name: 'My Solution',
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
  });

  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getExercises().then((data) => {
      setExercises(data);
      if (data.length > 0) {
        setSelectedEx(data[0]);
        setStudentAutomaton({
          id: 'student_sol',
          name: 'My Solution',
          type: 'DFA',
          states: ['q0'],
          alphabet: data[0].alphabet,
          initial_state: 'q0',
          accepting_states: [],
          transitions: { q0: {} },
          epsilon_transitions: {},
        });
      }
    });
  }, []);

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedEx(ex);
    setRevealedHints(0);
    setEvaluation(null);
    setStudentAutomaton({
      id: `sol_${ex.id}`,
      name: `Solution to ${ex.title}`,
      type: 'DFA',
      states: ['q0'],
      alphabet: ex.alphabet,
      initial_state: 'q0',
      accepting_states: [],
      transitions: { q0: {} },
      epsilon_transitions: {},
    });
  };

  const handleEvaluate = async () => {
    if (!selectedEx) return;
    try {
      setLoading(true);
      const res = await api.evaluateSubmission(selectedEx.id, studentAutomaton);
      setEvaluation(res);
      if (res.is_correct) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <GraduationCap className="w-6 h-6 text-cyan-400" />
        <div>
          <h2 className="text-lg font-bold text-white">Automata Learning & Practice Academy</h2>
          <p className="text-xs text-slate-400">
            Interactive exercise challenges with step-by-step hints and automated mathematical equivalence grading.
          </p>
        </div>
      </div>

      {/* Exercises Selection Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => handleSelectExercise(ex)}
            className={`p-3.5 rounded-xl border text-left transition flex flex-col gap-1.5 ${
              selectedEx?.id === ex.id
                ? 'bg-cyan-950/40 border-cyan-500 shadow-lg'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                ex.difficulty === 'Beginner'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : ex.difficulty === 'Intermediate'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {ex.difficulty}
              </span>
              <span className="text-xs text-slate-500 font-mono">{ex.topic}</span>
            </div>
            <h4 className="font-bold text-sm text-white">{ex.title}</h4>
            <p className="text-xs text-slate-400 line-clamp-2">{ex.description}</p>
          </button>
        ))}
      </div>

      {/* Active Exercise Detail */}
      {selectedEx && (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">{selectedEx.title}</h3>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-900">
                Alphabet: {'{' + selectedEx.alphabet.join(', ') + '}'}
              </span>
            </div>
            <p className="text-xs text-slate-300">{selectedEx.description}</p>
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-xs text-emerald-300">
              Formal Requirement: {selectedEx.formal_specification}
            </div>

            {/* Step-by-Step Hints */}
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-850">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" />
                  Hints ({revealedHints}/{selectedEx.hints.length})
                </span>
                {revealedHints < selectedEx.hints.length && (
                  <button
                    onClick={() => setRevealedHints((h) => h + 1)}
                    className="text-xs px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded transition"
                  >
                    Unlock Next Hint
                  </button>
                )}
              </div>
              {selectedEx.hints.slice(0, revealedHints).map((hint, idx) => (
                <div key={idx} className="p-2 bg-amber-950/20 border border-amber-800/40 rounded text-xs text-amber-200/90 leading-relaxed">
                  {hint}
                </div>
              ))}
            </div>
          </div>

          {/* Student Editor Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-[420px]">
              <AutomataCanvas automaton={studentAutomaton} onChange={setStudentAutomaton} />
            </div>
            <div className="flex flex-col gap-3">
              <TransitionTable automaton={studentAutomaton} onChange={setStudentAutomaton} />
              <button
                onClick={handleEvaluate}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg text-sm font-semibold text-white shadow-lg transition flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4" />
                {loading ? "Verifying Equivalence..." : "Submit Solution for Evaluation"}
              </button>
            </div>
          </div>

          {/* Evaluation Result */}
          {evaluation && (
            <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
              evaluation.is_correct
                ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/40 border-rose-700 text-rose-200'
            }`}>
              {evaluation.is_correct ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">
                    {evaluation.is_correct ? "CORRECT! EXERCISE COMPLETED (100/100)" : "INCORRECT SOLUTION"}
                  </h4>
                  <span className="font-bold text-sm font-mono">Score: {evaluation.score}%</span>
                </div>
                <p className="text-xs opacity-90 mt-1">{evaluation.message}</p>
                {evaluation.counterexample && (
                  <div className="mt-2 text-xs font-mono bg-slate-950/80 p-2 rounded border border-rose-800/60 text-rose-300">
                    Counterexample found: '{evaluation.counterexample}'
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
