# AutomataX — The Intelligent Automata Construction, Conversion & Verification Laboratory

**AutomataX** is a unified computational laboratory and educational software platform for automata theory and computational mathematics. It bridges interactive visual graph construction, mathematical formal language algorithms, step-by-step educational animations, and rigorous verification engines.

---

## 1. Core Architecture

```
AutomataX/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app with CORS, Lifespan & route registration
│   │   ├── core/
│   │   │   ├── automaton_types.py      # Enums for automata, algorithms, and severities
│   │   │   ├── validation.py          # Mathematical validation of DFA, NFA, ENFA
│   │   │   └── exceptions.py          # Structured error classes
│   │   ├── models/
│   │   │   ├── automaton.py           # Unified Pydantic models for automata, steps, simulations
│   │   │   ├── regular_expression.py  # Regex AST nodes and Glushkov metadata
│   │   │   └── grammar.py             # Right-linear grammar and production models
│   │   ├── algorithms/
│   │   │   ├── epsilon_closure.py     # DFS/BFS epsilon-closure calculation with cycle detection
│   │   │   ├── epsilon_elimination.py # ε-NFA → NFA transformation
│   │   │   ├── subset_construction.py # Reachable subset construction (NFA/ε-NFA → DFA)
│   │   │   ├── minimization.py        # Hopcroft's partition refinement DFA minimization
│   │   │   ├── equivalence.py         # Cartesian product automaton BFS for shortest counterexample
│   │   │   ├── regex_parser.py        # Recursive-descent AST parser for regular expressions
│   │   │   ├── thompson_glushkov.py   # Thompson ε-NFA & Glushkov position-based NFA
│   │   │   ├── state_elimination.py   # GNFA state elimination: DFA/NFA/ENFA → Regular Expression
│   │   │   ├── grammar_conversion.py  # Right-linear grammar ↔ NFA conversions
│   │   │   └── automata_operations.py # Union, Intersection, Complement, Diff, Concat, Star, Reverse
│   │   ├── simulation/
│   │   │   └── simulator.py           # String simulator for DFA, NFA, and ε-NFA with active state sets
│   │   ├── optimization/
│   │   │   └── debugger.py            # Diagnostic engine: unreachable, dead, missing transitions, fixes
│   │   ├── services/
│   │   │   ├── ai_service.py          # Natural language synthesizer with deterministic verification
│   │   │   ├── report_service.py      # ReportLab academic PDF generator
│   │   │   └── project_service.py     # SQLite persistence for projects and benchmark automata
│   │   └── api/
│   │       ├── automata_routes.py     # CRUD, validation, projects
│   │       ├── conversion_routes.py   # Conversion endpoints with step tracing
│   │       ├── regex_routes.py        # Regex AST, Thompson, Glushkov, DFA
│   │       ├── grammar_routes.py      # Grammar validation and conversions
│   │       ├── operations_routes.py   # Set-theoretic and language closure operations
│   │       ├── simulation_routes.py   # Single and batch string simulation
│   │       ├── equivalence_routes.py  # Mathematical language equivalence verification
│   │       ├── debugger_routes.py     # Automaton diagnostics & fixes
│   │       ├── reports_routes.py      # PDF report generation
│   │       ├── ai_routes.py           # Natural-language specification synthesizer
│   │       └── practice_routes.py     # Exercise challenge academy & automated grader
│   └── tests/
│       ├── test_automata_algorithms.py# Mathematical unit tests (all 11 test suites)
│       └── test_api.py                # FastAPI end-to-end integration tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── graph/AutomataCanvas.tsx     # Interactive SVG canvas with drag, pan, zoom, dagre layout
│   │   │   ├── tables/TransitionTable.tsx   # Dual-mode synchronized transition table
│   │   │   ├── conversion/StepPlayer.tsx    # Conversion animation player (Play, Pause, Speed, Steps)
│   │   │   ├── simulator/SimulationPane.tsx # Interactive string simulator with path trace & batch suite
│   │   │   ├── equivalence/EquivalenceView.tsx # Side-by-side equivalence & shortest counterexample
│   │   │   ├── debugger/DebuggerView.tsx    # Diagnostics report with one-click fix buttons
│   │   │   ├── whatif/WhatIfLab.tsx         # Live experimentation with language impact matrix
│   │   │   ├── regex/RegexLab.tsx           # Regex conversions: Thompson, Glushkov, GNFA
│   │   │   ├── grammar/GrammarLab.tsx       # Right-linear grammar editor and NFA generator
│   │   │   ├── operations/OperationsLab.tsx # 7 algebraic automata operations
│   │   │   ├── comparison/ComparisonLab.tsx # Density & metric comparison (NFA vs DFA vs Minimal)
│   │   │   ├── practice/PracticeLab.tsx     # Student academy, hints, and equivalence evaluation
│   │   │   ├── ai/AIGeneratorModal.tsx      # Natural language prompt synthesizer
│   │   │   └── reports/ExportModal.tsx      # Academic PDF, JSON, and CSV export
│   │   ├── services/api.ts                  # Typed client for all backend endpoints
│   │   ├── types/automata.ts                # TypeScript interfaces for all automata models
│   │   ├── App.tsx                          # Master dashboard and laboratory navigation
│   │   └── index.css                        # Tailwind CSS styling
├── start_backend.bat                        # Launcher for FastAPI backend
├── start_frontend.bat                       # Launcher for Vite React frontend
└── start_all.bat                            # Launches both services simultaneously
```

---

## 2. Key Modules & Features

### A. Dual-Mode Automata Builder
- **Visual Graph Editor**: Interactive SVG canvas supporting standard automata conventions (circles for states, double circles for accepting states, incoming arrows for initial state, curved transitions with self-loops).
- **Structured Transition Table**: Fully synchronized with the graph editor. Editing a cell in the table immediately updates the graph and vice versa.
- **Auto Layout**: Integrated Dagre hierarchical directed graph layout.

### B. Core Conversions with Interactive Step Player
- **NFA → DFA**: Reachable subset construction algorithm. Never generates unnecessary theoretical subsets; computes canonical subset names, detects newly discovered subsets, and flags accepting subsets.
- **ε-NFA → NFA**: Epsilon-elimination algorithm via $\delta'(q, a) = \varepsilon\text{-closure}(\text{move}(\varepsilon\text{-closure}(q), a))$.
- **DFA Minimization**: Hopcroft's partition refinement algorithm. Removes unreachable states, completes missing transitions with a sink state, refines partitions by distinguishing symbols, and contracts equivalence classes.
- **Step Controls**: Play, Pause, Resume, Previous, Next, Reset, Speed Adjustment (0.5x, 1x, 2x, 4x), highlighted transitions, and step-by-step mathematical explanations.

### C. Equivalence Checker & Shortest Counterexample Engine
- Computes $L(A) \equiv L(B)$ mathematically by converting both automata to complete DFAs over the joint alphabet $\Sigma_A \cup \Sigma_B$ and exploring the Cartesian product automaton.
- If $L(A) \neq L(B)$, Breadth-First Search (BFS) finds the **shortest distinguishing counterexample** string $w$.
- Displays side-by-side simulation traces of $w$ on both automata showing exactly where and why they diverge.

### D. Regular Expression Laboratory
- Formal recursive-descent lexer and parser building an explicit AST.
- **Thompson's Construction**: Generates modular sub-automata for basic symbols, epsilon, union, concatenation, and Kleene star.
- **Glushkov's Construction**: Position-based direct NFA construction utilizing nullable, firstpos, lastpos, and followpos tables.
- **GNFA State Elimination**: Transforms DFA/NFA/ENFA into regular expressions via $R_{ij} = R_{ij} \cup R_{ik}(R_{kk})^* R_{kj}$ with algebraic string simplifications.

### E. Right-Linear Grammar Laboratory
- Dedicated editor for regular right-linear grammars ($A \to w B$, $A \to w$, $A \to \varepsilon$).
- Strictly rejects general Context-Free Grammar productions with informative error messages explaining why general CFGs cannot be represented as finite automata.
- Bidirectional conversions: Grammar $\to$ NFA and Automaton $\to$ Grammar.

### F. Automata Operations Laboratory
- Implements 7 formal language operations:
  1. **Union**: $L(A) \cup L(B)$
  2. **Intersection**: $L(A) \cap L(B)$ (via Cartesian product)
  3. **Complement**: $\Sigma^* \setminus L(A)$ (via complete DFA state inversion)
  4. **Difference**: $L(A) \setminus L(B) = L(A) \cap L(B)^c$
  5. **Concatenation**: $L(A) \cdot L(B)$
  6. **Kleene Star**: $L(A)^*$
  7. **Reversal**: $L(A)^R$

### G. String Simulator & Diagnostics
- Simulates individual strings with step-by-step path traces, active state sets, and invalid symbol detection.
- Batch evaluation suite for multi-string testing.
- Diagnostic debugger identifying unreachable states, dead sink states, and DFA non-determinism with one-click fix suggestions.

### H. Academy & Practice Challenges
- Practice exercises with beginner, intermediate, and advanced difficulty.
- Step-by-step progressive hints.
- Automated grading engine that evaluates solutions by **formal mathematical language equivalence** (not superficial state names).

### I. Academic Exports & Reports
- **PDF Report Generation**: Native ReportLab generator producing publication-ready academic reports with formal 5-tuple specifications, transition tables, conversion histories, and simulation logs.
- **JSON & CSV Exports**: Canonical JSON schema and CSV transition tables.

---

## 3. Installation & Quickstart

### Prerequisites
- Python 3.10+ (tested with Python 3.14.3)
- Node.js 18+ (tested with Node.js v26.1.0)
- npm or pnpm

### Quick Launch (Windows)
Double click `start_all.bat` or run:
```cmd
start_all.bat
```
This automatically launches:
- **Backend API**: `http://127.0.0.1:8000` (Swagger docs at `/docs`)
- **Frontend UI**: `http://127.0.0.1:5173`

### Manual Startup

#### 1. Backend Server
```cmd
cd backend
venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend Development Server
```cmd
cd frontend
npm run dev
```

### Running Test Suite
Execute the full test suite in `backend/`:
```cmd
cd backend
venv\Scripts\pytest.exe -v
```
All 16 algorithm and API integration tests will run and report status.
