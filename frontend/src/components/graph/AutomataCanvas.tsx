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
    g.setGraph({
      rankdir: 'LR',
      nodesep: 120,
      ranksep: 175,
      marginx: 70,
      marginy: 70,
    });
    g.setDefaultEdgeLabel(() => ({}));

    automaton.states.forEach((s) => {
      g.setNode(s, { width: 85, height: 85 });
    });

    const isSinkState = (s: string) =>
      s === '∅' || s.toLowerCase().includes('dead') || s.toLowerCase().includes('trap');

    // Add normal edges with smart weighting
    Object.entries(automaton.transitions).forEach(([src, symMap]) => {
      Object.entries(symMap).forEach(([_, dests]) => {
        dests.forEach((dst) => {
          if (automaton.states.includes(src) && automaton.states.includes(dst)) {
            if (src === dst) return;
            const weight = isSinkState(dst) ? 0.05 : 1;
            g.setEdge(src, dst, { weight, minlen: 1 });
          }
        });
      });
    });

    // Add epsilon edges
    if (automaton.type === 'ENFA' && automaton.epsilon_transitions) {
      Object.entries(automaton.epsilon_transitions).forEach(([src, dests]) => {
        dests.forEach((dst) => {
          if (automaton.states.includes(src) && automaton.states.includes(dst)) {
            if (src === dst) return;
            g.setEdge(src, dst, { weight: 1, minlen: 1 });
          }
        });
      });
    }

    dagre.layout(g);

    const rawPositions: Record<string, { x: number; y: number }> = {};
    automaton.states.forEach((s) => {
      const node = g.node(s);
      if (node) {
        rawPositions[s] = { x: node.x, y: node.y };
      } else {
        rawPositions[s] = { x: 100, y: 100 };
      }
    });

    // Dedicated sink/dead state placement below main computation flow
    const sinkStates = automaton.states.filter(isSinkState);
    const nonSinkStates = automaton.states.filter((s) => !isSinkState(s));

    if (sinkStates.length > 0 && nonSinkStates.length > 0) {
      const maxNonSinkY = Math.max(...nonSinkStates.map((s) => rawPositions[s].y));
      const maxNonSinkX = Math.max(...nonSinkStates.map((s) => rawPositions[s].x));
      const minNonSinkX = Math.min(...nonSinkStates.map((s) => rawPositions[s].x));
      sinkStates.forEach((sink, idx) => {
        rawPositions[sink].y = maxNonSinkY + 120;
        rawPositions[sink].x = Math.max(rawPositions[sink].x, minNonSinkX + (maxNonSinkX - minNonSinkX) * 0.75 + idx * 100);
      });
    }

    // Stagger collinear nodes so edges don't cut through intermediate states
    const xValues = Object.values(rawPositions).map((p) => Math.round(p.x / 20) * 20);
    const uniqueX = new Set(xValues);
    if (uniqueX.size === 1 && automaton.states.length > 2) {
      automaton.states.forEach((s, idx) => {
        if (idx % 2 === 1) {
          rawPositions[s].x += 140;
        }
      });
    }

    const yValues = Object.values(rawPositions).map((p) => Math.round(p.y / 20) * 20);
    const uniqueY = new Set(yValues);
    if (uniqueY.size === 1 && automaton.states.length > 2) {
      automaton.states.forEach((s, idx) => {
        if (idx % 2 === 1) {
          rawPositions[s].y += 120;
        }
      });
    }

    // Auto-center graph in SVG container viewport
    const containerWidth = svgRef.current?.clientWidth || 700;
    const containerHeight = svgRef.current?.clientHeight || 460;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(rawPositions).forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const targetCenterX = containerWidth / 2;
    const targetCenterY = containerHeight / 2;
    const currentCenterX = (minX + maxX) / 2;
    const currentCenterY = (minY + maxY) / 2;

    const shiftX = Math.round(targetCenterX - currentCenterX);
    const shiftY = Math.round(targetCenterY - currentCenterY);

    const newPositions: Record<string, { x: number; y: number }> = {};
    automaton.states.forEach((s) => {
      newPositions[s] = {
        x: Math.max(70, rawPositions[s].x + shiftX),
        y: Math.max(70, rawPositions[s].y + shiftY),
      };
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

  // Precompute layout geometry for all edges to avoid overlaps and node collisions
  const edgeList = Object.values(edgeGroups).map((edge, idx) => {
    const p1 = positions[edge.from] || { x: 100, y: 100 };
    const p2 = positions[edge.to] || { x: 300, y: 100 };

    const isSelfLoop = edge.from === edge.to;
    const isReverse = Boolean(edgeGroups[`${edge.to}->${edge.from}`]) && !isSelfLoop;

    const isHighlighted = highlightTransitions.some(
      (t) => t.from === edge.from && t.to === edge.to && edge.symbols.includes(t.symbol)
    );

    const isEpsOnly = edge.symbols.length === 1 && edge.symbols[0] === 'ε';
    const hasEps = edge.symbols.includes('ε');

    let strokeColor = '#64748b';
    let markerEnd = 'url(#arrowhead)';
    let isDashed = false;
    let badgeBg = '#0b0f19';
    let badgeBorder = '#475569';
    let badgeTextColor = '#e2e8f0';

    if (isHighlighted) {
      strokeColor = '#06b6d4';
      markerEnd = 'url(#arrowhead-active)';
      badgeBg = '#082f49';
      badgeBorder = '#06b6d4';
      badgeTextColor = '#67e8f9';
    } else if (isEpsOnly) {
      strokeColor = '#c084fc';
      markerEnd = 'url(#arrowhead-epsilon)';
      isDashed = true;
      badgeBg = '#2e1065';
      badgeBorder = '#c084fc';
      badgeTextColor = '#f3e8ff';
    } else if (hasEps) {
      strokeColor = '#a855f7';
      markerEnd = 'url(#arrowhead-epsilon)';
      badgeBg = '#1e1b4b';
      badgeBorder = '#a855f7';
      badgeTextColor = '#f5f3ff';
    }

    if (isSelfLoop) {
      const loopRadius = 26;
      const loopX = p1.x;
      const loopY = p1.y - 32;
      const pathD = `M ${p1.x - 14} ${p1.y - 24} A ${loopRadius} ${loopRadius} 0 1 1 ${p1.x + 14} ${p1.y - 24}`;
      const labelWidth = Math.max(28, edge.symbols.join(', ').length * 8 + 14);

      return {
        ...edge,
        idx,
        isSelfLoop: true,
        pathD,
        labelX: loopX,
        labelY: loopY - 26,
        labelWidth,
        labelHeight: 20,
        ux: 0,
        uy: -1,
        strokeColor,
        markerEnd,
        isDashed,
        isHighlighted,
        badgeBg,
        badgeBorder,
        badgeTextColor,
      };
    }

    // Normal transition geometry
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;

    // Check for intermediate obstacle states
    let maxObstacleAvoidance = 0;
    let obstacleSide = 1;

    automaton.states.forEach((s) => {
      if (s === edge.from || s === edge.to) return;
      const sp = positions[s];
      if (!sp) return;
      const vx = sp.x - p1.x;
      const vy = sp.y - p1.y;
      const t = (vx * ux + vy * uy) / dist;
      if (t > 0.06 && t < 0.94) {
        const perp = vx * nx + vy * ny;
        const absPerp = Math.abs(perp);
        if (absPerp < 72) {
          const needed = Math.max(56, 75 - absPerp);
          if (needed > maxObstacleAvoidance) {
            maxObstacleAvoidance = needed;
            if (absPerp < 8) {
              obstacleSide = edge.from < edge.to ? 1 : -1;
            } else {
              obstacleSide = perp > 0 ? -1 : 1;
            }
          }
        }
      }
    });

    let apexOffset = 0;
    if (maxObstacleAvoidance > 0) {
      apexOffset = obstacleSide * Math.max(56, maxObstacleAvoidance);
    } else if (isReverse) {
      apexOffset = 30;
    } else if (dist > 190) {
      // Long skip edge: arch gracefully over intermediate nodes
      const M_temp = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const otherY = automaton.states
        .filter((s) => s !== edge.from && s !== edge.to && positions[s])
        .map((s) => positions[s].y);
      const avgOtherY = otherY.length > 0 ? otherY.reduce((a, b) => a + b, 0) / otherY.length : M_temp.y;
      const archMagnitude = Math.min(50, Math.max(34, dist * 0.11));
      // ny is ux: if ux > 0, positive apexOffset moves in +Y (downward).
      // If other nodes are below (avgOtherY >= M_temp.y), arch UP (negative in Y):
      const side = (avgOtherY >= M_temp.y) ? (ny > 0 ? -1 : 1) : (ny > 0 ? 1 : -1);
      apexOffset = side * archMagnitude;
    }

    const M = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    let pathD = '';
    let labelX = M.x;
    let labelY = M.y;

    if (apexOffset === 0) {
      const nodeR = 30;
      const startX = p1.x + ux * nodeR;
      const startY = p1.y + uy * nodeR;
      const endX = p2.x - ux * (nodeR + 6);
      const endY = p2.y - uy * (nodeR + 6);
      pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
    } else {
      const ctrlX = M.x + 2 * apexOffset * nx;
      const ctrlY = M.y + 2 * apexOffset * ny;

      const t0x = ctrlX - p1.x;
      const t0y = ctrlY - p1.y;
      const t0Len = Math.hypot(t0x, t0y) || 1;
      const startX = p1.x + (t0x / t0Len) * 30;
      const startY = p1.y + (t0y / t0Len) * 30;

      const t1x = p2.x - ctrlX;
      const t1y = p2.y - ctrlY;
      const t1Len = Math.hypot(t1x, t1y) || 1;
      const endX = p2.x - (t1x / t1Len) * 36;
      const endY = p2.y - (t1y / t1Len) * 36;

      pathD = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
      labelX = M.x + apexOffset * nx;
      labelY = M.y + apexOffset * ny;
    }

    const labelWidth = Math.max(30, edge.symbols.join(', ').length * 8 + 14);

    return {
      ...edge,
      idx,
      isSelfLoop: false,
      pathD,
      labelX,
      labelY,
      labelWidth,
      labelHeight: 20,
      ux,
      uy,
      strokeColor,
      markerEnd,
      isDashed,
      isHighlighted,
      badgeBg,
      badgeBorder,
      badgeTextColor,
    };
  });

  // Label De-Collision: ensure no two badges overlap each other
  for (let i = 0; i < edgeList.length; i++) {
    for (let j = i + 1; j < edgeList.length; j++) {
      const e1 = edgeList[i];
      const e2 = edgeList[j];
      const dist = Math.hypot(e1.labelX - e2.labelX, e1.labelY - e2.labelY);
      if (dist < 26) {
        if (e2.ux !== undefined && e2.uy !== undefined) {
          e2.labelX += e2.ux * 20;
          e2.labelY += e2.uy * 20;
        } else {
          e2.labelY -= 20;
        }
      }
    }
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
            id="arrowhead-epsilon"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#c084fc" />
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

          {/* LAYER 1: Transitions Paths (Lines & Curves) */}
          <g id="layer-paths">
            {edgeList.map((edge) => (
              <path
                key={`path-${edge.from}->${edge.to}-${edge.idx}`}
                d={edge.pathD}
                fill="none"
                stroke={edge.strokeColor}
                strokeWidth={edge.isHighlighted ? 2.5 : edge.isEpsilon ? 2 : 1.75}
                strokeDasharray={edge.isDashed ? '6,4' : undefined}
                markerEnd={edge.markerEnd}
                className="transition-colors duration-150"
              />
            ))}
          </g>

          {/* LAYER 2: State Nodes */}
          <g id="layer-nodes">
            {automaton.states.map((s) => {
              const pos = positions[s] || { x: 150, y: 150 };
              const isInitial = s === automaton.initial_state;
              const isAccepting = automaton.accepting_states.includes(s);
              const isSelected = selectedState === s;
              const isHighlighted = highlightStates.includes(s);

              const isDeadState = s === '∅' || s.toLowerCase().includes('dead') || s.toLowerCase().includes('trap');

              let fillColor = isDeadState ? '#0b0f19' : '#111827';
              let strokeColor = isInitial ? '#10b981' : isAccepting ? '#ef4444' : isDeadState ? '#64748b' : '#475569';
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
                    strokeDasharray={isDeadState ? '4,3' : undefined}
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
                    fill={isDeadState ? '#94a3b8' : '#f8fafc'}
                    fontSize={s.length > 8 ? '9' : s.length > 5 ? '11' : '13'}
                    fontWeight="700"
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

          {/* LAYER 3: Edge Labels (Always rendered on top so never covered!) */}
          <g id="layer-labels">
            {edgeList.map((edge) => (
              <g key={`label-${edge.from}->${edge.to}-${edge.idx}`} className="group cursor-pointer">
                <rect
                  x={edge.labelX - edge.labelWidth / 2}
                  y={edge.labelY - edge.labelHeight / 2}
                  width={edge.labelWidth}
                  height={edge.labelHeight}
                  rx={5}
                  fill={edge.badgeBg}
                  stroke={edge.badgeBorder}
                  strokeWidth={1.5}
                  className="hover:scale-110 hover:stroke-cyan-400 transition-all duration-150 shadow-md"
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
                  x={edge.labelX}
                  y={edge.labelY + 4}
                  textAnchor="middle"
                  fill={edge.badgeTextColor}
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  {edge.symbols.join(', ')}
                </text>
              </g>
            ))}
          </g>
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
