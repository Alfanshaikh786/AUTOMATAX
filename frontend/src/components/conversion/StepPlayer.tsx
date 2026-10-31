import React, { useState, useEffect } from 'react';
import { ConversionResponse, ConversionStep } from '../../types/automata';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, BookOpen, CheckCircle } from 'lucide-react';

interface StepPlayerProps {
  conversion: ConversionResponse;
  currentStepIndex: number;
  onStepChange: (index: number) => void;
}

export const StepPlayer: React.FC<StepPlayerProps> = ({
  conversion,
  currentStepIndex,
  onStepChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1500);
  const steps = conversion.steps;
  const total = steps.length;
  const currentStep: ConversionStep | undefined = steps[currentStepIndex];

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setTimeout(() => {
        if (currentStepIndex < total - 1) {
          onStepChange(currentStepIndex + 1);
        } else {
          setIsPlaying(false);
        }
      }, speedMs);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex, total, speedMs, onStepChange]);

  if (!steps.length) return null;

  return (
    <div className="flex flex-col gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Player Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStepChange(0)}
            title="Reset to Step 1"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            title="Previous Step"
            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 transition"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause" : "Play Animation"}
            className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-semibold flex items-center gap-1.5 transition px-3"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="text-xs">{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={() => onStepChange(Math.min(total - 1, currentStepIndex + 1))}
            disabled={currentStepIndex === total - 1}
            title="Next Step"
            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-300 transition"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <span className="ml-2 text-xs font-mono text-slate-400">
            Step <b className="text-cyan-400 text-sm">{currentStepIndex + 1}</b> / {total}
          </span>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Speed:</span>
          {[
            { label: '0.5x', ms: 2500 },
            { label: '1x', ms: 1500 },
            { label: '2x', ms: 750 },
            { label: '4x', ms: 350 },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setSpeedMs(s.ms)}
              className={`px-2 py-0.5 rounded text-xs transition ${speedMs === s.ms ? 'bg-cyan-600 text-white font-semibold' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
          style={{ width: `${((currentStepIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Mathematical Explanation Pane */}
      {currentStep && (
        <div className="flex flex-col gap-2 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
            <BookOpen className="w-4 h-4" />
            <span>{currentStep.title}</span>
            <span className="text-xs px-2 py-0.5 bg-cyan-950/60 border border-cyan-800/60 rounded text-cyan-300 font-mono ml-auto">
              {currentStep.action_type}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{currentStep.description}</p>
          <div className="bg-slate-900 border border-slate-800 rounded p-2.5 mt-1 font-mono text-xs text-emerald-300/90 whitespace-pre-wrap leading-5">
            {currentStep.mathematical_explanation}
          </div>
        </div>
      )}
    </div>
  );
};
