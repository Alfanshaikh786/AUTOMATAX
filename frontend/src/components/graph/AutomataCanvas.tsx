import React, { useState, useRef, useEffect } from 'react';
import { AutomatonModel } from '../../types/automata';
import dagre from 'dagre';
import { ZoomIn, ZoomOut, RotateCcw, Layout, Plus, Trash2, ArrowRight, GitFork } from 'lucide-react';

interface AutomataCanvasProps {
  automaton: AutomatonModel;
  onChange?: (updated: AutomatonModel) => void;
  highlightStates?: string[];
  highlightTransitions?: Array<{ from: string; to: string; symbol: string }>;
  readOnly?: boolean;
  selectedState?: string | null;
  onSelectState?: (state: string | null) => void;
}

export const AutomataCanvas: React.FC<AutomataCanvasProps> = ({
  automaton,
  onChange,
  highlightStates = [],
  highlightTransitions = [],
  readOnly = false,
  selectedState = null,
  onSelectState,
}) => {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggedState, setDraggedState] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // In-canvas Transition Editor Modal state
  const [editingTransition, setEditingTransition] = useState<{
    from: string;
    to: string;
    initialSymbols?: string[];
    isNew?: boolean;
  } | null>(null);
  const [modalFrom, setModalFrom] = useState<string>('');
  const [modalTo, setModalTo] = useState<string>('');
  const [modalSymbols, setModalSymbols] = useState<string[]>([]);

  // Update modal state when editingTransition changes
  useEffect(() => {
    if (editingTransition) {
      setModalFrom(editingTransition.from);
      setModalTo(editingTransition.to);
      setModalSymbols(editingTransition.initialSymbols || []);
    }
  }, [editingTransition]);

  // Layout states automatically if not present or on request
  const applyDagreLayout = (force = false) => {
    if (!automaton.states.length) return;
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 90, ranksep: 120 });
    g.setDefaultEdgeLabel(() => ({}));

    automaton.states.forEach((s) => {
      g.setNode(s, { width: 70, height: 70 });
    });

    // Add normal edges
    Object.entries(automaton.transitions).forEach(([src, symMap]) => {
      Object.entries(symMap).forEach(([_, dests]) => {
        dests.forEach((dst) => {
          if (automaton.states.includes(src) && automaton.states.includes(dst)) {
            g.setEdge(src, dst);
          }
        });
      });
    });

    // Add epsilon edges
    if (automaton.type === 'ENFA' && automaton.epsilon_transitions) {
      Object.entries(automaton.epsilon_transitions).forEach(([src, dests]) => {
        dests.forEach((dst) => {
          if (automaton.states.includes(src) && automaton.states.includes(dst)) {
            g.setEdge(src, dst);
          }
        });
      });
    }

    dagre.layout(g);

    const newPositions: Record<string, { x: number; y: number }> = {};
    automaton.states.forEach((s) => {
      const node = g.node(s);
      if (node) {
        newPositions[s] = { x: node.x + 80, y: node.y + 80 };
      } else {
        newPositions[s] = { x: 150, y: 150 };
      }
    });

    setPositions(newPositions);
    if (onChange && !readOnly) {
      onChange({ ...automaton, layout: { positions: newPositions } });
    }
  };

  useEffect(() => {
    if (automaton.layout?.positions && Object.keys(automaton.layout.positions).length > 0) {
      setPositions(automaton.layout.positions);
    } else {
      applyDagreLayout(true);
    }
  }, [automaton.states.join(','), automaton.id]);

  // Handle Dragging
  const handleMouseDownNode = (state: string, e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    if (connectingFrom) {
      // Open transition editor between connectingFrom and clicked state (allows self-loop if connectingFrom === state)
      const existingSymbols: string[] = [];
      automaton.alphabet.forEach((sym) => {
        if ((automaton.transitions[connectingFrom]?.[sym] || []).includes(state)) {
          existingSymbols.push(sym);
        }
      });
      if (automaton.type === 'ENFA' && (automaton.epsilon_transitions[connectingFrom] || []).includes(state)) {
        existingSymbols.push('ε');
      }

      setEditingTransition({
        from: connectingFrom,
        to: state,
        initialSymbols: existingSymbols,
        isNew: existingSymbols.length === 0,
      });
      setConnectingFrom(null);
      return;
    }
    onSelectState?.(state);
    setDraggedState(state);
    const pos = positions[state] || { x: 100, y: 100 };
    setDragOffset({
      x: e.clientX / zoom - pos.x,
      y: e.clientY / zoom - pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedState) {
      const newX = e.clientX / zoom - dragOffset.x;
      const newY = e.clientY / zoom - dragOffset.y;
      setPositions((prev) => ({
        ...prev,
        [draggedState]: { x: Math.max(40, newX), y: Math.max(40, newY) },
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggedState && onChange && !readOnly) {
      onChange({ ...automaton, layout: { positions } });
    }
    setDraggedState(null);
    setIsPanning(false);
  };

  const handleStartPan = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectState?.(null);
    }
  };

  const handleSaveTransitionModal = (from: string, to: string, selectedSymbols: string[]) => {
    if (!onChange || readOnly) return;
    const newTrans: Record<string, Record<string, string[]>> = {};

    automaton.states.forEach((s) => {
      newTrans[s] = {};
      automaton.alphabet.forEach((sym) => {
        const dests = [...(automaton.transitions[s]?.[sym] || [])];
        if (s === from) {
          if (selectedSymbols.includes(sym)) {
            if (automaton.type === 'DFA') {
              newTrans[s][sym] = [to];
            } else {
              newTrans[s][sym] = Array.from(new Set([...dests, to]));
            }
          } else {
            newTrans[s][sym] = dests.filter((d) => d !== to);
          }
        } else {
          newTrans[s][sym] = dests;
        }
      });
    });

    const newEps: Record<string, string[]> = {};
    if (automaton.type === 'ENFA') {
      automaton.states.forEach((s) => {
        const epsDests = [...(automaton.epsilon_transitions[s] || [])];
        if (s === from) {
          if (selectedSymbols.includes('ε')) {
            newEps[s] = Array.from(new Set([...epsDests, to]));
          } else {
            newEps[s] = epsDests.filter((d) => d !== to);
          }
        } else {
          newEps[s] = epsDests;
        }
      });
    }

    onChange({
      ...automaton,
      transitions: newTrans,
      epsilon_transitions: newEps,
    });
    setEditingTransition(null);
  };

  const handleDeleteEdge = (from: string, to: string) => {
    if (!onChange || readOnly) return;
    const newTrans: Record<string, Record<string, string[]>> = {};
    automaton.states.forEach((s) => {
      newTrans[s] = {};
      automaton.alphabet.forEach((sym) => {
        const dests = automaton.transitions[s]?.[sym] || [];
        if (s === from) {
          newTrans[s][sym] = dests.filter((d) => d !== to);
        } else {
          newTrans[s][sym] = dests;
        }
      });
    });

    const newEps: Record<string, string[]> = {};
    if (automaton.type === 'ENFA') {
      automaton.states.forEach((s) => {
        const epsDests = automaton.epsilon_transitions[s] || [];
        if (s === from) {
          newEps[s] = epsDests.filter((d) => d !== to);
        } else {
          newEps[s] = epsDests;
        }
      });
    }

    onChange({
      ...automaton,
      transitions: newTrans,
      epsilon_transitions: newEps,
    });
    setEditingTransition(null);
  };

  // Compile unique edge groups between (from, to)
  const edgeGroups: Record<string, { from: string; to: string; symbols: string[]; isEpsilon: boolean }> = {};

  Object.entries(automaton.transitions).forEach(([src, symMap]) => {
    Object.entries(symMap).forEach(([sym, dests]) => {
      dests.forEach((dst) => {
        if (!automaton.states.includes(src) || !automaton.states.includes(dst)) return;
        const key = `${src}->${dst}`;
        if (!edgeGroups[key]) {
          edgeGroups[key] = { from: src, to: dst, symbols: [], isEpsilon: false };
        }
        if (!edgeGroups[key].symbols.includes(sym)) {
          edgeGroups[key].symbols.push(sym);
        }
      });
    });
  });

  if (automaton.type === 'ENFA' && automaton.epsilon_transitions) {
    Object.entries(automaton.epsilon_transitions).forEach(([src, dests]) => {
      dests.forEach((dst) => {
        if (!automaton.states.includes(src) || !automaton.states.includes(dst)) return;
        const key = `${src}->${dst}`;
        if (!edgeGroups[key]) {
          edgeGroups[key] = { from: src, to: dst, symbols: ['ε'], isEpsilon: true };
        } else if (!edgeGroups[key].symbols.includes('ε')) {
          edgeGroups[key].symbols.push('ε');
        }
      });
    });
  }

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden select-none">
      {/* Controls Bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-750 px-2 py-1.5 rounded-lg shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          title="Zoom In"
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
          title="Zoom Out"
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          title="Reset Zoom & Pan"
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
        <button
          onClick={() => applyDagreLayout(true)}
          title="Auto Layout (Dagre)"
          className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 rounded text-xs font-medium text-cyan-400 transition"
        >
          <Layout className="w-3.5 h-3.5" />
          Auto Layout
        </button>
        {!readOnly && (
          <>
            <div className="w-[1px] h-4 bg-slate-700 mx-1" />
            <button
              onClick={() => {
                const name = window.prompt("New state name:", `q${automaton.states.length}`);
                if (name && !automaton.states.includes(name)) {
                  const newStates = [...automaton.states, name];
                  const newPositions = { ...positions, [name]: { x: 200, y: 200 } };
                  onChange?.({
                    ...automaton,
                    states: newStates,
                    layout: { positions: newPositions },
                  });
                }
              }}
              title="Add State"
              className="flex items-center gap-1 px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 rounded text-xs font-medium text-cyan-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add State
            </button>
            <button
              onClick={() => {
                setEditingTransition({
                  from: automaton.states[0] || '',
                  to: automaton.states[0] || '',
                  initialSymbols: [automaton.alphabet[0] || '0'],
                  isNew: true,
                });
              }}
              title="Add or Edit Transitions"
              className="flex items-center gap-1 px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded text-xs font-medium text-purple-200 transition"
            >
              <GitFork className="w-3.5 h-3.5" />
              Add Transition
            </button>
          </>
        )}
      </div>

      {connectingFrom && (
        <div className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-lg text-xs font-medium text-amber-300 flex items-center gap-2 shadow-lg">
          <span>Click target state to connect transition from <b>{connectingFrom}</b> (click self for loop)</span>
          <button onClick={() => setConnectingFrom(null)} className="underline ml-2 text-white font-bold">Cancel</button>
        </div>
      )}

      {/* Main SVG Area */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleStartPan}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
          </marker>
          <marker
            id="start-arrow"
            markerWidth="12"
            markerHeight="8"
            refX="11"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 12 4, 0 8" fill="#10b981" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Grid pattern background */}
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.75" fill="#334155" opacity="0.4" />
          </pattern>
          <rect x="-2000" y="-2000" width="4000" height="4000" fill="url(#grid)" pointerEvents="none" />

          {/* Render Transitions */}
          {Object.values(edgeGroups).map((edge, idx) => {
            const p1 = positions[edge.from] || { x: 100, y: 100 };
            const p2 = positions[edge.to] || { x: 300, y: 100 };

            const isSelfLoop = edge.from === edge.to;
            const isReverse = edgeGroups[`${edge.to}->${edge.from}`] && edge.from !== edge.to;

            const isHighlighted = highlightTransitions.some(
              (t) => t.from === edge.from && t.to === edge.to && edge.symbols.includes(t.symbol)
            );

            const strokeColor = isHighlighted ? '#06b6d4' : edge.isEpsilon ? '#a855f7' : '#64748b';
            const markerEnd = isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)';

            if (isSelfLoop) {
              // Self-loop arc
              const loopRadius = 26;
              const loopX = p1.x;
              const loopY = p1.y - 32;
              const pathD = `M ${p1.x - 14} ${p1.y - 24} A ${loopRadius} ${loopRadius} 0 1 1 ${p1.x + 14} ${p1.y - 24}`;

              const labelWidth = Math.max(26, edge.symbols.join(',').length * 8 + 10);

              return (
                <g key={`edge-${idx}`} className="group">
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.5 : 1.75}
                    markerEnd={markerEnd}
                  />
                  <rect
                    x={loopX - labelWidth / 2}
                    y={loopY - 26}
                    width={labelWidth}
                    height={18}
                    rx={4}
                    fill="#090d16"
                    stroke={strokeColor}
                    strokeWidth={1}
                    className="cursor-pointer hover:stroke-cyan-400 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!readOnly) {
                        setEditingTransition({
                          from: edge.from,
                          to: edge.to,
                          initialSymbols: edge.symbols,
                          isNew: false,
                        });
                      }
                    }}
                  />
                  <text
                    x={loopX}
                    y={loopY - 13}
                    textAnchor="middle"
                    fill={isHighlighted ? '#67e8f9' : '#cbd5e1'}
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="monospace"
                    className="pointer-events-none"
                  >
                    {edge.symbols.join(',')}
                  </text>
                </g>
              );
            }

            // Normal transition curve
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nodeRadius = 32;

            // Offset for curved bi-directional transitions
            const curveOffset = isReverse ? 26 : 0;
            const midX = (p1.x + p2.x) / 2 + (-dy / dist) * curveOffset;
            const midY = (p1.y + p2.y) / 2 + (dx / dist) * curveOffset;

            // Shorten path to touch outer boundary of node
            const startX = p1.x + (dx / dist) * nodeRadius;
            const startY = p1.y + (dy / dist) * nodeRadius;
            const endX = p2.x - (dx / dist) * (nodeRadius + 6);
            const endY = p2.y - (dy / dist) * (nodeRadius + 6);

            const pathD = isReverse
              ? `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
              : `M ${startX} ${startY} L ${endX} ${endY}`;

            const labelWidth = Math.max(26, edge.symbols.join(',').length * 8 + 10);

            return (
              <g key={`edge-${idx}`} className="group">
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 2.5 : 1.75}
                  markerEnd={markerEnd}
                />
                <rect
                  x={midX - labelWidth / 2}
                  y={midY - 9}
                  width={labelWidth}
                  height={18}
                  rx={4}
                  fill="#0b0f19"
                  stroke={strokeColor}
                  strokeWidth={1}
                  className="cursor-pointer hover:stroke-cyan-400 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!readOnly) {
                      setEditingTransition({
                        from: edge.from,
                        to: edge.to,
                        initialSymbols: edge.symbols,
                        isNew: false,
                      });
                    }
                  }}
                />
                <text
                  x={midX}
                  y={midY + 4}
                  textAnchor="middle"
                  fill={isHighlighted ? '#67e8f9' : '#cbd5e1'}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                  className="pointer-events-none"
                >
                  {edge.symbols.join(',')}
                </text>
              </g>
            );
          })}

          {/* Render States */}
          {automaton.states.map((s) => {
            const pos = positions[s] || { x: 150, y: 150 };
            const isInitial = s === automaton.initial_state;
            const isAccepting = automaton.accepting_states.includes(s);
            const isSelected = selectedState === s;
            const isHighlighted = highlightStates.includes(s);

            let fillColor = '#111827';
            let strokeColor = isInitial ? '#10b981' : isAccepting ? '#ef4444' : '#475569';
            if (isSelected) {
              strokeColor = '#06b6d4';
              fillColor = '#164e63';
            } else if (isHighlighted) {
              strokeColor = '#38bdf8';
              fillColor = '#0369a1';
            }

            return (
              <g
                key={`node-${s}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleMouseDownNode(s, e)}
                className="cursor-pointer group"
              >
                {/* Initial State Arrow */}
                {isInitial && (
                  <line
                    x1="-65"
                    y1="0"
                    x2="-34"
                    y2="0"
                    stroke="#10b981"
                    strokeWidth="3"
                    markerEnd="url(#start-arrow)"
                  />
                )}

                {/* Outer Base Circle */}
                <circle
                  r="30"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected || isHighlighted ? 3 : 2}
                  className="transition-colors duration-150"
                />

                {/* Double Circle for Accepting State */}
                {isAccepting && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.75"
                  />
                )}

                {/* State Label */}
                <text
                  y="4"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="13"
                  fontWeight="600"
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  {s}
                </text>

                {/* Quick connect button on hover if not readOnly */}
                {!readOnly && (
                  <circle
                    cx="26"
                    cy="-26"
                    r="9"
                    fill="#0284c7"
                    className="opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConnectingFrom(s);
                    }}
                  >
                    <title>Connect transition from this state</title>
                  </circle>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* In-Canvas Transition Editor Modal */}
      {editingTransition && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 shadow-2xl max-w-sm w-full flex flex-col gap-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-cyan-400" />
                {editingTransition.isNew ? 'Create Transition' : 'Edit Transition Edge'}
              </h3>
              <button
                onClick={() => setEditingTransition(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* From and To State Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold text-[11px]">From State</label>
                <select
                  value={modalFrom}
                  onChange={(e) => setModalFrom(e.target.value)}
                  className="bg-slate-950 border border-slate-750 rounded px-2.5 py-1.5 font-mono text-cyan-300 font-bold outline-none"
                >
                  {automaton.states.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold text-[11px]">To State</label>
                <select
                  value={modalTo}
                  onChange={(e) => setModalTo(e.target.value)}
                  className="bg-slate-950 border border-slate-750 rounded px-2.5 py-1.5 font-mono text-cyan-300 font-bold outline-none"
                >
                  {automaton.states.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Symbol Selection Chips */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold text-[11px]">
                Transition Symbol(s) (Click to toggle)
              </label>
              <div className="flex flex-wrap gap-2">
                {automaton.alphabet.map((sym) => {
                  const isSelected = modalSymbols.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setModalSymbols((prev) =>
                          isSelected ? prev.filter((s) => s !== sym) : [...prev, sym]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{sym}</span>
                      {isSelected && <span className="text-[10px] text-cyan-400">✓</span>}
                    </button>
                  );
                })}
                {automaton.type === 'ENFA' && (
                  <button
                    type="button"
                    onClick={() => {
                      const isSelected = modalSymbols.includes('ε');
                      setModalSymbols((prev) =>
                        isSelected ? prev.filter((s) => s !== 'ε') : [...prev, 'ε']
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition flex items-center gap-1.5 ${
                      modalSymbols.includes('ε')
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>ε</span>
                    {modalSymbols.includes('ε') && <span className="text-[10px] text-purple-400">✓</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-1">
              {!editingTransition.isNew ? (
                <button
                  type="button"
                  onClick={() => handleDeleteEdge(editingTransition.from, editingTransition.to)}
                  className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded font-semibold transition"
                >
                  Delete Edge
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTransition(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveTransitionModal(modalFrom, modalTo, modalSymbols)}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold shadow-md transition"
                >
                  Save Transition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
